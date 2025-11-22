/**
 * Azure App Registration Service
 *
 * Provides utilities for setting up Azure AD App Registration
 * including PowerShell script generation and connection verification.
 */

export interface AppRegistrationConfig {
  appName: string;
  redirectUri: string;
}

/**
 * Default app configuration
 */
export const defaultAppConfig: AppRegistrationConfig = {
  appName: 'AzureMate',
  redirectUri: window.location.origin,
};

/**
 * Required API permissions for the app
 */
export const requiredPermissions = {
  microsoftGraph: {
    name: 'Microsoft Graph',
    resourceAppId: '00000003-0000-0000-c000-000000000000',
    permissions: [
      {
        id: 'e1fe6dd8-ba31-4d61-89e7-88639da4683d', // User.Read
        name: 'User.Read',
        type: 'Scope',
        description: 'Sign in and read user profile',
      },
    ],
  },
  azureManagement: {
    name: 'Azure Service Management',
    resourceAppId: '797f4846-ba00-4fd7-ba43-dac1f8f63013',
    permissions: [
      {
        id: '41094075-9dad-400e-a0bd-54e686782033', // user_impersonation
        name: 'user_impersonation',
        type: 'Scope',
        description: 'Access Azure Service Management as organization user',
      },
    ],
  },
};

/**
 * Generate PowerShell script to create Azure AD App Registration
 */
export function generateAppRegistrationScript(
  config: AppRegistrationConfig = defaultAppConfig
): string {
  return `# Azure AD App Registration Script for AzureMate
# This script creates an App Registration with the required permissions
# Run this in Azure Cloud Shell (PowerShell) or local PowerShell with Az module

# Ensure you're logged in
$context = Get-AzContext
if (-not $context) {
    Write-Host "Please login to Azure first..." -ForegroundColor Yellow
    Connect-AzAccount
}

Write-Host "Creating App Registration: ${config.appName}" -ForegroundColor Cyan

# Define required permissions
$graphPermissions = @(
    @{
        Id = "e1fe6dd8-ba31-4d61-89e7-88639da4683d"  # User.Read
        Type = "Scope"
    }
)

$azureManagementPermissions = @(
    @{
        Id = "41094075-9dad-400e-a0bd-54e686782033"  # user_impersonation
        Type = "Scope"
    }
)

# Create the required resource access objects
$requiredResourceAccess = @(
    @{
        ResourceAppId = "00000003-0000-0000-c000-000000000000"  # Microsoft Graph
        ResourceAccess = $graphPermissions
    },
    @{
        ResourceAppId = "797f4846-ba00-4fd7-ba43-dac1f8f63013"  # Azure Service Management
        ResourceAccess = $azureManagementPermissions
    }
)

# Create the app registration
$app = New-AzADApplication \`
    -DisplayName "${config.appName}" \`
    -SPARedirectUri "${config.redirectUri}" \`
    -RequiredResourceAccess $requiredResourceAccess

if ($app) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "App Registration Created Successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Application (Client) ID:" -ForegroundColor Yellow
    Write-Host $app.AppId -ForegroundColor White
    Write-Host ""
    Write-Host "Copy this Client ID and paste it into AzureMate." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Copy the Client ID above"
    Write-Host "2. Paste it into AzureMate's connection wizard"
    Write-Host "3. Sign in with your Microsoft account"
    Write-Host ""

    # Output for easy copying
    Write-Host "VITE_AZURE_CLIENT_ID=$($app.AppId)" -ForegroundColor Magenta
} else {
    Write-Host "Failed to create App Registration" -ForegroundColor Red
}
`;
}

/**
 * Generate Azure CLI script (alternative to PowerShell)
 */
export function generateAzureCliScript(
  config: AppRegistrationConfig = defaultAppConfig
): string {
  return `#!/bin/bash
# Azure AD App Registration Script for AzureMate (Azure CLI)
# Run this in Azure Cloud Shell (Bash) or local terminal with Azure CLI

# Ensure you're logged in
az account show > /dev/null 2>&1 || az login

echo "Creating App Registration: ${config.appName}"

# Create the app registration with SPA redirect
APP_ID=$(az ad app create \\
    --display-name "${config.appName}" \\
    --sign-in-audience "AzureADMultipleOrgs" \\
    --enable-access-token-issuance false \\
    --enable-id-token-issuance true \\
    --web-redirect-uris "" \\
    --query appId -o tsv)

# Add SPA platform configuration
az ad app update --id $APP_ID --set spa='{"redirectUris":["${config.redirectUri}"]}'

# Add Microsoft Graph User.Read permission
az ad app permission add \\
    --id $APP_ID \\
    --api 00000003-0000-0000-c000-000000000000 \\
    --api-permissions e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope

# Add Azure Service Management user_impersonation permission
az ad app permission add \\
    --id $APP_ID \\
    --api 797f4846-ba00-4fd7-ba43-dac1f8f63013 \\
    --api-permissions 41094075-9dad-400e-a0bd-54e686782033=Scope

echo ""
echo "========================================"
echo "App Registration Created Successfully!"
echo "========================================"
echo ""
echo "Application (Client) ID:"
echo "$APP_ID"
echo ""
echo "Copy this Client ID and paste it into AzureMate."
echo ""
echo "VITE_AZURE_CLIENT_ID=$APP_ID"
`;
}

/**
 * Verify Azure connection by testing API access
 */
export interface ConnectionVerificationResult {
  success: boolean;
  userProfile?: {
    displayName: string;
    email: string;
  };
  subscriptionCount?: number;
  error?: string;
  details: {
    graphApiAccess: boolean;
    azureApiAccess: boolean;
    tokenAcquisition: boolean;
  };
}

/**
 * Instructions for manual app registration
 */
export const manualSetupInstructions = [
  {
    step: 1,
    title: 'Go to Azure Portal',
    description:
      'Navigate to portal.azure.com and sign in with your Microsoft account.',
    link: 'https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
  },
  {
    step: 2,
    title: 'Create New Registration',
    description: 'Click "New registration" and enter the following:',
    details: [
      'Name: AzureMate (or your preferred name)',
      'Supported account types: Accounts in any organizational directory',
      'Redirect URI: Select "Single-page application (SPA)" and enter your app URL',
    ],
  },
  {
    step: 3,
    title: 'Configure API Permissions',
    description: 'Go to "API permissions" and add:',
    details: [
      'Microsoft Graph → User.Read (Delegated)',
      'Azure Service Management → user_impersonation (Delegated)',
    ],
  },
  {
    step: 4,
    title: 'Copy Client ID',
    description:
      'From the "Overview" page, copy the "Application (client) ID" and paste it below.',
  },
];

/**
 * Check if a client ID looks valid (basic format validation)
 */
export function isValidClientIdFormat(clientId: string): boolean {
  // Azure AD Client IDs are GUIDs
  const guidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return guidRegex.test(clientId.trim());
}

/**
 * Get the Azure Portal link to register a new app
 */
export function getAppRegistrationPortalLink(): string {
  return 'https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/CreateApplicationBlade';
}

/**
 * Get the Azure Cloud Shell link
 */
export function getCloudShellLink(): string {
  return 'https://shell.azure.com';
}
