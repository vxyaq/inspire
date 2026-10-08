Write-Host "Optimizing Discord..."
Get-Process -Name Discord -ErrorAction SilentlyContinue | Stop-Process -Force
$discordData = Join-Path $env:APPDATA "discord"
$settingsPath = Join-Path $discordData "settings.json"
if (Test-Path $settingsPath) {
    $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
    $settings | Add-Member -NotePropertyName "enableHardwareAcceleration" -NotePropertyValue $false -Force
    $settings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath -Encoding UTF8
}
@("Cache", "Code Cache", "GPUCache") | ForEach-Object {
    $cachePath = Join-Path $discordData $_
    if (Test-Path $cachePath) {
        Remove-Item $cachePath -Recurse -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "Discord optimized. Open Discord again when ready."
