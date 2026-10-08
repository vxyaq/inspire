import os from "os"
import { app, ipcMain } from "electron"
import si from "systeminformation"
import { exec, execFile } from "child_process"
import util from "util"
import fs from "fs"
import path from "path"
import log from "electron-log"
import { shell } from "electron"
import { executePowerShell } from "@main/powershell"
import type { PowerShellResult } from "@main/powershell"
import { detectGPU, clearGpuCache } from "@main/gpu"
import { mainWindow } from "@main/windowState"
import { TtlCache } from "@main/cache"
import { platform } from "@main/utils"
import type { SystemInfo } from "../types"

const systemInfoCache = new TtlCache<SystemInfo>(5 * 60 * 1000)

const execFilePromise = util.promisify(execFile)

console.log = log.log
console.error = log.error
console.warn = log.warn

interface ClearCacheResult {
  success: boolean
  error?: string
}

async function getSystemInfo(): Promise<SystemInfo> {
  const cached = systemInfoCache.get("systemInfo")
  if (cached) return cached

  try {
    const versionPromise = platform.windows
      ? executePowerShell({
          script: `(Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion").DisplayVersion`,
          name: "GetWindowsVersion",
        })
      : Promise.resolve(null)

    const [cpuData, osInfo, memLayout, versionPsResult] = await Promise.all([
      si.cpu(),
      si.osInfo(),
      si.memLayout(),
      versionPromise,
    ])

    const totalMemory = os.totalmem()
    const memoryType = (memLayout as any).length > 0 ? (memLayout as any)[0].type : "Unknown"

    let osVersion = "Unknown"
    if (platform.windows) {
      osVersion =
        versionPsResult && versionPsResult.success && versionPsResult.output
          ? versionPsResult.output.trim()
          : "Unknown"
    } else {
      osVersion = (osInfo as any).release || os.release()
    }

    const result: SystemInfo = {
      cpu_model: (cpuData as any).brand,
      cpu_cores: (cpuData as any).physicalCores,
      cpu_threads: (cpuData as any).threads || (cpuData as any).physicalCores,
      memory_total: totalMemory,
      memory_type: memoryType,
      os: osInfo.distro || (platform.windows ? "Windows" : os.type()),
      os_version: osVersion || "Unknown",
    }

    setImmediate(async () => {
      detectGPU()
        .then((gpuInfo) => {
          mainWindow?.webContents.send("system-info-extra", {
            gpu_model: gpuInfo.model,
            vram: gpuInfo.vram,
            hasGPU: gpuInfo.hasGPU,
            isNvidia: gpuInfo.isNvidia,
            integrated_gpu: gpuInfo.integratedModel,
            hasIntegratedGPU: gpuInfo.hasIntegratedGPU,
          })
        })
        .catch((error) => {
          console.error("Failed to detect GPU:", error)
        })

      try {
        const [diskLayout, fsSize, blockDevices] = await Promise.all([
          si.diskLayout(),
          si.fsSize(),
          si.blockDevices(),
        ])

        const isWindowsMount = (mount: string): boolean => mount.toUpperCase().startsWith("C:")
        const primaryMount = platform.windows
          ? (fsSize as any).find((d: any) => isWindowsMount(d.mount))
          : (fsSize as any).find((d: any) => d.mount === "/") ?? (fsSize as any)[0]
        const cDrive = primaryMount

        let primaryDisk: any = null
        if (cDrive) {
          const cBlock = platform.windows
            ? (blockDevices as any).find(
                (b: any) => b.mount && isWindowsMount(b.mount),
              )
            : (blockDevices as any).find((b: any) => b.mount === cDrive.mount)
          if (cBlock) {
            primaryDisk =
              (diskLayout as any).find(
                (disk: any) =>
                  disk.device?.toLowerCase() === cBlock.device?.toLowerCase() ||
                  disk.name?.toLowerCase().includes(cBlock.name?.toLowerCase()),
              ) || null
          }
        }

        mainWindow?.webContents.send("system-info-extra", {
          disk_model: primaryDisk?.name || primaryDisk?.device || "Unknown Storage",
          disk_size: cDrive?.size
            ? `${Math.round(cDrive.size / 1024 / 1024 / 1024).toFixed(1)} GB`
            : "Unknown",
        })
      } catch (error) {
        console.error("Failed to fetch disk info:", error)
      }
    })

    systemInfoCache.set("systemInfo", result)
    return result
  } catch (error) {
    console.error("Failed to get system info:", error)
    throw error
  }
}

