import { PublicClientApplication, Configuration, LogLevel } from '@azure/msal-browser';

/**
 * Bootstrap Authentication Service
 *
 * This service uses Microsoft's well-known first-party Azure PowerShell client ID
 * to authenticate users and then create an app registration for Azure Architect Mate.
 *
 * This approach is Microsoft-supported and used by tools like Azure CLI and PowerShell.
 *
 * Flow:
 * 1. User authenticates using Azure PowerShell's first-party app
 * 2. App creates its own registration via Microsoft Graph API
 * 3. New client ID is saved to localStorage
 * 4. App uses its own registration for subsequent authentications
 *
 * References:
 * - https://learn.microsoft.com/en-us/graph/api/application-post-applications
 * - https://rakhesh.com/azure/well-known-client-ids/
 */

// Microsoft Azure PowerShell - well-known first-party application
// This is a public, Microsoft-registered app that anyone can use to authenticate
export const AZURE_POWERSHELL_CLIENT_ID = '1950a258-227b-4e31-a9cf-717495945fc2';

// Alternative: Azure CLI client ID (also well-known)
// export const AZURE_CLI_CLIENT_ID = '04b07795-8ddb-461a-bbee-02f9e1bf7b46';

// Storage keys
export const APP_CLIENT_ID_KEY = 'azure_client_id_override';
export const APP_OBJECT_ID_KEY = 'azure_app_object_id';
export const APP_NAME = 'Azure Architect Mate';

/**
 * Bootstrap MSAL configuration using Azure PowerShell's client ID
 */
export const bootstrapMsalConfig: Configuration = {
  auth: {
    clientId: AZURE_POWERSHELL_CLIENT_ID,
    authority: 'https://login.microsoftonline.com/organizations',
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
        if (containsPii) return;
        if (level === LogLevel.Error) {
          console.error('[Bootstrap MSAL]', message);
        } else if (level === LogLevel.Warning) {
          console.warn('[Bootstrap MSAL]', message);
        }
      },
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
    },
  },
};

/**
 * Scopes required for app registration creation
 * Application.ReadWrite.All - Required to create app registrations
 */
export const bootstrapScopes = {
  // Scopes for creating app registrations via Graph API
  appRegistration: ['https://graph.microsoft.com/Application.ReadWrite.All'],
  // Basic user info
  userRead: ['https://graph.microsoft.com/User.Read'],
};

/**
 * Interface for the created application
 */
export interface CreatedApplication {
  id: string;           // Object ID of the application
  appId: string;        // Client ID (Application ID)
  displayName: string;
}

/**
 * Interface for the service principal
 */
export interface CreatedServicePrincipal {
  id: string;
  appId: string;
  displayName: string;
}

/**
 * BootstrapAuthService handles the first-time setup flow
 */
export class BootstrapAuthService {
  private msalInstance: PublicClientApplication;
  private initialized: boolean = false;

  constructor() {
    this.msalInstance = new PublicClientApplication(bootstrapMsalConfig);
  }

  /**
   * Initialize the MSAL instance
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.msalInstance.initialize();
    this.initialized = true;
  }

  /**
   * Check if an app registration already exists (saved in localStorage)
   */
  hasExistingAppRegistration(): boolean {
    const clientId = localStorage.getItem(APP_CLIENT_ID_KEY);
    return !!clientId && clientId !== 'your-application-client-id-here';
  }

  /**
   * Get the existing app client ID if available
   */
  getExistingClientId(): string | null {
    const clientId = localStorage.getItem(APP_CLIENT_ID_KEY);
    if (clientId && clientId !== 'your-application-client-id-here') {
      return clientId;
    }
    return null;
  }

