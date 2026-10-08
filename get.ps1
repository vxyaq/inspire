
Clear-Host

$repo = "Parcoil/K3d Tweaks"
$apiUrl = "https://api.github.com/repos/$repo/releases/latest"
$headers = @{
    "User-Agent" = "K3d Tweaks-Fetcher"
    "Accept"     = "application/vnd.github.v3+json"
}

$downloadFolder = if ($PSScriptRoot) { $PSScriptRoot } else { Get-Location }

try {
    $release = Invoke-RestMethod -Uri $apiUrl -Headers $headers
}
catch {
    Write-Host "[X] Failed to contact GitHub API." -ForegroundColor Red
    exit 1
}

$tag = $release.tag_name
$versionLabel = $tag -replace "^v", ""

$asciiHeader = @"

███████╗██████╗  █████╗ ██████╗ ██╗  ██╗██╗     ███████╗
██╔════╝██╔══██╗██╔══██╗██╔══██╗██║ ██╔╝██║     ██╔════╝
███████╗██████╔╝███████║██████╔╝█████╔╝ ██║     █████╗
╚════██║██╔═══╝ ██╔══██║██╔══██╗██╔═██╗ ██║     ██╔══╝
███████║██║     ██║  ██║██║  ██║██║  ██╗███████╗███████╗
╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝
"@

Write-Host $asciiHeader -ForegroundColor Cyan
Write-Host "Version: v$versionLabel" -ForegroundColor Yellow
Write-Host ""

$asset = $release.assets | Where-Object { $_.name -match "^k3d-.*-setup\.exe$" }

if (-not $asset) {
    Write-Host "[X] No installer (.exe) found in latest release." -ForegroundColor Red
    exit 1
}

$fileName = $asset.name
$downloadPath = Join-Path $downloadFolder $fileName

Write-Host "[✓] Latest version: $tag" -ForegroundColor Green
Write-Host "[✓] Found installer: $fileName" -ForegroundColor Green
Write-Host "[>] Downloading to: $downloadPath" -ForegroundColor Cyan

$bitsService = Get-Service BITS
if ($bitsService.Status -ne "Running") {
    Write-Host "[>] Starting BITS service..." -ForegroundColor Cyan
    Start-Service BITS -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

try {
    Start-BitsTransfer -Source $asset.browser_download_url -Destination $downloadPath
    Write-Host "`n[✔] Download complete!" -ForegroundColor Green
}
catch {
    Write-Host "[>] BITS transfer failed, falling back to Invoke-WebRequest..." -ForegroundColor Yellow
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $downloadPath -UseBasicParsing
        Write-Host "`n[✔] Download complete!" -ForegroundColor Green
    }
    catch {
        Write-Host "[X] Failed to download installer." -ForegroundColor Red
        exit 1
    }
}

Write-Host "[🚀] Launching installer..." -ForegroundColor Magenta
try {
    $process = Start-Process -FilePath $downloadPath -Verb RunAs -PassThru
    $process.WaitForExit()
    Remove-Item -Path $downloadPath -Force
    Write-Host "[🗑️] Deleted installer after installer exited." -ForegroundColor DarkYellow
    Write-Host "[>] Thanks For using K3d Tweaks" -ForegroundColor Magenta
}
catch {
    Write-Host "[X] Failed to launch installer or delete file." -ForegroundColor Red
    exit 1
}
