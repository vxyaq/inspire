Write-Host "Applying NVIDIA driver optimization..."
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    nvidia-smi -pm 1
}
Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -like "NvTm*" } | Disable-ScheduledTask -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_FSEBehaviorMode" -Value 2 -Type DWord -Force
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_HonorUserFSEBehaviorMode" -Value 1 -Type DWord -Force
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_DXGIHonorFSEWindowsCompatible" -Value 1 -Type DWord -Force
Write-Host "NVIDIA driver optimization applied."
