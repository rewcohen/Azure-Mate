import {
  IPublicClientApplication,
  AccountInfo,
  InteractionRequiredAuthError,
} from '@azure/msal-browser';
import { apiEndpoints } from '../config/authConfig';

/**
 * Azure Cloud Shell Service
 *
 * Provides integration with Azure Cloud Shell for executing PowerShell scripts
 * directly in a managed Azure environment.
 */

// Cloud Shell API endpoints
const CLOUD_SHELL_API =
  'https://management.azure.com/providers/Microsoft.Portal';
const CLOUD_SHELL_CONSOLE_API = `${CLOUD_SHELL_API}/consoles/default`;

// Cloud Shell settings
export interface CloudShellSettings {
  preferredLocation: string;
  preferredShellType: 'pwsh' | 'bash';
  storageProfile?: {
    storageAccountResourceId: string;
    fileShareName: string;
  };
}

// Cloud Shell console state
export interface CloudShellConsole {
  name: string;
  properties: {
    osType: string;
    provisioningState: string;
    uri: string;
  };
}

// Execution result
export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode?: number;
}

// Output callback for streaming
export type OutputCallback = (
  output: string,
  type: 'stdout' | 'stderr' | 'info' | 'error'
) => void;

/**
 * Get access token for Azure management
 */
async function getAccessToken(
  msalInstance: IPublicClientApplication,
  account: AccountInfo
): Promise<string> {
  try {
    const response = await msalInstance.acquireTokenSilent({
      scopes: ['https://management.azure.com/.default'],
      account: account,
    });
    return response.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      const response = await msalInstance.acquireTokenPopup({
        scopes: ['https://management.azure.com/.default'],
      });
      return response.accessToken;
    }
    throw error;
  }
}

/**
 * Check if Cloud Shell is available and provisioned
 */
export async function checkCloudShellStatus(
  msalInstance: IPublicClientApplication,
  account: AccountInfo
): Promise<{ available: boolean; provisioned: boolean; error?: string }> {
  try {
    const token = await getAccessToken(msalInstance, account);

    const response = await fetch(
      `${CLOUD_SHELL_API}/userSettings/cloudConsole?api-version=2023-02-01-preview`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 404) {
      return { available: true, provisioned: false };
    }

    if (!response.ok) {
      const errorText = await response.text();
      return { available: false, provisioned: false, error: errorText };
    }

    const data = await response.json();
    return {
      available: true,
      provisioned: !!data.properties?.storageProfile,
    };
  } catch (error: any) {
    return {
      available: false,
      provisioned: false,
      error: error.message || 'Failed to check Cloud Shell status',
    };
  }
}

/**
 * Request Cloud Shell console
 */
export async function requestCloudShellConsole(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  shellType: 'pwsh' | 'bash' = 'pwsh'
): Promise<CloudShellConsole> {
  const token = await getAccessToken(msalInstance, account);

  // Request a console
  const response = await fetch(
    `${CLOUD_SHELL_CONSOLE_API}?api-version=2023-02-01-preview`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          osType: shellType === 'pwsh' ? 'windows' : 'linux',
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to request Cloud Shell console: ${response.status} - ${errorText}`
    );
  }

  return response.json();
}

/**
 * Get terminal WebSocket URI for a Cloud Shell console
 */
export async function getTerminalUri(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  consoleUri: string
): Promise<string> {
  const token = await getAccessToken(msalInstance, account);

  // Request terminal
  const response = await fetch(
    `${consoleUri}/terminals?api-version=2023-02-01-preview&cols=120&rows=30`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get terminal: ${response.status} - ${errorText}`
    );
  }

  const data = await response.json();
  return data.socketUri || data.properties?.socketUri;
}

/**
 * Cloud Shell Session Manager
 * Manages the lifecycle of a Cloud Shell session
 */
export class CloudShellSession {
  private msalInstance: IPublicClientApplication;
  private account: AccountInfo;
  private websocket: WebSocket | null = null;
  private outputCallback: OutputCallback | null = null;
  private isConnected: boolean = false;
  private commandQueue: string[] = [];
  private currentCommand: string | null = null;
  private outputBuffer: string = '';

  constructor(msalInstance: IPublicClientApplication, account: AccountInfo) {
    this.msalInstance = msalInstance;
    this.account = account;
  }

