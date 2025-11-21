#Requires -Version 5.1
<#
.SYNOPSIS
    Azure Architect Mate - Windows Deployment Script

.DESCRIPTION
    This script automates the deployment of Azure Architect Mate on Windows.
    It supports both Docker container deployment and Electron desktop app builds.

.PARAMETER Mode
    Deployment mode: 'docker', 'electron', 'both', or 'dev'

.PARAMETER ClientId
    Azure AD Application Client ID (optional, can be set in .env file)

.PARAMETER SkipPrerequisites
    Skip prerequisite checks

.EXAMPLE
    .\deploy-windows.ps1 -Mode docker

.EXAMPLE
    .\deploy-windows.ps1 -Mode electron -ClientId "your-client-id-here"

.NOTES
    Author: Azure Architect Mate
    Version: 1.0.0
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('docker', 'electron', 'both', 'dev')]
    [string]$Mode = 'docker',

    [Parameter(Mandatory=$false)]
    [string]$ClientId = '',

    [Parameter(Mandatory=$false)]
    [switch]$SkipPrerequisites
)

# Script configuration
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Colors for output
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Write-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$Message)
    Write-Host "[*] $Message" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Message)
    Write-Host "[+] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[!] $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "    $Message" -ForegroundColor Gray
}

# Banner
function Show-Banner {
    Write-Host ""
    Write-Host "    _                         __  __       _        " -ForegroundColor Blue
    Write-Host "   / \   _____   _ _ __ ___  |  \/  | __ _| |_ ___  " -ForegroundColor Blue
    Write-Host "  / _ \ |_  / | | | '__/ _ \ | |\/| |/ _`` | __/ _ \ " -ForegroundColor Blue
    Write-Host " / ___ \ / /| |_| | | |  __/ | |  | | (_| | ||  __/ " -ForegroundColor Blue
    Write-Host "/_/   \_/___|\__,_|_|  \___| |_|  |_|\__,_|\__\___| " -ForegroundColor Blue
    Write-Host ""
    Write-Host "        Azure Architect Mate - Deployment Script" -ForegroundColor White
    Write-Host "        ========================================" -ForegroundColor Gray
    Write-Host ""
}

# Check if running as administrator (needed for some operations)
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Check prerequisites
function Test-Prerequisites {
    Write-Header "Checking Prerequisites"

    $allPassed = $true

    # Check Node.js
    Write-Step "Checking Node.js..."
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            Write-Success "Node.js found: $nodeVersion"
        } else {
            throw "Not found"
        }
    } catch {
        Write-Error "Node.js not found. Please install from https://nodejs.org/"
        $allPassed = $false
    }

    # Check npm
    Write-Step "Checking npm..."
    try {
        $npmVersion = npm --version 2>$null
        if ($npmVersion) {
            Write-Success "npm found: $npmVersion"
        } else {
            throw "Not found"
        }
    } catch {
        Write-Error "npm not found. Please install Node.js from https://nodejs.org/"
        $allPassed = $false
    }

    # Check Docker (only for docker mode)
    if ($Mode -eq 'docker' -or $Mode -eq 'both') {
        Write-Step "Checking Docker..."
        try {
            $dockerVersion = docker --version 2>$null
            if ($dockerVersion) {
                Write-Success "Docker found: $dockerVersion"

                # Check if Docker is running
                $dockerInfo = docker info 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Docker daemon is running"
                } else {
                    Write-Error "Docker is installed but not running. Please start Docker Desktop."
                    $allPassed = $false
                }
            } else {
                throw "Not found"
            }
        } catch {
            Write-Error "Docker not found. Please install Docker Desktop from https://docker.com/"
            $allPassed = $false
        }
    }

    # Check Git (optional but recommended)
    Write-Step "Checking Git..."
    try {
        $gitVersion = git --version 2>$null
        if ($gitVersion) {
            Write-Success "Git found: $gitVersion"
        } else {
            throw "Not found"
        }
    } catch {
        Write-Info "Git not found (optional). Install from https://git-scm.com/ for version control."
    }

    return $allPassed
}

# Setup environment file
function Set-Environment {
    Write-Header "Setting Up Environment"

    $envFile = Join-Path $PSScriptRoot ".env"
    $envExample = Join-Path $PSScriptRoot ".env.example"

    # Check if .env exists
    if (Test-Path $envFile) {
        Write-Success ".env file already exists"

        # Check if it has a Client ID
        $envContent = Get-Content $envFile -Raw
        if ($envContent -match "VITE_AZURE_CLIENT_ID=([^\s]+)") {
            $existingClientId = $Matches[1]
            if ($existingClientId -and $existingClientId -ne "your-application-client-id-here") {
                Write-Success "Azure Client ID is configured"
                return $true
            }
        }
    }

    # Create or update .env file
    if ($ClientId) {
        Write-Step "Creating .env file with provided Client ID..."

        $envContent = @"
# Azure AD App Registration Configuration
# Generated by deploy-windows.ps1

# Your Azure AD Application (Client) ID
VITE_AZURE_CLIENT_ID=$ClientId

# Tenant ID (organizations = multi-tenant)
VITE_AZURE_TENANT_ID=organizations

# Redirect URI (must match Azure Portal configuration)
VITE_AZURE_REDIRECT_URI=http://localhost:3000
"@
        $envContent | Out-File -FilePath $envFile -Encoding UTF8
        Write-Success ".env file created with Client ID"
        return $true
    } elseif (Test-Path $envExample) {
        Write-Step "Copying .env.example to .env..."
        Copy-Item $envExample $envFile
        Write-Info ".env file created from template"
        Write-Info "Please edit .env and add your Azure AD Client ID"
        Write-Info "See AZURE_AD_SETUP.md for instructions"
        return $true
    } else {
        Write-Error "No .env.example found and no Client ID provided"
        Write-Info "Please create a .env file with VITE_AZURE_CLIENT_ID"
        return $false
    }
}

