$ErrorActionPreference = "Stop"
$processes = Get-Process -Name "cs2" -ErrorAction SilentlyContinue

if (-not $processes) {
  Write-Output "CS2_NOT_RUNNING"
  exit 0
}

$processes | ForEach-Object {
  try { $_.PriorityClass = "High" } catch { Write-Output "Could not set process priority for $($_.Id)" }
}

$gpuNames = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name)
$gpuText = $gpuNames -join "; "
$gpuVendor = if ($gpuText -match "NVIDIA") { "NVIDIA" } elseif ($gpuText -match "AMD|Radeon") { "AMD" } elseif ($gpuText -match "Intel") { "Intel" } else { "Unknown" }
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

Write-Output "CS2_OPTIMIZED:$gpuVendor"

$videoSettings = @{
    "setting.defaultres" = "1280"
    "setting.defaultresheight" = "960"
    "setting.aspectratiomode" = "0"
    "setting.fullscreen" = "1"
    "setting.nowindowborder" = "0"
    "setting.coop_fullscreen" = "0"
    "setting.fullscreen_min_on_focus_loss" = "1"
    "setting.mat_vsync" = "0"
    "setting.msaa_samples" = "0"
    "setting.videocfg_shadow_quality" = "0"
    "setting.videocfg_texture_detail" = "0"
    "setting.shaderquality" = "0"
    "setting.videocfg_particle_detail" = "0"
    "setting.videocfg_ao_detail" = "0"
    "setting.videocfg_hdr_detail" = "-1"
    "setting.videocfg_fsr_detail" = "0"
    "setting.r_low_latency" = "2"
}

$steamPath = "C:\Program Files (x86)\Steam"
try {
    $regSteam = (Get-ItemProperty -Path "HKCU:\Software\Valve\Steam" -Name "SteamPath" -ErrorAction Stop).SteamPath
    if ($regSteam) { $steamPath = $regSteam }
} catch { }

$videoUpdated = $false
$userdataDir = Join-Path $steamPath "userdata"
if (Test-Path $userdataDir) {
    Get-ChildItem -Path $userdataDir -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $cfgDir = Join-Path $_.FullName "730\local\cfg"
        $videoFile = Join-Path $cfgDir "cs2_video.txt"
        if (Test-Path $videoFile) {
            Copy-Item $videoFile "$videoFile.k3d.bak" -Force -ErrorAction SilentlyContinue
            $content = [System.IO.File]::ReadAllText($videoFile)
            foreach ($key in $videoSettings.Keys) {
                $pattern = '(?m)^"' + $key + '"\s+"[^"]*"$'
                $replacement = '"' + $key + '" "' + $videoSettings[$key] + '"'
                if ($content -match $pattern) {
                    $content = $content -replace $pattern, $replacement
                } else {
                    $content = $content -replace '(?m)^\}', $replacement + [Environment]::NewLine + "}"
                }
            }
            [System.IO.File]::WriteAllText($videoFile, $content)
            $videoUpdated = $true
            $configFile = Join-Path $cfgDir "config.cfg"
            if (Test-Path $configFile) {
                $cfgContent = [System.IO.File]::ReadAllText($configFile)
                if ($cfgContent -match '(?m)^r_player_visibility_mode\s+"[^"]*"$') {
                    $cfgContent = $cfgContent -replace '(?m)^r_player_visibility_mode\s+"[^"]*"$', 'r_player_visibility_mode "1"'
                } else {
                    $cfgContent = $cfgContent + [Environment]::NewLine + 'r_player_visibility_mode "1"'
                }
                [System.IO.File]::WriteAllText($configFile, $cfgContent)
            }
        }
    }
}

if ($videoUpdated) {
    Write-Output "CS2_VIDEO_OK"
} else {
    Write-Output "CS2_VIDEO_MISSING"
}