  /**
   * Initialize the Cloud Shell session
   */
  async initialize(onOutput: OutputCallback): Promise<void> {
    this.outputCallback = onOutput;

    try {
      this.emit('info', 'Provisioning Azure Cloud Shell...');

      // Request console
      const console = await requestCloudShellConsole(
        this.msalInstance,
        this.account,
        'pwsh'
      );

      if (console.properties.provisioningState !== 'Succeeded') {
        throw new Error(
          `Console provisioning failed: ${console.properties.provisioningState}`
        );
      }

      this.emit('info', 'Cloud Shell provisioned. Connecting to terminal...');

      // Get terminal WebSocket URI
      const socketUri = await getTerminalUri(
        this.msalInstance,
        this.account,
        console.properties.uri
      );

      // Connect WebSocket
      await this.connectWebSocket(socketUri);

      this.emit('info', 'Connected to Azure Cloud Shell (PowerShell)');
    } catch (error: any) {
      this.emit('error', `Failed to initialize Cloud Shell: ${error.message}`);
      throw error;
    }
  }

  /**
   * Connect to the terminal WebSocket
   */
  private connectWebSocket(uri: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.websocket = new WebSocket(uri);

      this.websocket.onopen = () => {
        this.isConnected = true;
        resolve();
      };

      this.websocket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.websocket.onerror = (error) => {
        this.emit('error', 'WebSocket error');
        reject(new Error('WebSocket connection failed'));
      };

      this.websocket.onclose = () => {
        this.isConnected = false;
        this.emit('info', 'Cloud Shell session closed');
      };

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    // Cloud Shell sends ANSI-encoded terminal output
    this.outputBuffer += data;

    // Emit the output
    this.emit('stdout', data);
  }

  /**
   * Execute a PowerShell script
   */
  async executeScript(script: string): Promise<void> {
    if (!this.isConnected || !this.websocket) {
      throw new Error('Cloud Shell session not connected');
    }

    this.emit('info', 'Executing script...');

    // Split script into lines and execute
    const lines = script.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      await this.sendCommand(line);
      // Small delay between commands
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Send a single command to the terminal
   */
  private sendCommand(command: string): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    // Send command with newline
    this.websocket.send(command + '\r');
  }

  /**
   * Emit output to callback
   */
  private emit(
    type: 'stdout' | 'stderr' | 'info' | 'error',
    message: string
  ): void {
    if (this.outputCallback) {
      this.outputCallback(message, type);
    }
  }

  /**
   * Close the Cloud Shell session
   */
  close(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.isConnected = false;
  }

  /**
   * Check if session is connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

/**
 * Execute a script using Azure REST API directly
 * This is an alternative approach that converts common PowerShell commands to REST calls
 */
export async function executeViaRestApi(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  subscriptionId: string,
  resourceGroupName: string,
  resources: Array<{
    type: string;
    name: string;
    properties: any;
    location: string;
  }>,
  onOutput: OutputCallback
): Promise<ExecutionResult> {
  const token = await getAccessToken(msalInstance, account);
  let success = true;
  let output = '';
  let error = '';

  // Create resource group first if needed
  onOutput(`Creating resource group '${resourceGroupName}'...`, 'info');

  try {
    const rgResponse = await fetch(
      `${apiEndpoints.arm}/subscriptions/${subscriptionId}/resourcegroups/${resourceGroupName}?api-version=2021-04-01`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: resources[0]?.location || 'eastus',
        }),
      }
    );

    if (!rgResponse.ok) {
      const errorText = await rgResponse.text();
      throw new Error(`Failed to create resource group: ${errorText}`);
    }

    onOutput(
      `Resource group '${resourceGroupName}' created successfully`,
      'stdout'
    );
    output += `Resource group '${resourceGroupName}' created\n`;

    // Create each resource
    for (const resource of resources) {
      onOutput(`Creating ${resource.type} '${resource.name}'...`, 'info');

      const resourceResponse = await fetch(
        `${apiEndpoints.arm}/subscriptions/${subscriptionId}/resourcegroups/${resourceGroupName}/providers/${resource.type}/${resource.name}?api-version=2021-04-01`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            location: resource.location,
            properties: resource.properties,
          }),
        }
      );

      if (!resourceResponse.ok) {
        const errorText = await resourceResponse.text();
        onOutput(`Failed to create ${resource.name}: ${errorText}`, 'error');
        error += `Failed to create ${resource.name}: ${errorText}\n`;
        success = false;
      } else {
        onOutput(
          `${resource.type} '${resource.name}' created successfully`,
          'stdout'
        );
        output += `${resource.type} '${resource.name}' created\n`;
      }
    }
  } catch (err: any) {
    onOutput(`Error: ${err.message}`, 'error');
    error = err.message;
    success = false;
  }

  return { success, output, error };
}

export default CloudShellSession;
