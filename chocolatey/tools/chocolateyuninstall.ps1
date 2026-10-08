S$ErrorActionPreference = 'Stop'

$packageName = $env:ChocolateyPackageName
$softwareName = 'k3d*'

$installed = Get-ItemProperty -Path @(
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
) -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like $softwareName }

if ($installed) {
  $installed | ForEach-Object {
    $uninstallString = $_.UninstallString

    Write-Host "Found: $($_.DisplayName)"
    Write-Host "Uninstall string: $uninstallString"

    if ($uninstallString) {
      Write-Host "Executing uninstall..."
      & cmd /c $uninstallString /S

      Start-Sleep -Seconds 2

      Write-Host "Uninstall completed"
    }
  }
} else {
  Write-Warning "K3d Tweaks was not found in the registry. It may have already been uninstalled."
}

