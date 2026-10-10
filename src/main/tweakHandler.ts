import { ipcMain, app, IpcMainInvokeEvent } from "electron"
import fs from "fs/promises"
import fsSync from "fs"
import path from "path"
import Store from "electron-store"
import { exec } from "child_process"
import { logo } from "@main/windowState"
import { executePowerShell } from "@main/powershell"
import { restartExplorer } from "@main/system"
import { detectGPU } from "@main/gpu"
import log from "electron-log"

console.log = log.log
console.error = log.error
console.warn = log.warn

const userDataPath = app.getPath("userData")
const tweaksStatePath = path.join(userDataPath, "tweakStates.json")
const isDev = !app.isPackaged
const tweaksDir = isDev ? path.join(process.cwd(), "tweaks") : path.join(app.getAppPath(), "tweaks")

interface Tweak {
  name: string
  psapply: string
  psunapply: string
  category?: string
  description?: string
  [key: string]: any
}

const getExePath = (exeName: string): string => {
  if (isDev) {
    return path.resolve(process.cwd(), "resources", exeName)
  }
  return path.join(process.resourcesPath, exeName)
}

let tweaksCache: Tweak[] | null = null

async function loadTweaks(): Promise<Tweak[]> {
  if (tweaksCache) return tweaksCache
  const entries = await fs.readdir(tweaksDir, { withFileTypes: true })
  const tweaks: Tweak[] = []
  for (const dir of entries) {
    if (!dir.isDirectory()) continue

    const name = dir.name
    const folder = path.join(tweaksDir, name)

    const applyPath = path.join(folder, "apply.ps1")
    const metaPath = path.join(folder, "meta.json")

    const hasMeta = await fs
      .access(metaPath)
      .then(() => true)
      .catch(() => false)

    if (!hasMeta) continue

    const unapplyPath = path.join(folder, "unapply.ps1")

    let psapply = ""
    let psunapply = ""

    try {
      psapply = await fs.readFile(applyPath, "utf8")
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        console.warn(`Error reading apply.ps1 for tweak: ${name}`, error)
      }
    }

    try {
      psunapply = await fs.readFile(unapplyPath, "utf8")
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        console.warn(`Error reading unapply.ps1 for tweak: ${name}`, error)
      }
    }

    let meta: any = {}

    try {
      meta = JSON.parse(await fs.readFile(metaPath, "utf8"))
    } catch (error) {
      console.warn(`Error reading meta.json for tweak: ${name}`, error)
      continue
    }

    tweaks.push({
      name,
      psapply,
      psunapply: psunapply || "",
      ...meta,
    })
  }
  tweaksCache = tweaks
  return tweaks
}

const getNipPath = (): string => {
  if (isDev) {
    return path.resolve(process.cwd(), "resources", "k3dtweaks.nip")
  }
  return path.join(process.resourcesPath, "k3dtweaks.nip")
}

function isGPUTweak(tweak: Tweak): boolean {
  return !!(tweak.category && tweak.category.includes("GPU"))
}

function isNvidiaTweak(tweak: Tweak): boolean {
  return tweak.name === "optimize-nvidia-settings"
}

function isProTweak(tweak: Tweak): boolean {
  return !!(tweak.category && tweak.category.includes("Pro"))
}

function isBiosTweak(tweak: Tweak): boolean {
  return !!(tweak.category && tweak.category.includes("BIOS"))
}

const EXPLORER_RESTART_TWEAKS = new Set([
  "align-taskbar-left",
  "hide-taskview-and-widgets",
  "disable-taskbar-seach",
  "show-seconds-in-system-clock",
])

function NvidiaProfileInspector(): Promise<string> {
  const exePath = getExePath("nvidiaProfileInspector.exe")
  const nipPath = getNipPath()

  return new Promise((resolve, reject) => {
    exec(`"${exePath}" -silentImport "${nipPath}"`, (error, stdout, stderr) => {
      console.log("stdout:", stdout)
      console.log("stderr:", stderr)
      if (error) {
        console.error("Error:", error)
        reject(error)
      } else {
        resolve(stdout || "Completed with no output.")
      }
    })
  })
}

