Write-Host "Restoring power throttling..."
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling" -Name "PowerThrottlingOff" -Value 0 -Type DWord -Force
Write-Host "Power throttling restored."
