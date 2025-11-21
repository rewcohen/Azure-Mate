# Azure AD App Registration Setup Guide

This guide will walk you through creating an Azure AD App Registration for Azure Architect Mate with multi-tenant support and admin consent capabilities.

## Prerequisites

- Azure subscription
- Global Administrator or Application Administrator role in Azure AD/Entra ID

## Step 1: Create App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** (or **Microsoft Entra ID**)
3. Click **App registrations** in the left menu
4. Click **+ New registration**

### Registration Details:

- **Name**: `Azure Architect Mate`
- **Supported account types**: Select **"Accounts in any organizational directory (Any Azure AD directory - Multitenant)"**
- **Redirect URI**:
  - Platform: **Single-page application (SPA)**
  - URI: `http://localhost:3000`

5. Click **Register**

## Step 2: Note Your Application Details

After registration, you'll see the Overview page. **Copy and save these values**:

- **Application (client) ID**: (e.g., `12345678-1234-1234-1234-123456789abc`)
- **Directory (tenant) ID**: (e.g., `87654321-4321-4321-4321-cba987654321`)

You'll need these for the `.env` file.

## Step 3: Configure Additional Redirect URIs

1. In your app registration, click **Authentication** in the left menu
2. Under **Single-page application**, add additional redirect URIs:
   - `http://localhost:3000/redirect`
   - `http://localhost:5173` (for Vite dev server)
   - `http://localhost:5173/redirect`
   - Add your production URL when deployed (e.g., `https://yourdomain.com`)

3. Under **Implicit grant and hybrid flows**, ensure these are **NOT** checked (MSAL uses modern auth flow):
   - ❌ Access tokens
   - ❌ ID tokens

4. Click **Save**

## Step 4: Configure API Permissions

1. Click **API permissions** in the left menu
2. You should see **Microsoft Graph > User.Read** already added (default)
3. Click **+ Add a permission**

### Add Microsoft Graph Permissions:

4. Click **Microsoft Graph**
5. Click **Delegated permissions**
6. Search for and add:
   - ✅ **User.Read** (Read user profile - already there)
   - ✅ **offline_access** (Maintain access to data)

### Add Azure Service Management Permissions:

7. Click **+ Add a permission** again
8. Click **Azure Service Management**
9. Click **Delegated permissions**
10. Select:
    - ✅ **user_impersonation** (Access Azure Service Management as organization users)

### Summary of Permissions:
- `User.Read` - Read signed-in user's profile
- `offline_access` - Refresh tokens for persistent sessions
- `https://management.azure.com/user_impersonation` - Access Azure Resource Manager APIs

## Step 5: Configure Admin Consent (For Global Administrators)

These permissions require admin consent for best experience:

### Option A: Admin Consent URL (Recommended)
1. Click **API permissions**
2. Click **Grant admin consent for [Your Organization]** (requires Global Admin role)
3. Click **Yes** to confirm

### Option B: Self-Service Admin Consent Flow
If you don't grant consent now, the app will request it during first login. Global Administrators will see an admin consent prompt and can approve on behalf of their organization.

**Admin Consent URL Format:**
```
https://login.microsoftonline.com/organizations/adminconsent
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=http://localhost:3000
```

Replace `YOUR_CLIENT_ID` with your Application ID from Step 2.

## Step 6: Configure Token Configuration (Optional but Recommended)

1. Click **Token configuration** in the left menu
2. Click **+ Add optional claim**
3. Select **ID**
4. Check these claims:
   - ✅ `email`
   - ✅ `preferred_username`
5. Click **Add**
6. When prompted about Microsoft Graph permissions, check **"Turn on the Microsoft Graph email, profile permission"**
7. Click **Add**

## Step 7: Create Environment File

Create a `.env` file in the root of your project:

```env
# Azure AD Application Configuration
VITE_AZURE_CLIENT_ID=YOUR_APPLICATION_CLIENT_ID_HERE
VITE_AZURE_TENANT_ID=organizations
VITE_AZURE_REDIRECT_URI=http://localhost:3000

# Set to 'true' to require admin consent
VITE_AZURE_REQUIRE_ADMIN_CONSENT=false
```

Replace `YOUR_APPLICATION_CLIENT_ID_HERE` with the Application (client) ID from Step 2.

**Important Notes:**
- Use `VITE_` prefix for environment variables in Vite
- `VITE_AZURE_TENANT_ID=organizations` enables multi-tenant support
- For single-tenant, use your specific tenant ID instead

## Step 8: Add .env to .gitignore

Ensure your `.env` file is in `.gitignore` to avoid committing secrets:

```bash
echo .env >> .gitignore
```

## Step 9: Production Deployment

When deploying to production:

1. Add your production URL to **Redirect URIs** in Azure Portal
2. Set environment variables in your hosting environment:
   - Docker: Add to `docker-compose.yml` or pass via command line
   - Azure App Service: Configure in Application Settings
   - Other hosts: Follow their environment variable documentation

Example Docker Compose with environment variables:
```yaml
environment:
  - VITE_AZURE_CLIENT_ID=${AZURE_CLIENT_ID}
  - VITE_AZURE_TENANT_ID=organizations
  - VITE_AZURE_REDIRECT_URI=https://yourdomain.com
```

## Testing Admin Consent Flow

1. Start the application
2. Click "Connect Entra ID"
3. Sign in as a Global Administrator
4. If admin consent wasn't granted in Step 5, you'll see an admin consent screen
5. Review permissions and click **Accept** to consent on behalf of your organization
6. All users in your organization can now sign in without individual consent prompts

## Troubleshooting

### "AADSTS50011: The redirect URI specified in the request does not match..."
- Check that your redirect URI in the code matches exactly what's registered in Azure Portal
- Ensure there are no trailing slashes or typos

### "AADSTS65001: The user or administrator has not consented..."
- Run the admin consent URL from Step 5
- Or have a Global Administrator sign in and consent during first use

### "AADSTS700016: Application not found in the directory"
- Verify your Client ID is correct in the `.env` file
- Ensure the app registration hasn't been deleted

### Users from other organizations can't sign in
- Verify "Accounts in any organizational directory (Multitenant)" was selected
- Check that tenant ID is set to "organizations" not a specific tenant

## Security Best Practices

1. ✅ Never commit `.env` file to version control
2. ✅ Use different app registrations for dev/staging/production
3. ✅ Regularly review and rotate client secrets (if using confidential client flow)
4. ✅ Monitor sign-in logs in Azure AD for suspicious activity
5. ✅ Use Conditional Access policies to restrict access if needed
6. ✅ Implement proper token caching and refresh logic

## Next Steps

After completing this setup:
1. Install the required npm packages (MSAL, Azure SDKs)
2. Configure MSAL in your application
3. Implement authentication flows
4. Test with real Microsoft 365 accounts

## Resources

- [Microsoft Identity Platform Documentation](https://learn.microsoft.com/en-us/azure/active-directory/develop/)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [Azure RBAC Documentation](https://learn.microsoft.com/en-us/azure/role-based-access-control/)
- [Admin Consent Workflow](https://learn.microsoft.com/en-us/azure/active-directory/manage-apps/configure-admin-consent-workflow)