function restartSystem(): { success: boolean } {
  try {
    if (platform.windows) {
      exec("shutdown /r /t 0")
    } else if (platform.mac) {
      exec("shutdown -r now")
    } else {
      exec("systemctl reboot || shutdown -r now")
    }
    return { success: true }
  } catch (error) {
    console.error("Failed to restart system:", error)
    throw error
  }
}

export function restartExplorer(): { success: boolean; error?: string } {
  if (!platform.windows) {
    return {
      success: false,
      error: "Restarting the desktop shell is only available on Windows.",
    }
  }
  try {
    exec("taskkill /f /im explorer.exe & start explorer.exe")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to restart explorer:", error)
    return { success: false, error: error.message }
  }
}

function getUserName(): string {
  return os.userInfo().username
}

async function getSystemUuid(): Promise<string> {
  try {
    const uuidData = await si.uuid()
    return uuidData.os || uuidData.hardware || "Unknown"
  } catch (error) {
    console.error("Failed to get system UUID:", error)
    return "Unknown"
  }
}

export async function getAdminStatus(): Promise<boolean> {
  console.log("[Inspire]: Checking admin status...")
  try {
    if (!platform.windows) {
      const isRoot = typeof process.getuid === "function" && process.getuid() === 0
      console.log(`[Inspire]: Admin status: ${isRoot}`)
      return isRoot
    }
    const { execSync } = await import("child_process")
    execSync("net session", { stdio: "pipe" })
    console.log("[Inspire]: Admin status: true")
    return true
  } catch (error) {
    console.log("[Inspire]: Not running as admin")
    return false
  }
}
function clearInspireCache(): ClearCacheResult {
  systemInfoCache.clear()
  clearGpuCache()
  try {
    const userDataPath = app.getPath("userData")
    const scriptsPath = path.join(userDataPath, "scripts")
    const logsPath = path.join(userDataPath, "logs")

    let scriptsCleared = false
    let logsCleared = false
    let errors: string[] = []

    if (fs.existsSync(scriptsPath)) {
      const files = fs.readdirSync(scriptsPath)
      for (const file of files) {
        const filePath = path.join(scriptsPath, file)
        try {
          if (fs.lstatSync(filePath).isFile()) {
            fs.unlinkSync(filePath)
          }
        } catch (err: any) {
          errors.push(`Failed to delete script file: ${file} - ${err.message}`)
        }
      }

      scriptsCleared = true
      console.log("Inspire scripts directory files cleared successfully.")
    } else {
      console.warn("Inspire scripts directory does not exist.")
      errors.push("Scripts directory does not exist.")
    }

    if (fs.existsSync(logsPath)) {
      const logFiles = fs.readdirSync(logsPath)
      for (const file of logFiles) {
        const filePath = path.join(logsPath, file)
        try {
          if (fs.lstatSync(filePath).isFile()) {
            fs.unlinkSync(filePath)
          }
        } catch (err: any) {
          errors.push(`Failed to delete log file: ${file} - ${err.message}`)
        }
      }
      logsCleared = true
      console.log("Inspire logs directory files cleared successfully.")
    } else {
      console.warn("Inspire logs directory does not exist.")
      errors.push("Logs directory does not exist.")
    }

    if (errors.length === 0) {
      return { success: true }
    } else {
      return {
        success: scriptsCleared || logsCleared,
        error: errors.join(" | "),
      }
    }
  } catch (error: any) {
    console.error("Failed to clear Inspire scripts or logs directory:", error)
    return { success: false, error: error.message }
  }
}

function openLogFolder(): { success: boolean; error?: string } {
  const logPath = path.join(app.getPath("userData"), "logs")
  if (fs.existsSync(logPath)) {
    shell.openPath(logPath)
    return { success: true }
  } else {
    console.warn("Inspire logs directory does not exist.")
    return { success: false, error: "Logs directory does not exist." }
  }
}

