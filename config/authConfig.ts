import { Configuration, LogLevel, PopupRequest, RedirectRequest } from '@azure/msal-browser';

/**
 * MSAL Configuration for Azure Architect Mate
 *
 * This configuration supports:
 * - Multi-tenant authentication (any Microsoft 365 organization)
 * - Admin consent flow for Global Administrators
 * - Silent token acquisition with fallback to popup
 * - Azure Resource Manager API access
 */

// Get environment variables (Vite uses import.meta.env)
// Check for localStorage override first (set by the setup wizard)
const getClientId = (): string => {
  // Check localStorage for user-provided client ID (from setup wizard)
  const localStorageClientId = typeof window !== 'undefined'
    ? localStorage.getItem('azure_client_id_override')
    : null;

  if (localStorageClientId && localStorageClientId.trim()) {
    return localStorageClientId.trim();
  }

  // Fall back to environment variable
  return import.meta.env.VITE_AZURE_CLIENT_ID || '';
};

const clientId = getClientId();
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID || 'organizations'; // 'organizations' for multi-tenant
const redirectUri = import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin;

// Validate configuration
if (!clientId) {
  console.warn(
    '⚠️ Azure AD Client ID not configured. Please set VITE_AZURE_CLIENT_ID in your .env file.\n' +
    'See AZURE_AD_SETUP.md for instructions on creating an App Registration.'
  );
}

/**
 * MSAL Configuration Object
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: clientId,
    // Use 'organizations' for multi-tenant, or specific tenant ID for single-tenant
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: redirectUri,
    postLogoutRedirectUri: redirectUri,
    // Required for single-page applications
    navigateToLoginRequestUrl: true,
  },
  cache: {
    // Store tokens in sessionStorage for security (cleared when browser closes)
    // Use 'localStorage' for persistent sessions across browser restarts
    cacheLocation: 'sessionStorage',
    // Recommended for SPA to avoid issues with redirects
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
        if (containsPii) {
          return; // Don't log PII
        }
        switch (level) {
          case LogLevel.Error:
            console.error('[MSAL]', message);
            break;
          case LogLevel.Warning:
            console.warn('[MSAL]', message);
            break;
          case LogLevel.Info:
            // Uncomment for debugging:
            // console.info('[MSAL]', message);
            break;
          case LogLevel.Verbose:
            // Uncomment for verbose debugging:
            // console.debug('[MSAL]', message);
            break;
        }
      },
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
    },
    // Increase timeout for slow networks
    tokenRenewalOffsetSeconds: 300,
  },
};

/**
 * Scopes for Microsoft Graph API
 * - User.Read: Get user profile information
 * - offline_access: Get refresh tokens for persistent sessions
 */
export const graphScopes = {
  userRead: ['User.Read'],
  offline: ['offline_access'],
};

/**
 * Scopes for Azure Resource Manager API
 * - user_impersonation: Full access to Azure resources on behalf of the user
 * - default: Used for Cloud Shell and other services requiring full access
 */
export const azureManagementScopes = {
  userImpersonation: ['https://management.azure.com/user_impersonation'],
  // Default scope - required for Cloud Shell execution
  default: ['https://management.azure.com/.default'],
};

/**
 * Scopes for Azure Cloud Shell
 * Required for provisioning and executing scripts in Cloud Shell
 */
export const cloudShellScopes = {
  management: ['https://management.azure.com/.default'],
};

/**
 * Combined login request for initial authentication
 * Requests both Graph and Azure Management scopes
 */
export const loginRequest: PopupRequest = {
  scopes: [
    ...graphScopes.userRead,
    ...azureManagementScopes.userImpersonation,
  ],
  prompt: 'select_account', // Always show account picker
};

/**
 * Login request specifically for admin consent
 * Use this when a Global Administrator needs to consent on behalf of their organization
 */
export const adminConsentRequest: PopupRequest = {
  scopes: [
    ...graphScopes.userRead,
    ...azureManagementScopes.userImpersonation,
  ],
  prompt: 'consent', // Force consent prompt
  extraQueryParameters: {
    // Request admin consent for the entire organization
    prompt: 'admin_consent',
  },
};

/**
 * Token request for Azure Resource Manager API
 * Use this to acquire tokens for Azure API calls
 */
export const azureTokenRequest = {
  scopes: azureManagementScopes.userImpersonation,
};

/**
 * Token request for Microsoft Graph API
 * Use this to acquire tokens for Graph API calls (user profile, etc.)
 */
export const graphTokenRequest = {
  scopes: graphScopes.userRead,
};

/**
 * Redirect request configuration (alternative to popup)
 * Use this if popups are blocked or for mobile devices
 */
export const redirectRequest: RedirectRequest = {
  scopes: [
    ...graphScopes.userRead,
    ...azureManagementScopes.userImpersonation,
  ],
  prompt: 'select_account',
};

/**
 * Admin consent URL builder
 * Generates a URL that Global Administrators can use to consent on behalf of their organization
 */
export function buildAdminConsentUrl(): string {
  return `https://login.microsoftonline.com/organizations/adminconsent?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/**
 * Check if the MSAL configuration is valid
 */
export function isConfigured(): boolean {
  return !!clientId && clientId.length > 0;
}

/**
 * API Endpoints
 */
export const apiEndpoints = {
  // Microsoft Graph API base URL
  graph: 'https://graph.microsoft.com/v1.0',
  // Azure Resource Manager API base URL
  arm: 'https://management.azure.com',
};

/**
 * Azure API versions
 */
export const apiVersions = {
  subscriptions: '2022-12-01',
  resources: '2021-04-01',
  resourceGroups: '2021-04-01',
};

export default msalConfig;
