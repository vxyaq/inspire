$ErrorActionPreference = "Stop"
$processes = Get-Process -Name "FortniteClient-Win64-Shipping" -ErrorAction SilentlyContinue

if (-not $processes) {
  Write-Output "FORTNITE_NOT_RUNNING"
  exit 0
}

$processes | ForEach-Object {
  try { $_.PriorityClass = "High" } catch { Write-Output "Could not set process priority for $($_.Id)" }
}

$gameProcess = $processes | Select-Object -First 1
try {
  $gamePath = $gameProcess.Path
  if ($gamePath) {
    $gpuPreferencesPath = "HKCU:\Software\Microsoft\DirectX\UserGpuPreferences"
    New-Item -Path $gpuPreferencesPath -Force | Out-Null
    New-ItemProperty -Path $gpuPreferencesPath -Name $gamePath -PropertyType String -Value "GpuPreference=2;" -Force | Out-Null
  }
} catch {
  Write-Output "Could not set the Windows high-performance GPU preference."
}

$gameConfigPath = "HKCU:\System\GameConfigStore"
$gameBarPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR"
New-Item -Path $gameConfigPath -Force | Out-Null
New-Item -Path $gameBarPath -Force | Out-Null
New-ItemProperty -Path $gameConfigPath -Name "GameDVR_Enabled" -PropertyType DWord -Value 0 -Force | Out-Null
New-ItemProperty -Path $gameBarPath -Name "AppCaptureEnabled" -PropertyType DWord -Value 0 -Force | Out-Null

Write-Output "FORTNITE_OPTIMIZED"

$perfSettings = @{
    "bUseVSync" = "False"
    "FrameRateLimit" = "240.00"
    "sg.ResolutionQuality" = "100.000000"
    "sg.ViewDistanceQuality" = "0"
    "sg.AntiAliasingQuality" = "0"
    "sg.ShadowQuality" = "0"
    "sg.PostProcessQuality" = "0"
    "sg.TextureQuality" = "0"
    "sg.EffectsQuality" = "0"
    "sg.FoliageQuality" = "0"
    "sg.ShadingQuality" = "0"
}

$configFile = Join-Path $env:LOCALAPPDATA "FortniteGame\Saved\Config\WindowsClient\GameUserSettings.ini"
if (Test-Path $configFile) {
    Copy-Item $configFile "$configFile.k3d.bak" -Force -ErrorAction SilentlyContinue
    $content = [System.IO.File]::ReadAllText($configFile)
    foreach ($key in $perfSettings.Keys) {
        $pattern = '(?m)^' + $key + '=.*$'
        $replacement = $key + '=' + $perfSettings[$key]
        if ($content -match $pattern) {
            $content = $content -replace $pattern, $replacement
        } else {
            $content = $content + [Environment]::NewLine + $replacement
        }
    }
    [System.IO.File]::WriteAllText($configFile, $content)
    Write-Output "FORTNITE_CONFIG_OK"
} else {
    Write-Output "FORTNITE_CONFIG_MISSING"
}
