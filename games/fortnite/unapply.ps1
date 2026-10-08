Write-Host "Reverting Fortnite optimization..."
$configFile = Join-Path $env:LOCALAPPDATA "FortniteGame\Saved\Config\WindowsClient\GameUserSettings.ini"
$backupFile = "$configFile.k3d.bak"
if (Test-Path $backupFile) {
    Copy-Item $backupFile $configFile -Force -ErrorAction SilentlyContinue
}
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_Enabled" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR" -Name "AppCaptureEnabled" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
Write-Host "Fortnite optimization reverted."
