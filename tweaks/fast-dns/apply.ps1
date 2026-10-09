Write-Host "Setting fast gaming DNS..."
Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq "Up" } | ForEach-Object {
    netsh interface ip set dns name="$($_.Name)" static 1.1.1.1
    netsh interface ip add dns name="$($_.Name)" 8.8.8.8 index=2
}
Write-Host "Fast gaming DNS set."
