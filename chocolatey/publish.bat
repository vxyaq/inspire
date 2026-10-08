@echo off
REM Chocolatey Package Publisher
REM This script packs and publishes the Inspire Chocolatey package

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Inspire Chocolatey Package Publisher
echo ========================================
echo.

REM Check if we're in the chocolatey directory
if not exist "inspire.nuspec" (
    echo ERROR: inspire.nuspec not found. Please run this from the chocolatey directory.
    exit /b 1
)

REM Get the version from nuspec using PowerShell for better XML parsing
for /f "delims=" %%i in ('powershell -Command "[xml]$xml = Get-Content 'inspire.nuspec'; Write-Output $xml.package.metadata.version"') do (
    set VERSION=%%i
)

if not defined VERSION (
    echo ERROR: Could not extract version from inspire.nuspec
    exit /b 1
)

echo Version: !VERSION!
echo.

REM Pack the package
echo [1/3] Packing Chocolatey package...
choco pack inspire.nuspec

if !errorlevel! neq 0 (
    echo ERROR: Failed to pack the package
    exit /b 1
)

set NUPKG=inspire.!VERSION!.nupkg

if not exist "!NUPKG!" (
    echo ERROR: Package file not created: !NUPKG!
    echo.
    echo Checking for alternate filenames...
    dir inspire.*.nupkg 2>nul
    if !errorlevel! neq 0 (
        echo No .nupkg files found
    )
    exit /b 1
)

echo Created: !NUPKG!
echo.

REM Check for API key in root .env file first, then local .env, then environment variable
if exist "..\.env" (
    echo [2/3] Loading API key from root .env file...
    for /f "eol=# tokens=1,2 delims==" %%a in (..\.env) do (
        if "%%a"=="CHOCOLATEY_API_KEY" set "CHOCOLATEY_API_KEY=%%b"
    )
) else if exist ".env" (
    echo [2/3] Loading API key from local .env file...
    for /f "eol=# tokens=1,2 delims==" %%a in (.env) do (
        if "%%a"=="CHOCOLATEY_API_KEY" set "CHOCOLATEY_API_KEY=%%b"
    )
) else (
    echo [2/3] Checking for API key in environment...
)

if not defined CHOCOLATEY_API_KEY (
    echo.
    echo ERROR: CHOCOLATEY_API_KEY not found!
    echo.
    echo Please set your API key using one of these methods:
    echo.
    echo   Option A - Root .env file ^(recommended^):
    echo     File: ..\.env
    echo     Add line: CHOCOLATEY_API_KEY=your_api_key_here
    echo.
    echo   Option B - Local .env file in chocolatey directory:
    echo     File: .env
    echo     Add line: CHOCOLATEY_API_KEY=your_api_key_here
    echo.
    echo   Option C - Set environment variable:
    echo     setx CHOCOLATEY_API_KEY your_api_key_here
    echo.
    echo Get your API key from: https://community.chocolatey.org/account
    echo.
    pause
    exit /b 1
)

echo API key loaded successfully.
echo.

REM Push to Chocolatey
echo [3/3] Publishing to Chocolatey Community Repository...
echo This may take a few moments...
echo.

choco push "!NUPKG!" --key=%CHOCOLATEY_API_KEY% --source="https://push.chocolatey.org/"

if !errorlevel! neq 0 (
    echo.
    echo ERROR: Failed to publish package
    exit /b 1
)

echo.
echo ========================================
echo   SUCCESS! Package published!
echo ========================================
echo.
echo Package: !NUPKG!
echo Version: !VERSION!
echo Repository: https://community.chocolatey.org/packages/inspire
echo.
pause
