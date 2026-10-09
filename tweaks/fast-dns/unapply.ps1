Write-Host "Restoring automatic DNS..."
Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq "Up" } | ForEach-Object {
    netsh interface ip set dns name="$($_.Name)" dhcp
}
Write-Host "Automatic DNS restored."