const ensureWingetScript = `
$TestMode = $false  # Set $true to force winget install for testing

function Check-Winget {
    try {
        $null = winget --version 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Show-InstallerGUI {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Inspire: Winget Installer"
    $form.Size = New-Object System.Drawing.Size(600,400)
    $form.StartPosition = "CenterScreen"

    $label = New-Object System.Windows.Forms.Label
    $label.Text = "Welcome! Inspire needs Winget to install apps."
    $label.AutoSize = $true
    $label.Location = New-Object System.Drawing.Point(20,20)
    $form.Controls.Add($label)

    $outputBox = New-Object System.Windows.Forms.TextBox
    $outputBox.Multiline = $true
    $outputBox.ScrollBars = 'Vertical'
    $outputBox.ReadOnly = $true
    $outputBox.Size = New-Object System.Drawing.Size(550,250)
    $outputBox.Location = New-Object System.Drawing.Point(20,60)
    $form.Controls.Add($outputBox)

    $closeButton = New-Object System.Windows.Forms.Button
    $closeButton.Text = "Close"
    $closeButton.Size = New-Object System.Drawing.Size(100,30)
    $closeButton.Location = New-Object System.Drawing.Point(240,320)
    $closeButton.Enabled = $false
    $closeButton.Add_Click({ $form.Close() })
    $form.Controls.Add($closeButton)

    function Append-Output {
        param($text)
        $outputBox.AppendText("$text\`r\`n")
        $outputBox.SelectionStart = $outputBox.Text.Length
        $outputBox.ScrollToCaret()
        [System.Windows.Forms.Application]::DoEvents()
    }

    # Create a runspace for background work
    $runspace = [runspacefactory]::CreateRunspace()
    $runspace.ApartmentState = "STA"
    $runspace.ThreadOptions = "ReuseThread"
    $runspace.Open()
    $runspace.SessionStateProxy.SetVariable("TestMode", $TestMode)

    $powershell = [powershell]::Create()
    $powershell.Runspace = $runspace

    [void]$powershell.AddScript({
        function Check-Winget {
            try {
                $null = winget --version 2>&1
                return $LASTEXITCODE -eq 0
            } catch {
                return $false
            }
        }

        $result = @{
            Success = $false
            Messages = @()
        }

        try {
            $result.Messages += "Checking for Winget..."
            $wingetInstalled = Check-Winget

            if ($TestMode -or -not $wingetInstalled) {
                $result.Messages += "Winget not found. Installing for Inspire..."
                
                try {
                    $result.Messages += "Attempting to register App Installer..."
                    
                    # Add timeout wrapper for AppX operations
                    $job = Start-Job -ScriptBlock {
                        Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe
                    }
                    
                    $completed = Wait-Job -Job $job -Timeout 60
                    if ($completed) {
                        Receive-Job -Job $job
                        Remove-Job -Job $job
                    } else {
                        Remove-Job -Job $job -Force
                        throw "Registration timed out after 60 seconds"
                    }
                    
                    Start-Sleep -Seconds 2
                    
                    if (Check-Winget) {
                        $result.Messages += "Winget installed successfully!"
                        $result.Success = $true
                    } else {
                        throw "Registration completed but winget not found"
                    }
                } catch {
                    $result.Messages += "Registration method failed: $($_.Exception.Message)"
                    $result.Messages += "Trying download method..."
                    
                    try {
                        $result.Messages += "Downloading latest App Installer package..."
                        $progressPreference = 'SilentlyContinue'
                        
                        # Add timeout to web requests
                        $releases = Invoke-RestMethod -Uri "https://api.github.com/repos/microsoft/winget-cli/releases/latest" -TimeoutSec 30
                        $downloadUrl = ($releases.assets | Where-Object { $_.name -like "*.msixbundle" }).browser_download_url
                        
                        if (-not $downloadUrl) {
                            throw "Could not find download URL in GitHub release"
                        }
                        
                        $tempFile = Join-Path $env:TEMP "Microsoft.DesktopAppInstaller.msixbundle"
                        
                        $result.Messages += "Downloading from GitHub..."
                        Start-BitsTransfer -Source $downloadUrl -Destination $tempFile -TimeoutSec 120
                        
                        $result.Messages += "Installing package (this may take a minute)..."
                        
                        # Add timeout wrapper for installation
                        $job = Start-Job -ScriptBlock {
                            param($path)
                            Add-AppxPackage -Path $path
                        } -ArgumentList $tempFile
                        
                        $completed = Wait-Job -Job $job -Timeout 120
                        if ($completed) {
                            Receive-Job -Job $job
                            Remove-Job -Job $job
                        } else {
                            Remove-Job -Job $job -Force
                            throw "Installation timed out after 120 seconds"
                        }
                        
                        # Clean up
                        if (Test-Path $tempFile) {
                            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
                        }
                        
                        Start-Sleep -Seconds 2
                        
                        if (Check-Winget) {
                            $result.Messages += "Winget installed successfully!"
                            $result.Success = $true
                        } else {
                            $result.Messages += "WARNING: Installation completed but winget command not available yet."
                            $result.Messages += "You may need to restart your terminal or computer."
                            $result.Success = $false
                        }
                    } catch {
                        $result.Messages += "ERROR: Failed to install Winget."
                        $result.Messages += $_.Exception.Message
                        $result.Messages += ""
                        $result.Messages += "Manual installation: Visit https://aka.ms/getwinget"
                        $result.Success = $false
                    }
                }
            } else {
                $result.Messages += "Winget is already installed. Inspire is ready to install apps!"
                $result.Success = $true
            }
        } catch {
            $result.Messages += "ERROR: Unexpected error occurred."
            $result.Messages += $_.Exception.Message
            $result.Success = $false
        }

        return $result
    })

    $handle = $powershell.BeginInvoke()

    # Poll for completion
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 500
    $timer.Add_Tick({
        if ($handle.IsCompleted) {
            $timer.Stop()
            
            try {
                $result = $powershell.EndInvoke($handle)
                
                foreach ($message in $result.Messages) {
                    Append-Output $message
                }
                
                Append-Output ""
                Append-Output "You can now close this window."
            } catch {
                Append-Output "ERROR: Installation process failed."
                Append-Output $_.Exception.Message
            } finally {
                $closeButton.Enabled = $true
                $powershell.Dispose()
                $runspace.Close()
            }
        }
    })

    $form.Add_Shown({ $timer.Start() })
    
    # Clean up on form close
    $form.Add_FormClosing({
        if (-not $handle.IsCompleted) {
            $powershell.Stop()
        }
        $timer.Stop()
        $powershell.Dispose()
        $runspace.Close()
    })

    [void]$form.ShowDialog()
}

# --- Main Execution ---
if ($TestMode -or -not (Check-Winget)) {
    Show-InstallerGUI
} else {
    Write-Output "Winget is already installed. Inspire can install apps!"
}
`

