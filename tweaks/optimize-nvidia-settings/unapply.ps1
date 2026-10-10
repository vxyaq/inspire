#Requires -RunAsAdministrator

$ErrorActionPreference = "SilentlyContinue"

if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    nvidia-smi -pm 0
}
Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -like "NvTm*" } | Enable-ScheduledTask -ErrorAction SilentlyContinue
Set-Service -Name "NvTelemetryContainer" -StartupType Automatic -ErrorAction SilentlyContinue

$gpu = Get-WmiObject Win32_VideoController -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "NVIDIA" -and $_.PNPDeviceID } | Select-Object -First 1
if ($gpu) {
    $msiPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($gpu.PNPDeviceID)\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"
    if (Test-Path $msiPath) {
        Set-ItemProperty -Path $msiPath -Name "MSISupported" -Value 0 -Type DWord -Force
    }
}

$graphicsDrivers = "HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers"
Remove-ItemProperty -Path $graphicsDrivers -Name "TdrDelay" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path $graphicsDrivers -Name "TdrLevel" -ErrorAction SilentlyContinue

powercfg -setactive 381b4222-f694-41f0-9685-ff5bb260df2e
powercfg -change monitor-timeout-ac 10
powercfg -change standby-timeout-ac 30
powercfg -h on

bcdedit /deletevalue useplatformclock | Out-Null
bcdedit /deletevalue disabledynamictick | Out-Null
bcdedit /deletevalue nx | Out-Null

New-Item -Path "HKCU:\System\GameConfigStore" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_Enabled" -Value 1 -Type DWord
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_FSEBehaviorMode" -Value 0 -Type DWord
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_HonorUserFSEBehaviorMode" -Value 0 -Type DWord
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_DXGIHonorFSEWindowsCompatible" -Value 0 -Type DWord
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_EFSEFeatureFlags" -Value 1 -Type DWord

Remove-Item -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\GameDVR" -Force -ErrorAction SilentlyContinue

Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR" -Name "AppCaptureEnabled" -Value 1 -Type DWord

Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\GameBar" -Name "AllowAutoGameMode" -Value 1 -Type DWord
Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\GameBar" -Name "AutoGameModeEnabled" -Value 1 -Type DWord

Remove-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\NVSPCapsm" -Name "Start" -ErrorAction SilentlyContinue

Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management" -Name "LargeSystemCache" -Value 0 -Type DWord
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management" -Name "DisablePagingExecutive" -Value 0 -Type DWord
Remove-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management" -Name "SystemPages" -ErrorAction SilentlyContinue

Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl" -Name "Win32PrioritySeparation" -Value 2 -Type DWord
Remove-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl" -Name "IRQ8Priority" -ErrorAction SilentlyContinue

Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" -Name "SystemResponsiveness" -Value 20 -Type DWord
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" -Name "NetworkThrottlingIndex" -Value 10 -Type DWord

Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games" -Name "GPU Priority" -Value 8 -Type DWord
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games" -Name "Priority" -Value 2 -Type DWord
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games" -Name "Scheduling Category" -Value "Medium" -Type String
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games" -Name "SFIO Priority" -Value "Normal" -Type String

Remove-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" -Name "TcpAckFrequency" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" -Name "TCPNoDelay" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" -Name "TcpDelAckTicks" -ErrorAction SilentlyContinue

Remove-Item -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" -Force -ErrorAction SilentlyContinue

$gpuKeys = Get-ChildItem "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}" -ErrorAction SilentlyContinue
foreach ($key in $gpuKeys) {
    $desc = Get-ItemProperty $key.PSPath -ErrorAction SilentlyContinue
    if ($desc.DriverDesc -like "*NVIDIA*") {
        Remove-ItemProperty -Path $key.PSPath -Name "RMHdcpKeyglobZero" -ErrorAction SilentlyContinue
        Remove-ItemProperty -Path $key.PSPath -Name "DisableWriteCombining" -ErrorAction SilentlyContinue
        Remove-ItemProperty -Path $key.PSPath -Name "D3PCLatency" -ErrorAction SilentlyContinue
        Remove-ItemProperty -Path $key.PSPath -Name "PerfLevelSrc" -ErrorAction SilentlyContinue
    }
}

$services = @("DiagTrack","dmwappushservice","SysMain","WSearch","Spooler","Fax","RemoteRegistry","W32Time","XblGameSave","XblAuthManager","XboxNetApiSvc","MapsBroker","RetailDemo","lfsvc","PhoneSvc","TapiSrv","WerSvc")
foreach ($svc in $services) {
    Set-Service $svc -StartupType Manual -ErrorAction SilentlyContinue
    Start-Service $svc -ErrorAction SilentlyContinue
}

Write-Host "NVIDIA optimization reverted."
