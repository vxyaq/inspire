Write-Host "Restoring CPU idle states..."
powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR IDLEDISABLE 0
powercfg /setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR IDLEDISABLE 0
powercfg /setactive SCHEME_CURRENT
Write-Host "CPU idle states restored."
