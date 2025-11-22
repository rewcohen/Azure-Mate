/**
 * Electron Preload Script
 *
 * Exposes secure IPC API to the renderer process for PowerShell execution
 * and other native features.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose electronAPI to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Check PowerShell environment
  checkPowerShell: () => ipcRenderer.invoke('check-powershell'),

  // Install Az module
  installAzModule: (callback) => {
    // Set up output listener
    const handler = (event, data) => {
      callback(data.output, data.type);
    };
    ipcRenderer.on('powershell-output', handler);

    return ipcRenderer.invoke('install-az-module').finally(() => {
      ipcRenderer.removeListener('powershell-output', handler);
    });
  },

  // Connect to Azure with access token
  connectAzure: (accessToken, subscriptionId, tenantId, callback) => {
    const handler = (event, data) => {
      callback(data.output, data.type);
    };
    ipcRenderer.on('powershell-output', handler);

    return ipcRenderer.invoke('connect-azure', accessToken, subscriptionId, tenantId).finally(() => {
      ipcRenderer.removeListener('powershell-output', handler);
    });
  },

  // Execute PowerShell script
  executePowerShell: (script, callback) => {
    const handler = (event, data) => {
      callback(data.output, data.type);
    };
    ipcRenderer.on('powershell-output', handler);

    return ipcRenderer.invoke('execute-powershell', script).finally(() => {
      ipcRenderer.removeListener('powershell-output', handler);
    });
  },

  // Stop current execution
  stopPowerShell: () => ipcRenderer.invoke('stop-powershell'),

  // Platform info
  platform: process.platform,
  isElectron: true,
});

// Log when preload is loaded
console.log('Electron preload script loaded');
