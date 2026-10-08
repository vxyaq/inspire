import { app, ipcMain, BrowserWindow } from "electron"
import { autoUpdater, UpdateInfo } from "electron-updater"
import { platform } from "@main/utils"

const UPDATES_WINDOWS_ONLY =
  "Auto updates are only published for the Windows build of K3d Tweaks."

export function initAutoUpdater(getMainWindow: () => BrowserWindow | null): void {
  if (!platform.windows) {
    const unavailable = () => ({ ok: false, error: UPDATES_WINDOWS_ONLY })
    ipcMain.handle("updater:get-version", () => app.getVersion())
    ipcMain.handle("updater:check", async () => unavailable())
    ipcMain.handle("updater:download", async () => unavailable())
    ipcMain.handle("updater:install", () => unavailable())
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.disableWebInstaller = false
  autoUpdater.autoInstallOnAppQuit = true

  if (!app.isPackaged) {
    autoUpdater.forceDevUpdateConfig = true
  }

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    const win = getMainWindow()
    win?.webContents.send("updater:available", {
      version: info.version,
      releaseNotes: info.releaseNotes ?? undefined,
    })
  })

  autoUpdater.on("update-not-available", () => {
    const win = getMainWindow()
    win?.webContents.send("updater:not-available", { currentVersion: app.getVersion() })
  })

  autoUpdater.on("error", (err: Error) => {
    const win = getMainWindow()
    win?.webContents.send("updater:error", { message: String(err) })
  })

  autoUpdater.on("download-progress", (progress: any) => {
    const win = getMainWindow()
    win?.webContents.send("updater:download-progress", {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    })
  })

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    const win = getMainWindow()
    win?.webContents.send("updater:downloaded", { version: info.version })
  })

  ipcMain.handle("updater:get-version", () => app.getVersion())

  ipcMain.handle("updater:check", async () => {
    try {
      const result = await checkForUpdatesWithTimeout()
      return { ok: true, updateInfo: result?.updateInfo ?? null }
    } catch (error: any) {
      return { ok: false, error: String(error) }
    }
  })

  ipcMain.handle("updater:download", async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { ok: true }
    } catch (error: any) {
      return { ok: false, error: String(error) }
    }
  })

  ipcMain.handle("updater:install", () => {
    try {
      autoUpdater.quitAndInstall(false, true)
      return { ok: true }
    } catch (error: any) {
      return { ok: false, error: String(error) }
    }
  })

  setTimeout(() => triggerAutoUpdateCheck(), 3000)
}

const UPDATE_CHECK_TIMEOUT_MS = 15000

async function checkForUpdatesWithTimeout() {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      autoUpdater.checkForUpdates(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Update check timed out.")), UPDATE_CHECK_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function triggerAutoUpdateCheck(): Promise<void> {
  if (!platform.windows) return
  try {
    await checkForUpdatesWithTimeout()
  } catch {}
}
