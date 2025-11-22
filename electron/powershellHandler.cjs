/**
 * PowerShell IPC Handler for Electron
 *
 * Handles PowerShell execution, Azure connection, and module management
 * from the Electron main process.
 */

const { ipcMain } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');

// Track running PowerShell processes
let currentProcess = null;

/**
 * Find PowerShell executable
 */
function findPowerShell() {
  const isWindows = os.platform() === 'win32';

  if (isWindows) {
    // Try PowerShell Core first, then Windows PowerShell
    const paths = [
      'pwsh.exe',
      'pwsh',
      path.join(process.env.ProgramFiles || '', 'PowerShell', '7', 'pwsh.exe'),
      path.join(process.env.ProgramFiles || '', 'PowerShell', '6', 'pwsh.exe'),
      'powershell.exe',
    ];

    for (const psPath of paths) {
      try {
        const result = require('child_process').execSync(`where ${psPath}`, { encoding: 'utf8' });
        if (result.trim()) {
          return result.trim().split('\n')[0];
        }
      } catch {
        continue;
      }
    }

    return 'powershell.exe'; // Default fallback
  } else {
    // macOS/Linux - prefer pwsh
    return 'pwsh';
  }
}

/**
 * Check PowerShell environment
 */
async function checkPowerShell() {
  return new Promise((resolve) => {
    const psPath = findPowerShell();

    // Check PowerShell version
    exec(`"${psPath}" -NoProfile -Command "$PSVersionTable.PSVersion.ToString()"`, (error, stdout, stderr) => {
      if (error) {
        resolve({
          powershellAvailable: false,
          azModuleInstalled: false,
        });
        return;
      }

      const psVersion = stdout.trim();

      // Check Az module
      exec(`"${psPath}" -NoProfile -Command "Get-Module -ListAvailable -Name Az | Select-Object -First 1 -ExpandProperty Version"`, (error2, stdout2, stderr2) => {
        const azVersion = error2 ? null : stdout2.trim();

        resolve({
          powershellAvailable: true,
          powershellVersion: psVersion,
          azModuleInstalled: !!azVersion,
          azModuleVersion: azVersion || undefined,
        });
      });
    });
  });
}

/**
 * Install Azure PowerShell module
 */
async function installAzModule(event, callback) {
  return new Promise((resolve) => {
    const psPath = findPowerShell();

    callback('Starting Az module installation...', 'info');
    callback('This requires an internet connection and may take several minutes.', 'info');

    const installScript = `
      Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force -ErrorAction SilentlyContinue
      Install-Module -Name Az -Scope CurrentUser -Repository PSGallery -Force -AllowClobber
      Get-Module -ListAvailable -Name Az | Select-Object -First 1 -ExpandProperty Version
    `;

    const process = spawn(psPath, ['-NoProfile', '-Command', installScript], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    currentProcess = process;

    process.stdout.on('data', (data) => {
      const output = data.toString();
      callback(output, 'stdout');
    });

    process.stderr.on('data', (data) => {
      const output = data.toString();
      // Filter out progress messages
      if (!output.includes('Progress') && !output.includes('%')) {
        callback(output, 'stderr');
      }
    });

    process.on('close', (code) => {
      currentProcess = null;
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: `Installation failed with code ${code}` });
      }
    });

    process.on('error', (error) => {
      currentProcess = null;
      resolve({ success: false, error: error.message });
    });
  });
}

/**
 * Connect to Azure using access token
 */
async function connectAzure(event, accessToken, subscriptionId, tenantId, callback) {
  return new Promise((resolve) => {
    const psPath = findPowerShell();

    callback('Connecting to Azure with access token...', 'info');

    // Use Connect-AzAccount with access token
    const connectScript = `
      $secureToken = ConvertTo-SecureString -String '${accessToken}' -AsPlainText -Force
      Connect-AzAccount -AccessToken $secureToken -AccountId 'user@azure' -TenantId '${tenantId}' -SubscriptionId '${subscriptionId}'
      Set-AzContext -SubscriptionId '${subscriptionId}'
      Get-AzContext | Format-List
    `;

    const process = spawn(psPath, ['-NoProfile', '-Command', connectScript], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    currentProcess = process;
    let output = '';
    let errorOutput = '';

    process.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      callback(text, 'stdout');
    });

    process.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      callback(text, 'stderr');
    });

    process.on('close', (code) => {
      currentProcess = null;
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        resolve({ success: false, error: errorOutput || `Connection failed with code ${code}` });
      }
    });

    process.on('error', (error) => {
      currentProcess = null;
      resolve({ success: false, error: error.message });
    });
  });
}

/**
 * Execute PowerShell script
 */
async function executePowerShell(event, script, callback) {
  return new Promise((resolve) => {
    const psPath = findPowerShell();

    callback('Starting script execution...', 'info');

    // Create a temp file for the script to handle complex scripts
    const tempDir = os.tmpdir();
    const scriptPath = path.join(tempDir, `azure-mate-script-${Date.now()}.ps1`);

    // Write script to temp file
    require('fs').writeFileSync(scriptPath, script, 'utf8');

    const process = spawn(psPath, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    currentProcess = process;
    let output = '';
    let errorOutput = '';

    process.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      callback(text, 'stdout');
    });

    process.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      // Check if it's an error or just verbose output
      if (text.toLowerCase().includes('error') || text.toLowerCase().includes('exception')) {
        callback(text, 'error');
      } else {
        callback(text, 'stderr');
      }
    });

    process.on('close', (code) => {
      currentProcess = null;

      // Clean up temp file
      try {
        require('fs').unlinkSync(scriptPath);
      } catch {
        // Ignore cleanup errors
      }

      resolve({
        success: code === 0,
        exitCode: code,
        output,
        error: errorOutput,
      });
    });

    process.on('error', (error) => {
      currentProcess = null;
      resolve({
        success: false,
        exitCode: -1,
        output,
        error: error.message,
      });
    });
  });
}

/**
 * Stop current PowerShell execution
 */
function stopPowerShell() {
  if (currentProcess) {
    currentProcess.kill('SIGTERM');
    currentProcess = null;
    return true;
  }
  return false;
}

/**
 * Register all IPC handlers
 */
function registerHandlers() {
  // Check PowerShell environment
  ipcMain.handle('check-powershell', async () => {
    return checkPowerShell();
  });

  // Install Az module
  ipcMain.handle('install-az-module', async (event) => {
    return new Promise((resolve) => {
      installAzModule(event, (output, type) => {
        event.sender.send('powershell-output', { output, type });
      }).then(resolve);
    });
  });

  // Connect to Azure
  ipcMain.handle('connect-azure', async (event, accessToken, subscriptionId, tenantId) => {
    return new Promise((resolve) => {
      connectAzure(event, accessToken, subscriptionId, tenantId, (output, type) => {
        event.sender.send('powershell-output', { output, type });
      }).then(resolve);
    });
  });

  // Execute PowerShell script
  ipcMain.handle('execute-powershell', async (event, script) => {
    return new Promise((resolve) => {
      executePowerShell(event, script, (output, type) => {
        event.sender.send('powershell-output', { output, type });
      }).then(resolve);
    });
  });

  // Stop execution
  ipcMain.handle('stop-powershell', () => {
    return stopPowerShell();
  });
}

module.exports = {
  registerHandlers,
  checkPowerShell,
  installAzModule,
  connectAzure,
  executePowerShell,
  stopPowerShell,
};
