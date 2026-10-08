Write-Host "Applying Intel GPU optimization..."
$gmmPath = "HKLM:\SOFTWARE\Intel\GMM"
if (-not (Test-Path $gmmPath)) {
    New-Item -Path $gmmPath -Force | Out-Null
}
Set-ItemProperty -Path $gmmPath -Name "DedicatedSegmentSize" -Value 512 -Type DWord -Force
$gpu = Get-WmiObject Win32_VideoController -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "Intel" -and $_.PNPDeviceID } | Select-Object -First 1
if ($gpu) {
    $msiPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($gpu.PNPDeviceID)\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"
    if (Test-Path $msiPath) {
        Set-ItemProperty -Path $msiPath -Name "MSISupported" -Value 1 -Type DWord -Force
    }
}
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_FSEBehaviorMode" -Value 2 -Type DWord -Force
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_HonorUserFSEBehaviorMode" -Value 1 -Type DWord -Force
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_DXGIHonorFSEWindowsCompatible" -Value 1 -Type DWord -Force
Write-Host "Intel GPU optimization applied."
