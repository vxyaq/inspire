Write-Host "Reverting Discord optimization..."
$settingsPath = Join-Path $env:APPDATA "discord\settings.json"
if (Test-Path $settingsPath) {
    $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
    $settings | Add-Member -NotePropertyName "enableHardwareAcceleration" -NotePropertyValue $true -Force
    $settings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath -Encoding UTF8
}
Write-Host "Discord optimization reverted."