export const setupTweaksHandlers = (): void => {
  ipcMain.handle("tweak-states:load", async (): Promise<string> => {
    try {
      await fs.access(tweaksStatePath)
      const data = await fs.readFile(tweaksStatePath, "utf8")
      return data
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return JSON.stringify({})
      }
      console.error("Error loading tweak states:", error)
      throw error
    }
  })

  ipcMain.handle(
    "tweak-states:save",
    async (_event: IpcMainInvokeEvent, payload: string): Promise<boolean> => {
      try {
        await fs.mkdir(path.dirname(tweaksStatePath), { recursive: true })
        await fs.writeFile(tweaksStatePath, payload, "utf8")
        return true
      } catch (error) {
        console.error("Error saving tweak states:", error)
        throw error
      }
    },
  )

  ipcMain.handle("tweaks:fetch", async (): Promise<Tweak[]> => {
    return await loadTweaks()
  })

  ipcMain.handle("tweak:apply", async (_: any, payload: string | { name: string; ramGb?: number }): Promise<any> => {
    const name = typeof payload === "string" ? payload : payload?.name
    const ramGb =
      typeof payload === "object" && payload && Number.isFinite(payload.ramGb)
        ? Math.max(1, Math.min(512, Math.floor(payload.ramGb as number)))
        : undefined
    const tweaks = await loadTweaks()
    const tweak = tweaks.find((t) => t.name === name)
    if (!tweak) {
      throw new Error(`No apply script found for tweak: ${name}`)
    }

    if (isProTweak(tweak) || isBiosTweak(tweak)) {
      let plan: string | undefined
      try {
        plan = (new Store() as any).get("account")?.plan
      } catch {
        plan = undefined
      }
      if (plan !== "pro") {
        throw new Error("This tweak requires a Pro plan.")
      }
    }

    if (isGPUTweak(tweak)) {
      const gpuInfo = await detectGPU()
      if (!gpuInfo.hasGPU) {
        throw new Error(`This tweak requires a dedicated GPU, but no compatible GPU was detected.`)
      }
      if (isNvidiaTweak(tweak) && !gpuInfo.isNvidia) {
        throw new Error(`This tweak is only for NVIDIA GPUs, but no NVIDIA GPU was detected.`)
      }

      if (gpuInfo.wglIssue && isNvidiaTweak(tweak)) {
        console.warn(`Warning: This GPU may have WGL compatibility issues. The tweak may not work correctly.`)
      }
    }

    if (name === "optimize-nvidia-settings") {
      console.log(logo, "Running Nvidia settings optimization...")
      await NvidiaProfileInspector()
    }
    const script = ramGb !== undefined ? `$k3dRamGb = ${ramGb}\n${tweak.psapply}` : tweak.psapply
    const result = await executePowerShell({ script, name })
    if (EXPLORER_RESTART_TWEAKS.has(name)) {
      restartExplorer()
    }
    return result
  })

  ipcMain.handle("tweak:unapply", async (_: any, name: string): Promise<any> => {
    const tweaks = await loadTweaks()
    const tweak = tweaks.find((t) => t.name === name)
    if (!tweak || !tweak.psunapply) {
      throw new Error(`No unapply script found for tweak: ${name}`)
    }
    const result = await executePowerShell({ script: tweak.psunapply, name })
    if (EXPLORER_RESTART_TWEAKS.has(name)) {
      restartExplorer()
    }
    return result
  })

  ipcMain.handle("nvidia-inspector", (_: any, _args: any): Promise<string> => {
    return NvidiaProfileInspector()
  })

  ipcMain.handle("tweak:active", (): string[] => {
    return getActiveTweaks()
  })
  console.log("[K3d Tweaks main/tweakHandler.ts]: Tweak handlers setup complete")
}

const getActiveTweaks = (): string[] => {
  try {
    const data = fsSync.readFileSync(tweaksStatePath, "utf8")
    const parsed = JSON.parse(data)
    return Object.keys(parsed).filter((key) => parsed[key])
  } catch (error: any) {
    if (error?.code !== "ENOENT") {
      console.error("Error loading tweak states:", error)
    }
    return []
  }
}

export const cleanupTweaksHandlers = (): void => {
  ipcMain.removeHandler("tweak-states:load")
  ipcMain.removeHandler("tweak-states:save")
  ipcMain.removeHandler("tweaks:fetch")
  ipcMain.removeHandler("tweak:apply")
  ipcMain.removeHandler("tweak:unapply")
  ipcMain.removeHandler("nvidia-inspector")
}

export default {
  setupTweaksHandlers,
  cleanupTweaksHandlers,
}
