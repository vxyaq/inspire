Write-Host "Reverting Medal optimization..."
$medalLocal = Join-Path $env:LOCALAPPDATA "Medal"
if (Test-Path $medalLocal) {
    Remove-MpPreference -ExclusionPath $medalLocal -ErrorAction SilentlyContinue
}
Write-Host "Medal optimization reverted."
