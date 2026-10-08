import { promises as fsp } from "fs"
import path from "path"
import util from "util"
import { exec } from "child_process"
import { app, ipcMain } from "electron"
import { platform } from "@main/utils"
import fs from "fs"
import log from "electron-log"
const execPromise = util.promisify(exec)

console.log = log.log
console.error = log.error
console.warn = log.warn

export const WINDOWS_ONLY_ERROR =
  "This feature is only available on Windows - K3d Tweaks's scripts rely on PowerShell and Windows tooling."

function windowsOnly(context: string): PowerShellResult {
  console.warn(`[K3d Tweaks] Skipped "${context}": not running on Windows`)
  return { success: false, error: WINDOWS_ONLY_ERROR }
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

export interface ExecutePowerShellOptions {
  script: string
  name?: string
  output?: boolean
}

export type PowerShellResult =
  | { success: true; output?: string; error?: never }
  | { success: false; error: string; output?: string }

export async function executePowerShell(
  props: ExecutePowerShellOptions,
): Promise<PowerShellResult> {
  const { script, name = "script", output = true } = props

  if (!platform.windows) return windowsOnly(name)

  try {
    const tempDir = path.join(app.getPath("userData"), "scripts")
    ensureDirectoryExists(tempDir)
    const tempFile = path.join(tempDir, `${name}-${Date.now()}.ps1`)

    await fsp.writeFile(tempFile, script)

    const { stdout, stderr } = await execPromise(
      `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`,
    )

    await fsp.unlink(tempFile).catch(console.error)

    if (stderr) {
      console.warn(`PowerShell stderr [${name}]:`, stderr)
    }

    if (output == true) {
      console.log(`PowerShell stdout [${name}]:`, stdout)
    }

    return { success: true, output: stdout }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`PowerShell execution error [${name}]:`, error)
    return { success: false, error: message }
  }
}

export const setupPowerShellHandlers = (): void => {
  ipcMain.handle("run-powershell", (_event, props: ExecutePowerShellOptions) =>
    executePowerShell(props),
  )
  console.log("[K3d Tweaks main/powershell.ts]: PowerShell handlers setup complete")
}

export const cleanupPowerShellHandlers = (): void => {
  ipcMain.removeHandler("run-powershell")
}
