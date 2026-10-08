Write-Host "Reverting NVIDIA driver optimization..."
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    nvidia-smi -pm 0
}
Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -like "NvTm*" } | Enable-ScheduledTask -ErrorAction SilentlyContinue
Set-Service -Name "NvTelemetryContainer" -StartupType Automatic -ErrorAction SilentlyContinue
$gpu = Get-WmiObject Win32_VideoController -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "NVIDIA" -and $_.PNPDeviceID } | Select-Object -First 1
if ($gpu) {
    $msiPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($gpu.PNPDeviceID)\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"
    if (Test-Path $msiPath) {
        Set-ItemProperty -Path $msiPath -Name "MSISupported" -Value 0 -Type DWord -Force
    }
}
$graphicsDrivers = "HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers"
Remove-ItemProperty -Path $graphicsDrivers -Name "TdrDelay" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path $graphicsDrivers -Name "TdrLevel" -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_FSEBehaviorMode" -Value 0 -Type DWord -Force
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_HonorUserFSEBehaviorMode" -Value 0 -Type DWord -Force
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_DXGIHonorFSEWindowsCompatible" -Value 0 -Type DWord -Force
Write-Host "NVIDIA driver optimization reverted."
