Write-Host "Removing Microsoft Copilot..."
Get-AppxPackage -AllUsers | Where-Object { $_.Name -like "*Copilot*" } | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
Write-Host "Copilot removed."
