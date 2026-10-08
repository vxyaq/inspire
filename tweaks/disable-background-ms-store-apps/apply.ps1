$path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications"
$name = "GlobalUserDisabled"
$newValue = 1

If (-Not (Test-Path $path)) {
  New-Item -Path $path -Force | Out-Null
}

Set-ItemProperty -Path $path -Name $name -Type DWord -Value $newValue

Write-Host "$name set to $newValue (Background Access Disabled)"