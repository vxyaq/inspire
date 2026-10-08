$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName   = $env:ChocolateyPackageName
  fileType      = 'EXE'
  url           = 'https://github.com/parcoil/inspire/releases/download/2.13.0/inspire-2.13.0-setup.exe'
  checksum      = '163922DE587E17F77F2966089B53070216E3A334C57BE7ABB9966408C635764B'
  checksumType  = 'sha256'
  softwareName  = 'inspire*'
  silentArgs    = '/S'
  validExitCodes = @(0, 1)
}

Install-ChocolateyPackage @packageArgs
