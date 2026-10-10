Write-Host "Reverting RAM optimization..."
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management" -Name "DisablePagingExecutive" -Value 0 -Type DWord -Force
Set-Service SysMain -StartupType Automatic -ErrorAction SilentlyContinue
Write-Host "RAM optimization reverted."
