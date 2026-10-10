if (-not $k3dRamGb) { $k3dRamGb = 16 }
Write-Host "Optimizing RAM ($k3dRamGb GB installed)..."

$memTools = Add-Type -MemberDefinition '[DllImport("ntdll.dll")] public static extern int NtSetSystemInformation(int SystemInformationClass, System.IntPtr SystemInformation, int SystemInformationLength);' -Name "K3dMemTools" -Namespace "K3dTweaks" -PassThru
$ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal(4)
[System.Runtime.InteropServices.Marshal]::WriteInt32($ptr, 4)
[void]$memTools::NtSetSystemInformation(80, $ptr, 4)
[System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
Write-Host "Standby memory purged."

New-Item -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management" -Force | Out-Null
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management" -Name "DisablePagingExecutive" -Value 1 -Type DWord -Force

if ($k3dRamGb -le 8) {
    Stop-Service SysMain -Force -ErrorAction SilentlyContinue
    Set-Service SysMain -StartupType Disabled -ErrorAction SilentlyContinue
    Write-Host "SysMain disabled to save RAM."
} else {
    Set-Service SysMain -StartupType Automatic -ErrorAction SilentlyContinue
    Start-Service SysMain -ErrorAction SilentlyContinue
    Write-Host "SysMain kept on for faster launches."
}

Write-Host "RAM optimized."
