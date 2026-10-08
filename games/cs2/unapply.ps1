Write-Host "Reverting CS2 optimization..."
$steamPath = "C:\Program Files (x86)\Steam"
try {
    $regSteam = (Get-ItemProperty -Path "HKCU:\Software\Valve\Steam" -Name "SteamPath" -ErrorAction Stop).SteamPath
    if ($regSteam) { $steamPath = $regSteam }
} catch { }
$userdataDir = Join-Path $steamPath "userdata"
if (Test-Path $userdataDir) {
    Get-ChildItem -Path $userdataDir -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $videoFile = Join-Path $_.FullName "730\local\cfg\cs2_video.txt"
        $backupFile = "$videoFile.k3d.bak"
        if (Test-Path $backupFile) {
            Copy-Item $backupFile $videoFile -Force -ErrorAction SilentlyContinue
        }
    }
}
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_Enabled" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR" -Name "AppCaptureEnabled" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
Write-Host "CS2 optimization reverted."
