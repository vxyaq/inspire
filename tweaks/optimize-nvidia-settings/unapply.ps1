Write-Host "Reverting NVIDIA driver optimization..."
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    nvidia-smi -pm 0
}
Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -like "NvTm*" } | Enable-ScheduledTask -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_FSEBehaviorMode" -Value 0 -Type DWord -Force
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_HonorUserFSEBehaviorMode" -Value 0 -Type DWord -Force
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_DXGIHonorFSEWindowsCompatible" -Value 0 -Type DWord -Force
Write-Host "NVIDIA driver optimization reverted."
