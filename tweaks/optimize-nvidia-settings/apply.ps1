#Requires -RunAsAdministrator

$ErrorActionPreference = "SilentlyContinue"

Checkpoint-Computer -Description "PreOxTweak" -RestorePointType MODIFY_SETTINGS

if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    nvidia-smi -pm 1
}
Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -like "NvTm*" } | Disable-ScheduledTask -ErrorAction SilentlyContinue
Set-Service -Name "NvTelemetryContainer" -StartupType Disabled -ErrorAction SilentlyContinue

$gpu = Get-WmiObject Win32_VideoController -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "NVIDIA" -and $_.PNPDeviceID } | Select-Object -First 1
if ($gpu) {
    $msiPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($gpu.PNPDeviceID)\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"
    if (Test-Path $msiPath) {
        Set-ItemProperty -Path $msiPath -Name "MSISupported" -Value 1 -Type DWord -Force
    }
}

$graphicsDrivers = "HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers"
Set-ItemProperty -Path $graphicsDrivers -Name "TdrDelay" -Value 8 -Type DWord -Force
Set-ItemProperty -Path $graphicsDrivers -Name "TdrLevel" -Value 3 -Type DWord -Force

$nvidiaData = Join-Path $env:LOCALAPPDATA "NVIDIA"
@("DXCache", "GLCache") | ForEach-Object {
    $cachePath = Join-Path $nvidiaData $_
    if (Test-Path $cachePath) {
        Remove-Item (Join-Path $cachePath "*") -Recurse -Force -ErrorAction SilentlyContinue
    }
}

powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 | Out-Null
powercfg -setactive e9a42b02-d5df-448d-aa00-03f14749eb61
powercfg -change monitor-timeout-ac 0
powercfg -change standby-timeout-ac 0
powercfg -h off
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 100
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFBOOSTMODE 2
powercfg -setacvalueindex SCHEME_CURRENT SUB_PCIEXPRESS ASPM 0
powercfg -setactive SCHEME_CURRENT

bcdedit /set useplatformclock false | Out-Null
bcdedit /set disabledynamictick yes | Out-Null
bcdedit /set nx OptIn | Out-Null

New-Item -Path "HKCU:\System\GameConfigStore" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_Enabled" -Value 0 -Type DWord
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_FSEBehaviorMode" -Value 2 -Type DWord
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_HonorUserFSEBehaviorMode" -Value 1 -Type DWord
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_DXGIHonorFSEWindowsCompatible" -Value 1 -Type DWord
Set-ItemProperty -Path "HKCU:\System\GameConfigStore" -Name "GameDVR_EFSEFeatureFlags" -Value 0 -Type DWord

New-Item -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\GameDVR" -Force | Out-Null
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\GameDVR" -Name "AllowGameDVR" -Value 0 -Type DWord

New-Item -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR" -Name "AppCaptureEnabled" -Value 0 -Type DWord

New-Item -Path "HKCU:\SOFTWARE\Microsoft\GameBar" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\GameBar" -Name "AllowAutoGameMode" -Value 0 -Type DWord
Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\GameBar" -Name "AutoGameModeEnabled" -Value 0 -Type DWord
Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\GameBar" -Name "ShowStartupPanel" -Value 0 -Type DWord

New-Item -Path "HKLM:\SYSTEM\CurrentControlSet\Services\NVSPCapsm" -Force | Out-Null
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\NVSPCapsm" -Name "Start" -Value 4 -Type DWord

New-Item -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management" -Force | Out-Null
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management" -Name "LargeSystemCache" -Value 0 -Type DWord
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management" -Name "DisablePagingExecutive" -Value 1 -Type DWord
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management" -Name "SystemPages" -Value 0 -Type DWord

New-Item -Path "HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl" -Force | Out-Null
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl" -Name "Win32PrioritySeparation" -Value 26 -Type DWord
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl" -Name "IRQ8Priority" -Value 1 -Type DWord

New-Item -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" -Force | Out-Null
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" -Name "SystemResponsiveness" -Value 0 -Type DWord
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" -Name "NetworkThrottlingIndex" -Value 4294967295 -Type DWord

New-Item -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games" -Force | Out-Null
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games" -Name "GPU Priority" -Value 8 -Type DWord
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games" -Name "Priority" -Value 6 -Type DWord
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games" -Name "Scheduling Category" -Value "High" -Type String
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games" -Name "SFIO Priority" -Value "High" -Type String

New-Item -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" -Force | Out-Null
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" -Name "TcpAckFrequency" -Value 1 -Type DWord
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" -Name "TCPNoDelay" -Value 1 -Type DWord

New-Item -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" -Force | Out-Null
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" -Name "NoAutoRebootWithLoggedOnUsers" -Value 1 -Type DWord

$gpuKeys = Get-ChildItem "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}" -ErrorAction SilentlyContinue
foreach ($key in $gpuKeys) {
    $desc = Get-ItemProperty $key.PSPath -ErrorAction SilentlyContinue
    if ($desc.DriverDesc -like "*NVIDIA*") {
        Set-ItemProperty -Path $key.PSPath -Name "RMHdcpKeyglobZero" -Value 1 -Type DWord
        Set-ItemProperty -Path $key.PSPath -Name "DisableWriteCombining" -Value 0 -Type DWord
        Set-ItemProperty -Path $key.PSPath -Name "D3PCLatency" -Value 5 -Type DWord
        Set-ItemProperty -Path $key.PSPath -Name "PerfLevelSrc" -Value 3322 -Type DWord
    }
}

$services = @("DiagTrack","dmwappushservice","SysMain","WSearch","Spooler","Fax","RemoteRegistry","W32Time","XblGameSave","XblAuthManager","XboxNetApiSvc","MapsBroker","RetailDemo","lfsvc","PhoneSvc","TapiSrv","WerSvc")
foreach ($svc in $services) {
    Stop-Service $svc -Force -ErrorAction SilentlyContinue
    Set-Service $svc -StartupType Disabled -ErrorAction SilentlyContinue
}

$apps = @("Microsoft.XboxGameOverlay","Microsoft.XboxGamingOverlay","Microsoft.XboxIdentityProvider","Microsoft.XboxSpeechToTextOverlay","Microsoft.YourPhone","Microsoft.ZuneMusic","Microsoft.ZuneVideo","Microsoft.GetHelp","Microsoft.Getstarted","Microsoft.Messaging","Microsoft.People","Microsoft.SkypeApp","Microsoft.MicrosoftSolitaireCollection","Microsoft.News","Microsoft.549981C3F5F10")
foreach ($app in $apps) {
    Get-AppxPackage $app -ErrorAction SilentlyContinue | Remove-AppxPackage -ErrorAction SilentlyContinue
}

Set-MpPreference -DisableRealtimeMonitoring $false -ScanScheduleDay 8 -ErrorAction SilentlyContinue

Write-Host "NVIDIA optimization applied."
