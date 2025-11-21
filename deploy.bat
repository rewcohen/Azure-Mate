@echo off
setlocal enabledelayedexpansion

:: Azure Architect Mate - Windows Deployment Script
:: This batch file runs the PowerShell deployment script

title Azure Architect Mate - Deployment

echo.
echo ============================================================
echo   Azure Architect Mate - Windows Deployment
echo ============================================================
echo.

:: Check if PowerShell is available
where powershell >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] PowerShell is not installed or not in PATH
    echo Please install PowerShell and try again.
    pause
    exit /b 1
)

:: Parse command line arguments
set MODE=docker
set CLIENT_ID=
set SKIP_PREREQ=

:parse_args
if "%~1"=="" goto run_script
if /i "%~1"=="docker" set MODE=docker& shift& goto parse_args
if /i "%~1"=="electron" set MODE=electron& shift& goto parse_args
if /i "%~1"=="both" set MODE=both& shift& goto parse_args
if /i "%~1"=="dev" set MODE=dev& shift& goto parse_args
if /i "%~1"=="-clientid" set CLIENT_ID=%~2& shift& shift& goto parse_args
if /i "%~1"=="--clientid" set CLIENT_ID=%~2& shift& shift& goto parse_args
if /i "%~1"=="-skip" set SKIP_PREREQ=-SkipPrerequisites& shift& goto parse_args
shift
goto parse_args

:run_script
echo Deployment Mode: %MODE%
echo.

:: Build PowerShell command
set PS_CMD=-NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-windows.ps1" -Mode %MODE%

if not "%CLIENT_ID%"=="" (
    set PS_CMD=%PS_CMD% -ClientId "%CLIENT_ID%"
)

if not "%SKIP_PREREQ%"=="" (
    set PS_CMD=%PS_CMD% %SKIP_PREREQ%
)

:: Run PowerShell script
powershell %PS_CMD%

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Deployment failed with error code %errorlevel%
    pause
    exit /b %errorlevel%
)

echo.
echo Deployment completed successfully!
echo.
pause
