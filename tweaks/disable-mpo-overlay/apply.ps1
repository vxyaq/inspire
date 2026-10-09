Write-Host "Disabling MPO overlay..."
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\DWM" -Name "OverlayTestMode" -Value 5 -Type DWord -Force
Write-Host "MPO overlay disabled. Restart recommended."
