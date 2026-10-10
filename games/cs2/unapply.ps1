$ErrorActionPreference = "Stop"

try {
  Remove-Item -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\cs2.exe" -Force -ErrorAction SilentlyContinue
} catch {
  Write-Output "Could not remove persistent process priority (admin required)."
}

$gameConfigPath = "HKCU:\System\GameConfigStore"
$gameBarPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR"
New-Item -Path $gameConfigPath -Force | Out-Null
New-Item -Path $gameBarPath -Force | Out-Null
New-ItemProperty -Path $gameConfigPath -Name "GameDVR_Enabled" -PropertyType DWord -Value 1 -Force | Out-Null
New-ItemProperty -Path $gameBarPath -Name "AppCaptureEnabled" -PropertyType DWord -Value 1 -Force | Out-Null

try {
  $gpuPreferencesPath = "HKCU:\Software\Microsoft\DirectX\UserGpuPreferences"
  if (Test-Path $gpuPreferencesPath) {
    $props = Get-ItemProperty -Path $gpuPreferencesPath -ErrorAction SilentlyContinue
    foreach ($prop in $props.PSObject.Properties) {
      if ($prop.Name -like "*cs2.exe*") {
        Remove-ItemProperty -Path $gpuPreferencesPath -Name $prop.Name -ErrorAction SilentlyContinue
      }
    }
  }
} catch { }

$steamPath = "C:\Program Files (x86)\Steam"
try {
    $regSteam = (Get-ItemProperty -Path "HKCU:\Software\Valve\Steam" -Name "SteamPath" -ErrorAction Stop).SteamPath
    if ($regSteam) { $steamPath = $regSteam }
} catch { }

$reverted = $false
$userdataDir = Join-Path $steamPath "userdata"
if (Test-Path $userdataDir) {
    Get-ChildItem -Path $userdataDir -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $cfgDir = Join-Path $_.FullName "730\local\cfg"
        $videoFile = Join-Path $cfgDir "cs2_video.txt"
        $videoBackup = "$videoFile.k3d.bak"
        if (Test-Path $videoBackup) {
            Copy-Item $videoBackup $videoFile -Force -ErrorAction SilentlyContinue
            Remove-Item $videoBackup -Force -ErrorAction SilentlyContinue
            $reverted = $true
        }
        $configFile = Join-Path $cfgDir "config.cfg"
        $configBackup = "$configFile.k3d.bak"
        if (Test-Path $configBackup) {
            Copy-Item $configBackup $configFile -Force -ErrorAction SilentlyContinue
            Remove-Item $configBackup -Force -ErrorAction SilentlyContinue
            $reverted = $true
        }
    }
}

if ($reverted) {
    Write-Output "CS2_REVERTED"
} else {
    Write-Output "CS2_NO_BACKUP"
}

$processes = Get-Process -Name "cs2" -ErrorAction SilentlyContinue
if ($processes) {
    Write-Output "CS2_RUNNING_PRIORITY_RESETS_ON_RESTART"
}
