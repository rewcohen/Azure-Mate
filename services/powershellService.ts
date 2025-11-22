/**
 * PowerShell Execution Service
 *
 * Provides local PowerShell script execution for Electron desktop app.
 * Falls back to guidance for web browser users.
 */

// Output callback type
export type PowerShellOutputCallback = (
  output: string,
  type: 'stdout' | 'stderr' | 'info' | 'error' | 'success'
) => void;

// Execution result
export interface PowerShellResult {
  success: boolean;
  exitCode: number;
  output: string;
  error: string;
}

// PowerShell environment info
export interface PowerShellEnvironment {
  isElectron: boolean;
  powershellAvailable: boolean;
  powershellVersion?: string;
  azModuleInstalled: boolean;
  azModuleVersion?: string;
}

// Extend window type for Electron
declare global {
  interface Window {
    process?: {
      type?: string;
    };
    electronAPI?: {
      checkPowerShell: () => Promise<any>;
      installAzModule: (callback: (output: string, type: string) => void) => Promise<any>;
      connectAzure: (accessToken: string, subscriptionId: string, tenantId: string, callback: (output: string, type: string) => void) => Promise<any>;
      executePowerShell: (script: string, callback: (output: string, type: string) => void) => Promise<any>;
      stopPowerShell: () => Promise<boolean>;
    };
  }
}

/**
 * Check if we're running in Electron
 */
export function isElectron(): boolean {
  // Check for Electron's process object
  return typeof window !== 'undefined' &&
    typeof window.process === 'object' &&
    window.process?.type === 'renderer';
}

/**
 * Check if Electron IPC is available
 */
export function hasElectronIPC(): boolean {
  return isElectron() && typeof (window as any).electronAPI !== 'undefined';
}

/**
 * Check PowerShell environment (Electron only)
 */
export async function checkPowerShellEnvironment(): Promise<PowerShellEnvironment> {
  if (!isElectron()) {
    return {
      isElectron: false,
      powershellAvailable: false,
      azModuleInstalled: false,
    };
  }

  if (!hasElectronIPC()) {
    return {
      isElectron: true,
      powershellAvailable: false,
      azModuleInstalled: false,
    };
  }

  try {
    const result = await (window as any).electronAPI.checkPowerShell();
    return {
      isElectron: true,
      ...result,
    };
  } catch (error) {
    return {
      isElectron: true,
      powershellAvailable: false,
      azModuleInstalled: false,
    };
  }
}

/**
 * Install Azure PowerShell module (Electron only)
 */
export async function installAzModule(
  onOutput: PowerShellOutputCallback
): Promise<boolean> {
  if (!hasElectronIPC()) {
    onOutput('Azure module installation requires the desktop app', 'error');
    return false;
  }

  onOutput('Installing Azure PowerShell module (Az)...', 'info');
  onOutput('This may take several minutes...', 'info');

  try {
    const result = await (window as any).electronAPI.installAzModule((output: string, type: string) => {
      onOutput(output, type as any);
    });

    if (result.success) {
      onOutput('Azure PowerShell module installed successfully!', 'success');
      return true;
    } else {
      onOutput(`Failed to install Az module: ${result.error}`, 'error');
      return false;
    }
  } catch (error: any) {
    onOutput(`Installation error: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Connect to Azure using access token (Electron only)
 */
export async function connectAzureWithToken(
  accessToken: string,
  subscriptionId: string,
  tenantId: string,
  onOutput: PowerShellOutputCallback
): Promise<boolean> {
  if (!hasElectronIPC()) {
    onOutput('Azure connection requires the desktop app', 'error');
    return false;
  }

  onOutput('Connecting to Azure...', 'info');

  try {
    const result = await (window as any).electronAPI.connectAzure(
      accessToken,
      subscriptionId,
      tenantId,
      (output: string, type: string) => {
        onOutput(output, type as any);
      }
    );

    if (result.success) {
      onOutput('Connected to Azure successfully!', 'success');
      return true;
    } else {
      onOutput(`Failed to connect: ${result.error}`, 'error');
      return false;
    }
  } catch (error: any) {
    onOutput(`Connection error: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Execute a PowerShell script (Electron only)
 */
export async function executePowerShellScript(
  script: string,
  onOutput: PowerShellOutputCallback
): Promise<PowerShellResult> {
  if (!hasElectronIPC()) {
    onOutput('Script execution requires the desktop app', 'error');
    return {
      success: false,
      exitCode: -1,
      output: '',
      error: 'Not running in Electron',
    };
  }

  onOutput('Executing PowerShell script...', 'info');

  try {
    const result = await (window as any).electronAPI.executePowerShell(
      script,
      (output: string, type: string) => {
        onOutput(output, type as any);
      }
    );

    if (result.success) {
      onOutput('Script execution completed successfully!', 'success');
    } else {
      onOutput(`Script execution failed with exit code ${result.exitCode}`, 'error');
    }

    return result;
  } catch (error: any) {
    onOutput(`Execution error: ${error.message}`, 'error');
    return {
      success: false,
      exitCode: -1,
      output: '',
      error: error.message,
    };
  }
}

/**
 * Stop current PowerShell execution (Electron only)
 */
export async function stopExecution(): Promise<boolean> {
  if (!hasElectronIPC()) {
    return false;
  }

  try {
    await (window as any).electronAPI.stopPowerShell();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get execution method recommendation
 */
export function getRecommendedExecutionMethod(): 'electron' | 'cloudshell' | 'manual' {
  if (isElectron() && hasElectronIPC()) {
    return 'electron';
  }

  // In web browser, recommend Cloud Shell
  return 'cloudshell';
}

/**
 * Open Azure Cloud Shell in browser
 */
export function openCloudShell(): void {
  window.open('https://shell.azure.com', '_blank');
}

/**
 * Copy script to clipboard and open Cloud Shell
 */
export async function copyAndOpenCloudShell(script: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(script);
    openCloudShell();
    return true;
  } catch {
    return false;
  }
}

export default {
  isElectron,
  hasElectronIPC,
  checkPowerShellEnvironment,
  installAzModule,
  connectAzureWithToken,
  executePowerShellScript,
  stopExecution,
  getRecommendedExecutionMethod,
  openCloudShell,
  copyAndOpenCloudShell,
};
