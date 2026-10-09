Write-Host "Restoring CPU core parking..."
powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR CPMINCORES 10
powercfg /setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR CPMINCORES 10
powercfg /setactive SCHEME_CURRENT
Write-Host "CPU core parking restored."
