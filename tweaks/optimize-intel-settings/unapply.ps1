Write-Host "Reverting Intel GPU optimization..."
$gmmPath = "HKLM:\SOFTWARE\Intel\GMM"
if (Test-Path $gmmPath) {
    Remove-ItemProperty -Path $gmmPath -Name "DedicatedSegmentSize" -ErrorAction SilentlyContinue
}
$gpu = Get-WmiObject Win32_VideoController -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "Intel" -and $_.PNPDeviceID } | Select-Object -First 1
if ($gpu) {
    $msiPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($gpu.PNPDeviceID)\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"
    if (Test-Path $msiPath) {
        Set-ItemProperty -Path $msiPath -Name "MSISupported" -Value 0 -Type DWord -Force
    }
}
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_FSEBehaviorMode" -Value 0 -Type DWord -Force
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_HonorUserFSEBehaviorMode" -Value 0 -Type DWord -Force
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_DXGIHonorFSEWindowsCompatible" -Value 0 -Type DWord -Force
Write-Host "Intel GPU optimization reverted."
