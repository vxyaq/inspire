$ErrorActionPreference = "Stop"
$processes = Get-Process -Name "FiveM", "FiveM_GTAProcess", "FiveM_ChromeBrowser" -ErrorAction SilentlyContinue

if (-not $processes) {
  Write-Output "FIVEM_NOT_RUNNING"
} else {
  $processes | ForEach-Object {
    try { $_.PriorityClass = "High" } catch { Write-Output "Could not set process priority for $($_.Id)" }
  }
}

$fivemPath = Join-Path $env:LOCALAPPDATA "FiveM\FiveM.exe"
if ((Test-Path $fivemPath) -and $processes) {
  try {
    $gpuPreferencesPath = "HKCU:\Software\Microsoft\DirectX\UserGpuPreferences"
    New-Item -Path $gpuPreferencesPath -Force | Out-Null
    New-ItemProperty -Path $gpuPreferencesPath -Name $fivemPath -PropertyType String -Value "GpuPreference=2;" -Force | Out-Null
  } catch {
    Write-Output "Could not set the Windows high-performance GPU preference."
  }
}

if (-not $processes) {
  $cacheDirs = @(
    (Join-Path $env:LOCALAPPDATA "FiveM\FiveM.app\cache"),
    (Join-Path $env:LOCALAPPDATA "FiveM\FiveM.app\crashes"),
    (Join-Path $env:LOCALAPPDATA "FiveM\FiveM.app\logs")
  )
  foreach ($dir in $cacheDirs) {
    if (Test-Path $dir) {
      Remove-Item (Join-Path $dir "*") -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

$gameConfigPath = "HKCU:\System\GameConfigStore"
$gameBarPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR"
New-Item -Path $gameConfigPath -Force | Out-Null
New-Item -Path $gameBarPath -Force | Out-Null
New-ItemProperty -Path $gameConfigPath -Name "GameDVR_Enabled" -PropertyType DWord -Value 0 -Force | Out-Null
New-ItemProperty -Path $gameBarPath -Name "AppCaptureEnabled" -PropertyType DWord -Value 0 -Force | Out-Null

Write-Output "FIVEM_OPTIMIZED"