export { ensureWingetScript }

function ensureWinget(): Promise<PowerShellResult> {
  return executePowerShell({
    script: ensureWingetScript,
    name: "Ensure-Winget",
  })
}

export { ensureWinget }

export async function checkWinget(): Promise<{ success: boolean; installed: boolean }> {
  try {
    await execFilePromise("winget", ["--version"])
    console.log("Winget is installed")
    return { success: true, installed: true }
  } catch {
    console.log("Winget is not installed")
    return { success: true, installed: false }
  }
}

function autoClearCache(): void {
  try {
    const stampPath = path.join(app.getPath("userData"), "lastCacheClear.txt")
    let last = 0
    try {
      last = Number(fs.readFileSync(stampPath, "utf8")) || 0
    } catch {
      last = 0
    }
    if (Date.now() - last < 24 * 60 * 60 * 1000) return
    clearInspireCache()
    try {
      fs.writeFileSync(stampPath, String(Date.now()), "utf8")
    } catch {
      return
    }
  } catch {
    return
  }
}

export const setupSystemHandlers = (): void => {
  autoClearCache()
  ipcMain.handle("restart", restartSystem)
  ipcMain.handle("open-log-folder", openLogFolder)
  ipcMain.handle("clear-inspire-cache", clearInspireCache)
  ipcMain.handle("get-system-info", getSystemInfo)
  ipcMain.handle("get-user-name", getUserName)
  ipcMain.handle("restart-explorer", restartExplorer)
  ipcMain.handle("check-winget", async () => checkWinget())
  ipcMain.handle("get-admin-status", async () => getAdminStatus())
  ipcMain.handle("get-platform", () => process.platform)
  ipcMain.handle("get-system-uuid", getSystemUuid)
  ipcMain.handle("install-winget", ensureWinget)
  console.log("[Inspire main/system.ts]: System handlers setup complete")
}

export const cleanupSystemHandlers = (): void => {
  ipcMain.removeHandler("restart")
  ipcMain.removeHandler("open-log-folder")
  ipcMain.removeHandler("clear-inspire-cache")
  ipcMain.removeHandler("get-system-info")
  ipcMain.removeHandler("get-platform")
  ipcMain.removeHandler("get-user-name")
  ipcMain.removeHandler("restart-explorer")
  ipcMain.removeHandler("check-winget")
  ipcMain.removeHandler("get-system-uuid")
  ipcMain.removeHandler("install-winget")
}
