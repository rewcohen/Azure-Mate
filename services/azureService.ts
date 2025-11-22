import {
  IPublicClientApplication,
  AccountInfo,
  InteractionRequiredAuthError,
} from '@azure/msal-browser';
import { ResourceNode } from '../types';
import {
  azureTokenRequest,
  apiEndpoints,
  apiVersions,
} from '../config/authConfig';

/**
 * Azure Subscription interface
 */
export interface AzureSubscription {
  subscriptionId: string;
  displayName: string;
  state: string;
  tenantId: string;
}

/**
 * Azure Tenant interface
 */
export interface AzureTenant {
  tenantId: string;
  displayName?: string;
  defaultDomain?: string;
}

/**
 * Azure Resource Group interface
 */
export interface AzureResourceGroup {
  id: string;
  name: string;
  location: string;
  tags?: Record<string, string>;
}

/**
 * User profile from Microsoft Graph
 */
export interface UserProfile {
  displayName: string;
  userPrincipalName: string;
  mail?: string;
  id: string;
}

/**
 * Get an access token for Azure Resource Manager API
 */
async function getAzureAccessToken(
  msalInstance: IPublicClientApplication,
  account: AccountInfo
): Promise<string> {
  try {
    // Try silent token acquisition first
    const response = await msalInstance.acquireTokenSilent({
      ...azureTokenRequest,
      account: account,
    });
    return response.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      // If silent fails, fall back to popup
      const response = await msalInstance.acquireTokenPopup({
        ...azureTokenRequest,
        account: account,
      });
      return response.accessToken;
    }
    throw error;
  }
}

/**
 * Get an access token for Microsoft Graph API
 */
async function getGraphAccessToken(
  msalInstance: IPublicClientApplication,
  account: AccountInfo
): Promise<string> {
  try {
    const response = await msalInstance.acquireTokenSilent({
      scopes: ['User.Read'],
      account: account,
    });
    return response.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      const response = await msalInstance.acquireTokenPopup({
        scopes: ['User.Read'],
        account: account,
      });
      return response.accessToken;
    }
    throw error;
  }
}

/**
 * Fetch user profile from Microsoft Graph
 */
export async function getUserProfile(
  msalInstance: IPublicClientApplication,
  account: AccountInfo
): Promise<UserProfile> {
  const accessToken = await getGraphAccessToken(msalInstance, account);

  const response = await fetch(`${apiEndpoints.graph}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch user profile: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * List all Azure subscriptions the user has access to
 */
export async function listSubscriptions(
  msalInstance: IPublicClientApplication,
  account: AccountInfo
): Promise<AzureSubscription[]> {
  const accessToken = await getAzureAccessToken(msalInstance, account);

  const response = await fetch(
    `${apiEndpoints.arm}/subscriptions?api-version=${apiVersions.subscriptions}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to list subscriptions: ${response.status} ${response.statusText}\n${errorText}`
    );
  }

  const data = await response.json();
  return data.value.map((sub: any) => ({
    subscriptionId: sub.subscriptionId,
    displayName: sub.displayName,
    state: sub.state,
    tenantId: sub.tenantId,
  }));
}

/**
 * List all Azure tenants the user has access to
 */
export async function listTenants(
  msalInstance: IPublicClientApplication,
  account: AccountInfo
): Promise<AzureTenant[]> {
  const accessToken = await getAzureAccessToken(msalInstance, account);

  const response = await fetch(
    `${apiEndpoints.arm}/tenants?api-version=${apiVersions.subscriptions}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to list tenants: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.value.map((tenant: any) => ({
    tenantId: tenant.tenantId,
    displayName: tenant.displayName,
    defaultDomain: tenant.defaultDomain,
  }));
}

/**
 * List resource groups in a subscription
 */
export async function listResourceGroups(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  subscriptionId: string
): Promise<AzureResourceGroup[]> {
  const accessToken = await getAzureAccessToken(msalInstance, account);

  const response = await fetch(
    `${apiEndpoints.arm}/subscriptions/${subscriptionId}/resourcegroups?api-version=${apiVersions.resourceGroups}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to list resource groups: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.value.map((rg: any) => ({
    id: rg.id,
    name: rg.name,
    location: rg.location,
    tags: rg.tags,
  }));
}

/**
 * List all resources in a subscription
 */
export async function listResources(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  subscriptionId: string
): Promise<ResourceNode[]> {
  const accessToken = await getAzureAccessToken(msalInstance, account);

  const response = await fetch(
    `${apiEndpoints.arm}/subscriptions/${subscriptionId}/resources?api-version=${apiVersions.resources}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to list resources: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.value.map((resource: any) => ({
    id: resource.id,
    name: resource.name,
    type: resource.type,
    location: resource.location,
    tags: resource.tags,
    properties: resource.properties || {},
  }));
}

/**
 * Get details for a specific resource
 */
export async function getResource(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  resourceId: string,
  apiVersion: string = '2021-04-01'
): Promise<any> {
  const accessToken = await getAzureAccessToken(msalInstance, account);

  const response = await fetch(
    `${apiEndpoints.arm}${resourceId}?api-version=${apiVersion}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to get resource: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Search resources using Azure Resource Graph (requires additional permissions)
 * Note: This requires the Resource Graph API permission
 */
export async function searchResources(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  subscriptionIds: string[],
  query: string
): Promise<ResourceNode[]> {
  const accessToken = await getAzureAccessToken(msalInstance, account);

  const response = await fetch(
    `${apiEndpoints.arm}/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptions: subscriptionIds,
        query: query,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to search resources: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.data.map((row: any) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    location: row.location,
    tags: row.tags,
    properties: row.properties || {},
  }));
}

/**
 * Validate subscription access
 * Returns true if the user has access to the subscription
 */
export async function validateSubscriptionAccess(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  subscriptionId: string
): Promise<boolean> {
  try {
    const accessToken = await getAzureAccessToken(msalInstance, account);

    const response = await fetch(
      `${apiEndpoints.arm}/subscriptions/${subscriptionId}?api-version=${apiVersions.subscriptions}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get the default location for a subscription (based on first resource group)
 */
export async function getDefaultLocation(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  subscriptionId: string
): Promise<string | null> {
  try {
    const resourceGroups = await listResourceGroups(
      msalInstance,
      account,
      subscriptionId
    );
    if (resourceGroups.length > 0) {
      return resourceGroups[0].location;
    }
    return null;
  } catch {
    return null;
  }
}
