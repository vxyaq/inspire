Write-Host "Disabling Defender real-time protection..."
Set-MpPreference -DisableRealtimeMonitoring $true
Write-Host "Defender real-time protection disabled."
