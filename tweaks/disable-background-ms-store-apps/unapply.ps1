 $path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications"
  $name = "GlobalUserDisabled"
  $originalValue = 0

  If (-Not (Test-Path $path)) {
      New-Item -Path $path -Force | Out-Null
  }

  Set-ItemProperty -Path $path -Name $name -Type DWord -Value $originalValue

  Write-Host "$name reverted to $originalValue (Background Access Restored)" -ForegroundColor Yellow