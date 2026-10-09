Write-Host "Restoring MPO overlay..."
Remove-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\DWM" -Name "OverlayTestMode" -ErrorAction SilentlyContinue
Write-Host "MPO overlay restored. Restart recommended."