# Install dependencies
function Install-Dependencies {
    Write-Header "Installing Dependencies"

    Write-Step "Running npm install..."
    npm install

    if ($LASTEXITCODE -eq 0) {
        Write-Success "Dependencies installed successfully"
        return $true
    } else {
        Write-Error "Failed to install dependencies"
        return $false
    }
}

# Build the application
function Build-Application {
    Write-Header "Building Application"

    Write-Step "Running npm build..."
    npm run build

    if ($LASTEXITCODE -eq 0) {
        Write-Success "Application built successfully"
        return $true
    } else {
        Write-Error "Build failed"
        return $false
    }
}

# Deploy with Docker
function Deploy-Docker {
    Write-Header "Deploying with Docker"

    # Stop existing container if running
    Write-Step "Stopping existing container (if any)..."
    docker-compose down 2>$null

    # Build and start
    Write-Step "Building Docker image..."
    docker-compose build

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker build failed"
        return $false
    }

    Write-Step "Starting container..."
    docker-compose up -d

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start container"
        return $false
    }

    # Wait for container to be ready
    Write-Step "Waiting for application to start..."
    Start-Sleep -Seconds 3

    # Check if container is running
    $containerStatus = docker ps --filter "name=azure-architect-mate" --format "{{.Status}}"
    if ($containerStatus -like "*Up*") {
        Write-Success "Docker container is running!"
        Write-Host ""
        Write-Host "  Application URL: " -NoNewline
        Write-Host "http://localhost:3000" -ForegroundColor Green
        Write-Host ""
        return $true
    } else {
        Write-Error "Container failed to start. Check logs with: docker-compose logs"
        return $false
    }
}

# Build Electron app
function Build-Electron {
    Write-Header "Building Electron Desktop App"

    Write-Step "Building Electron installer for Windows..."
    npm run electron:build:win

    if ($LASTEXITCODE -eq 0) {
        Write-Success "Electron build completed!"

        $outputDir = Join-Path $PSScriptRoot "electron-dist"
        Write-Host ""
        Write-Host "  Installers available in: " -NoNewline
        Write-Host $outputDir -ForegroundColor Green
        Write-Host ""

        # List generated files
        if (Test-Path $outputDir) {
            Write-Info "Generated files:"
            Get-ChildItem $outputDir -Filter "*.exe" | ForEach-Object {
                Write-Info "  - $($_.Name)"
            }
        }

        return $true
    } else {
        Write-Error "Electron build failed"
        return $false
    }
}

# Start development mode
function Start-Development {
    Write-Header "Starting Development Mode"

    Write-Step "Starting Vite dev server and Electron..."
    Write-Info "Press Ctrl+C to stop"
    Write-Host ""

    npm run electron:dev
}

# Main execution
function Main {
    Show-Banner

    # Change to script directory
    Set-Location $PSScriptRoot

    Write-Info "Deployment Mode: $Mode"
    Write-Info "Working Directory: $PSScriptRoot"
    Write-Host ""

    # Check prerequisites
    if (-not $SkipPrerequisites) {
        $prereqOk = Test-Prerequisites
        if (-not $prereqOk) {
            Write-Host ""
            Write-Error "Prerequisites check failed. Please install missing components."
            exit 1
        }
    }

    # Setup environment
    $envOk = Set-Environment
    if (-not $envOk) {
        Write-Host ""
        Write-Error "Environment setup failed."
        exit 1
    }

    # Install dependencies
    $depsOk = Install-Dependencies
    if (-not $depsOk) {
        exit 1
    }

    # Execute based on mode
    switch ($Mode) {
        'docker' {
            $buildOk = Build-Application
            if ($buildOk) {
                Deploy-Docker
            }
        }
        'electron' {
            Build-Electron
        }
        'both' {
            $buildOk = Build-Application
            if ($buildOk) {
                Deploy-Docker
                Build-Electron
            }
        }
        'dev' {
            Start-Development
        }
    }

    Write-Header "Deployment Complete"

    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host ""

    if ($Mode -eq 'docker' -or $Mode -eq 'both') {
        Write-Host "  1. Open http://localhost:3000 in your browser" -ForegroundColor White
        Write-Host "  2. Click 'Connect Entra ID' to sign in with Microsoft 365" -ForegroundColor White
        Write-Host ""
    }

    if ($Mode -eq 'electron' -or $Mode -eq 'both') {
        Write-Host "  1. Run the installer from electron-dist/" -ForegroundColor White
        Write-Host "  2. Launch 'Azure Architect Mate' from Start Menu" -ForegroundColor White
        Write-Host ""
    }

    Write-Host "  For Azure AD setup, see: AZURE_AD_SETUP.md" -ForegroundColor Gray
    Write-Host ""
}

# Run main
try {
    Main
} catch {
    Write-Host ""
    Write-Error "An error occurred: $_"
    Write-Host ""
    Write-Host "Stack Trace:" -ForegroundColor Gray
    Write-Host $_.ScriptStackTrace -ForegroundColor Gray
    exit 1
}
