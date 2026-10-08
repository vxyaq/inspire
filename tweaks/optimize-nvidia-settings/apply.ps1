Write-Host "Applying NVIDIA driver optimization..."
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    nvidia-smi -pm 1
}
Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -like "NvTm*" } | Disable-ScheduledTask -ErrorAction SilentlyContinue
Set-Service -Name "NvTelemetryContainer" -StartupType Disabled -ErrorAction SilentlyContinue
$gpu = Get-WmiObject Win32_VideoController -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "NVIDIA" -and $_.PNPDeviceID } | Select-Object -First 1
if ($gpu) {
    $msiPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($gpu.PNPDeviceID)\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"
    if (Test-Path $msiPath) {
        Set-ItemProperty -Path $msiPath -Name "MSISupported" -Value 1 -Type DWord -Force
    }
}
$graphicsDrivers = "HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers"
Set-ItemProperty -Path $graphicsDrivers -Name "TdrDelay" -Value 8 -Type DWord -Force
Set-ItemProperty -Path $graphicsDrivers -Name "TdrLevel" -Value 3 -Type DWord -Force
$nvidiaData = Join-Path $env:LOCALAPPDATA "NVIDIA"
@("DXCache", "GLCache") | ForEach-Object {
    $cachePath = Join-Path $nvidiaData $_
    if (Test-Path $cachePath) {
        Remove-Item (Join-Path $cachePath "*") -Recurse -Force -ErrorAction SilentlyContinue
    }
}
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_FSEBehaviorMode" -Value 2 -Type DWord -Force
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_HonorUserFSEBehaviorMode" -Value 1 -Type DWord -Force
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_DXGIHonorFSEWindowsCompatible" -Value 1 -Type DWord -Force
Write-Host "NVIDIA driver optimization applied."
