Write-Host "Boosting GPU priority for games..."
$gamesPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games"
New-Item -Path $gamesPath -Force | Out-Null
Set-ItemProperty -Path $gamesPath -Name "GPU Priority" -Value 8 -Type DWord -Force
Set-ItemProperty -Path $gamesPath -Name "Priority" -Value 6 -Type DWord -Force
Set-ItemProperty -Path $gamesPath -Name "Scheduling Category" -Value "High" -Type String -Force
Write-Host "GPU priority boosted for games."
