Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "ShowTaskViewButton" -Type DWord -Value 0

Get-AppxPackage *WebExperience* | Remove-AppxPackage -ErrorAction SilentlyContinue

Stop-Process -Name explorer -Force

Write-Host "Widgets removed and Task View hidden."

