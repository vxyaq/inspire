Write-Host "Optimizing Medal..."
Get-Process -Name Medal, MedalEncoder -ErrorAction SilentlyContinue | Stop-Process -Force
$medalData = Join-Path $env:APPDATA "Medal"
@("Cache", "Code Cache", "GPUCache") | ForEach-Object {
    $cachePath = Join-Path $medalData $_
    if (Test-Path $cachePath) {
        Remove-Item $cachePath -Recurse -Force -ErrorAction SilentlyContinue
    }
}
$medalLocal = Join-Path $env:LOCALAPPDATA "Medal"
if (Test-Path $medalLocal) {
    Add-MpPreference -ExclusionPath $medalLocal -ErrorAction SilentlyContinue
}
Write-Host "Medal optimized. Open Medal again when ready."
