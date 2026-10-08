import { exec } from "child_process"
import { ipcMain, IpcMainInvokeEvent } from "electron"
import fs from "fs"
import log from "electron-log"
import { platform } from "@main/utils"

console.log = log.log
console.error = log.error
console.warn = log.warn

function runPowerShell(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!platform.windows) {
      return reject(new Error("System restore points are only available on Windows."))
    }
    exec(
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "${cmd}"`,
      { windowsHide: true },
      (err, stdout, stderr) => {
        if (err) return reject(stderr || err.message)
        resolve(stdout)
      },
    )
  })
}

function sanitizeRestorePointName(name: string): string {
  return name.replace(/[^a-zA-Z0-9 _-]/g, "")
}

function getTimestamp(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}_${String(date.getHours()).padStart(2, "0")}-${String(date.getMinutes()).padStart(2, "0")}-${String(date.getSeconds()).padStart(2, "0")}`
}

interface BackupResult {
  success: boolean
  label?: string
  message?: string
  error?: string
  points?: any[]
}

let createInProgress: Promise<BackupResult> | null = null
let lastCreatedAt = 0
const CREATE_DEDUPE_MS = 60 * 1000

async function createPoint(label: string): Promise<BackupResult> {
  if (createInProgress) return createInProgress
  if (Date.now() - lastCreatedAt < CREATE_DEDUPE_MS) {
    return { success: true, label, message: "Restore point already created moments ago." }
  }
  createInProgress = (async (): Promise<BackupResult> => {
    try {
      await runPowerShell(
        `Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\SystemRestore" -Name "SystemRestorePointCreationFrequency" -Value 0 -Type DWord -Force`,
      ).catch(() => "")
      await runPowerShell(`Checkpoint-Computer -Description '${label}'`)
      lastCreatedAt = Date.now()
      return { success: true, label }
    } catch (error: any) {
      console.error(error)
      return { success: false, error: error.message || String(error) }
    } finally {
      createInProgress = null
    }
  })()
  return createInProgress
}

export const setupBackupHandlers = (): void => {
  ipcMain.handle("create-k3d-restore-point", async (): Promise<BackupResult> => {
    return createPoint(`K3dTweaksBackup-${getTimestamp()}`)
  })

  ipcMain.handle(
    "create-restore-point",
    async (_event: IpcMainInvokeEvent, name?: string): Promise<BackupResult> => {
      const safeName = name ? sanitizeRestorePointName(name) : ""
      const label = safeName ? `${safeName}-${getTimestamp()}` : `ManualRestore-${getTimestamp()}`
      return createPoint(label)
    },
  )

  ipcMain.handle(
    "delete-all-restore-points",
    async (_event: IpcMainInvokeEvent): Promise<BackupResult> => {
      try {
        await runPowerShell(`vssadmin delete shadows /all /quiet`)
        return { success: true }
      } catch (error: any) {
        console.error("Error deleting all restore points:", error)
        return { success: false, error: error.message }
      }
    },
  )

  ipcMain.handle("get-restore-points", async (): Promise<BackupResult> => {

    if (!platform.windows) {
      return { success: true, points: [] }
    }

    try {
      const output = await runPowerShell(
        "Get-ComputerRestorePoint | Select-Object SequenceNumber, Description, CreationTime, EventType, RestorePointType | ConvertTo-Json",
      )

      let points: any[] = []
      try {
        points = JSON.parse(output)
        if (!Array.isArray(points)) points = [points]
      } catch {
        points = []
      }
      return { success: true, points }
    } catch (error: any) {
      console.error(error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle(
    "restore-restore-point",
    async (_event: IpcMainInvokeEvent, sequenceNumber: number): Promise<BackupResult> => {
      try {
        await runPowerShell(`Restore-Computer -RestorePoint ${sequenceNumber}`)
        return { success: true }
      } catch (error: any) {
        console.error(error)
        return { success: false, error: error.message }
      }
    },
  )

  ipcMain.handle("delete-old-k3d-backups", async (): Promise<BackupResult> => {
    return new Promise((resolve, reject) => {
      const k3dRoot = `C:\\K3d Tweaks`
      if (!fs.existsSync(k3dRoot)) {
        return resolve({ success: true, message: "K3d Tweaks folder does not exist" })
      }

      fs.rm(k3dRoot, { recursive: true, force: true }, (err) => {
        if (err) return reject(err)
        resolve({ success: true, message: "K3d Tweaks folder deleted" })
      })
    })
  })
  console.log("[K3d Tweaks main/backup.ts]: Backup handlers setup complete")
}

export const cleanupBackupHandlers = (): void => {
  ipcMain.removeHandler("create-k3d-restore-point")
  ipcMain.removeHandler("create-restore-point")
  ipcMain.removeHandler("delete-all-restore-points")
  ipcMain.removeHandler("get-restore-points")
  ipcMain.removeHandler("restore-restore-point")
  ipcMain.removeHandler("delete-old-k3d-backups")
}
