Write-Host "Reverting AMD GPU optimization..."
$base = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}"
Get-ChildItem -Path $base -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match "^000\d$" } | ForEach-Object {
    Set-ItemProperty -Path $_.PSPath -Name "DisableUlps" -Value 0 -Type DWord -Force
    Set-ItemProperty -Path $_.PSPath -Name "EnableUlps" -Value 1 -Type DWord -Force
    Remove-ItemProperty -Path $_.PSPath -Name "DisableUlps_NA" -ErrorAction SilentlyContinue
}
$gpu = Get-WmiObject Win32_VideoController -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "AMD" -and $_.PNPDeviceID } | Select-Object -First 1
if ($gpu) {
    $msiPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($gpu.PNPDeviceID)\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"
    if (Test-Path $msiPath) {
        Set-ItemProperty -Path $msiPath -Name "MSISupported" -Value 0 -Type DWord -Force
    }
}
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_FSEBehaviorMode" -Value 0 -Type DWord -Force
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_HonorUserFSEBehaviorMode" -Value 0 -Type DWord -Force
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_DXGIHonorFSEWindowsCompatible" -Value 0 -Type DWord -Force
Write-Host "AMD GPU optimization reverted."
