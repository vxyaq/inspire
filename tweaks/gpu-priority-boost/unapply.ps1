Write-Host "Restoring GPU priority for games..."
$gamesPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games"
Set-ItemProperty -Path $gamesPath -Name "GPU Priority" -Value 2 -Type DWord -Force
Set-ItemProperty -Path $gamesPath -Name "Priority" -Value 2 -Type DWord -Force
Set-ItemProperty -Path $gamesPath -Name "Scheduling Category" -Value "High" -Type String -Force
Write-Host "GPU priority restored for games."
