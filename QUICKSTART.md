# Azure Architect Mate - Quick Start Guide

## Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **Docker Desktop** (for container deployment) ([Download](https://docker.com/))
- **Azure AD App Registration** (see [AZURE_AD_SETUP.md](AZURE_AD_SETUP.md))

## Quick Deploy

### Option 1: Double-click Deployment (Easiest)

1. Double-click `deploy.bat`
2. Follow the prompts
3. Open http://localhost:3000

### Option 2: Command Line Deployment

**Deploy with Docker:**

```powershell
.\deploy.bat docker
```

**Build Electron Desktop App:**

```powershell
.\deploy.bat electron
```

**Deploy Both Docker and Electron:**

```powershell
.\deploy.bat both
```

**Development Mode (Hot Reload):**

```powershell
.\deploy.bat dev
```

### Option 3: PowerShell Script (Advanced)

```powershell
# Docker deployment
.\deploy-windows.ps1 -Mode docker

# With Azure AD Client ID
.\deploy-windows.ps1 -Mode docker -ClientId "your-client-id-here"

# Electron build
.\deploy-windows.ps1 -Mode electron

# Skip prerequisite checks
.\deploy-windows.ps1 -Mode docker -SkipPrerequisites
```

## Manual Deployment

### Docker Container

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Start Docker container
docker-compose up -d

# View logs
docker-compose logs -f
```

Access at: http://localhost:3000

### Electron Desktop App

```bash
# Install dependencies
npm install

# Development mode (with hot reload)
npm run electron:dev

# Build Windows installer
npm run electron:build:win
```

Installers will be in `electron-dist/` folder.

## Azure AD Configuration

Before signing in with Microsoft 365, you need to:

1. **Create Azure AD App Registration** - Follow [AZURE_AD_SETUP.md](AZURE_AD_SETUP.md)
2. **Copy your Client ID** from Azure Portal
3. **Create .env file:**
   ```
   VITE_AZURE_CLIENT_ID=your-client-id-here
   VITE_AZURE_TENANT_ID=organizations
   VITE_AZURE_REDIRECT_URI=http://localhost:3000
   ```
4. **Rebuild** the application

Or use the deployment script with your Client ID:

```powershell
.\deploy.bat docker -clientid "your-client-id-here"
```

## Troubleshooting

### Docker Issues

**Container won't start:**

```bash
docker-compose logs
```

**Port 3000 in use:**

```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process
taskkill /PID <process_id> /F
```

### Authentication Issues

**"AADSTS50011: Redirect URI mismatch"**

- Ensure `http://localhost:3000` is registered in Azure Portal > App Registration > Authentication

**"Admin consent required"**

- Have a Global Administrator sign in first
- Or use the Admin Consent URL in the error message

**"No Azure subscriptions found"**

- Ensure your account has access to Azure subscriptions
- Check Azure Portal to verify subscription access

### Electron Issues

**App won't start:**

```bash
# Check for errors
npm run electron 2>&1
```

**Build fails:**

```bash
# Clean and rebuild
rm -rf node_modules dist electron-dist
npm install
npm run electron:build:win
```

## Useful Commands

| Command                      | Description                      |
| ---------------------------- | -------------------------------- |
| `npm run dev`                | Start Vite dev server            |
| `npm run build`              | Build for production             |
| `npm run electron`           | Launch Electron app              |
| `npm run electron:dev`       | Development mode with hot reload |
| `npm run electron:build:win` | Build Windows installer          |
| `docker-compose up -d`       | Start Docker container           |
| `docker-compose down`        | Stop Docker container            |
| `docker-compose logs -f`     | View container logs              |

## File Structure

```
Azure-Mate/
├── deploy.bat              # Windows deployment launcher
├── deploy-windows.ps1      # PowerShell deployment script
├── docker-compose.yml      # Docker Compose config
├── Dockerfile              # Docker build instructions
├── electron/
│   └── main.cjs            # Electron main process
├── config/
│   └── authConfig.ts       # MSAL configuration
├── services/
│   └── azureService.ts     # Azure API service
├── components/
│   └── ConnectWizard.tsx   # Authentication UI
├── .env.example            # Environment template
├── AZURE_AD_SETUP.md       # Azure AD setup guide
└── QUICKSTART.md           # This file
```

## Support

- **Azure Documentation**: https://docs.microsoft.com/azure
- **MSAL.js Documentation**: https://github.com/AzureAD/microsoft-authentication-library-for-js
- **Electron Documentation**: https://electronjs.org/docs