  /**
   * Authenticate using the bootstrap (Azure PowerShell) app
   * and get a token for Microsoft Graph
   */
  async authenticateForBootstrap(): Promise<string> {
    await this.initialize();

    try {
      // Try silent authentication first
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        try {
          const silentResult = await this.msalInstance.acquireTokenSilent({
            scopes: [...bootstrapScopes.appRegistration, ...bootstrapScopes.userRead],
            account: accounts[0],
          });
          return silentResult.accessToken;
        } catch {
          // Silent failed, fall through to popup
        }
      }

      // Use popup for interactive authentication
      const result = await this.msalInstance.acquireTokenPopup({
        scopes: [...bootstrapScopes.appRegistration, ...bootstrapScopes.userRead],
        prompt: 'select_account',
      });

      return result.accessToken;
    } catch (error) {
      console.error('Bootstrap authentication failed:', error);
      throw new Error(
        `Authentication failed. Please ensure you have the Application.ReadWrite.All permission. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create an app registration in Azure AD using Microsoft Graph API
   */
  async createAppRegistration(accessToken: string): Promise<CreatedApplication> {
    const redirectUri = window.location.origin;

    // Application payload following Microsoft Graph API spec
    // https://learn.microsoft.com/en-us/graph/api/application-post-applications
    const applicationPayload = {
      displayName: APP_NAME,
      signInAudience: 'AzureADMultipleOrgs', // Multi-tenant
      spa: {
        redirectUris: [
          redirectUri,
          'http://localhost:3000',
          'http://localhost:5173',
        ],
      },
      requiredResourceAccess: [
        // Microsoft Graph permissions
        {
          resourceAppId: '00000003-0000-0000-c000-000000000000', // Microsoft Graph
          resourceAccess: [
            {
              id: 'e1fe6dd8-ba31-4d61-89e7-88639da4683d', // User.Read
              type: 'Scope',
            },
          ],
        },
        // Azure Service Management permissions
        {
          resourceAppId: '797f4846-ba00-4fd7-ba43-dac1f8f63013', // Azure Service Management
          resourceAccess: [
            {
              id: '41094075-9dad-400e-a0bd-54e686782033', // user_impersonation
              type: 'Scope',
            },
          ],
        },
      ],
      // Tags for identification
      tags: ['AzureArchitectMate', 'AutoCreated'],
    };

    const response = await fetch('https://graph.microsoft.com/v1.0/applications', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(applicationPayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to create app registration: ${response.status} ${response.statusText}. ` +
        `${errorData.error?.message || JSON.stringify(errorData)}`
      );
    }

    const application: CreatedApplication = await response.json();

    // Save the client ID to localStorage
    localStorage.setItem(APP_CLIENT_ID_KEY, application.appId);
    localStorage.setItem(APP_OBJECT_ID_KEY, application.id);

    console.log('Created app registration:', {
      displayName: application.displayName,
      clientId: application.appId,
      objectId: application.id,
    });

    return application;
  }

  /**
   * Create a service principal for the app in the user's tenant
   * This is required for the app to be usable in the tenant
   */
  async createServicePrincipal(accessToken: string, appId: string): Promise<CreatedServicePrincipal> {
    const response = await fetch('https://graph.microsoft.com/v1.0/servicePrincipals', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ appId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // 409 Conflict means the service principal already exists, which is fine
      if (response.status === 409) {
        console.log('Service principal already exists for app:', appId);
        return { id: '', appId, displayName: APP_NAME };
      }
      throw new Error(
        `Failed to create service principal: ${response.status} ${response.statusText}. ` +
        `${errorData.error?.message || JSON.stringify(errorData)}`
      );
    }

    const servicePrincipal: CreatedServicePrincipal = await response.json();
    console.log('Created service principal:', servicePrincipal);
    return servicePrincipal;
  }

  /**
   * Complete bootstrap flow: authenticate, create app, create service principal
   */
  async bootstrapApplication(): Promise<CreatedApplication> {
    // Step 1: Authenticate using Azure PowerShell's client ID
    console.log('Step 1: Authenticating with Azure PowerShell bootstrap app...');
    const accessToken = await this.authenticateForBootstrap();

    // Step 2: Create the app registration
    console.log('Step 2: Creating app registration...');
    const application = await this.createAppRegistration(accessToken);

    // Step 3: Create the service principal
    console.log('Step 3: Creating service principal...');
    await this.createServicePrincipal(accessToken, application.appId);

    console.log('Bootstrap complete! App registration created successfully.');
    console.log('Client ID:', application.appId);

    return application;
  }

  /**
   * Delete the app registration (for cleanup/reset)
   */
  async deleteAppRegistration(accessToken: string): Promise<void> {
    const objectId = localStorage.getItem(APP_OBJECT_ID_KEY);
    if (!objectId) {
      throw new Error('No app registration found to delete');
    }

    const response = await fetch(`https://graph.microsoft.com/v1.0/applications/${objectId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete app registration: ${response.status}`);
    }

    localStorage.removeItem(APP_CLIENT_ID_KEY);
    localStorage.removeItem(APP_OBJECT_ID_KEY);
    console.log('App registration deleted');
  }

  /**
   * Clear stored app registration data (local only, doesn't delete from Azure)
   */
  clearStoredAppData(): void {
    localStorage.removeItem(APP_CLIENT_ID_KEY);
    localStorage.removeItem(APP_OBJECT_ID_KEY);
  }
}

// Export singleton instance
export const bootstrapAuth = new BootstrapAuthService();
