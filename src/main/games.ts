import { ipcMain, app } from "electron"
import fs from "fs/promises"
import path from "path"
import { executePowerShell } from "@main/powershell"
import log from "electron-log"

console.log = log.log
console.error = log.error
console.warn = log.warn

const isDev = !app.isPackaged
const gamesDir = isDev ? path.join(process.cwd(), "games") : path.join(app.getAppPath(), "games")

interface GameEntry {
  id: string
  title: string
  background: string
  description: string
  notRunningMarker: string
  notRunningText: string
  missingMarker: string
  missingText: string
  successText: string
  psapply: string
  psunapply: string
}

async function loadGames(): Promise<GameEntry[]> {
  const entries = await fs.readdir(gamesDir, { withFileTypes: true })
  const games: GameEntry[] = []
  for (const dir of entries) {
    if (!dir.isDirectory()) continue
    const folder = path.join(gamesDir, dir.name)
    const metaPath = path.join(folder, "meta.json")
    let meta: any = null
    try {
      meta = JSON.parse(await fs.readFile(metaPath, "utf8"))
    } catch {
      continue
    }
    let psapply = ""
    let psunapply = ""
    try {
      psapply = await fs.readFile(path.join(folder, "apply.ps1"), "utf8")
    } catch {
      psapply = ""
    }
    try {
      psunapply = await fs.readFile(path.join(folder, "unapply.ps1"), "utf8")
    } catch {
      psunapply = ""
    }
    games.push({
      id: meta.id || dir.name,
      title: meta.title || dir.name,
      background: meta.background || "",
      description: meta.description || "",
      notRunningMarker: meta.notRunningMarker || "",
      notRunningText: meta.notRunningText || "",
      missingMarker: meta.missingMarker || "",
      missingText: meta.missingText || "",
      successText: meta.successText || "Optimization applied successfully.",
      psapply,
      psunapply,
    })
  }
  return games
}

export const setupGamesHandlers = (): void => {
  ipcMain.handle("games:fetch", async (): Promise<GameEntry[]> => {
    return loadGames()
  })

  ipcMain.handle("game:apply", async (_: any, id: string): Promise<any> => {
    const games = await loadGames()
    const game = games.find((g) => g.id === id)
    if (!game || !game.psapply) {
      throw new Error(`No apply script found for game: ${id}`)
    }
    return executePowerShell({ script: game.psapply, name: `game-${id}` })
  })

  ipcMain.handle("game:unapply", async (_: any, id: string): Promise<any> => {
    const games = await loadGames()
    const game = games.find((g) => g.id === id)
    if (!game || !game.psunapply) {
      throw new Error(`No unapply script found for game: ${id}`)
    }
    return executePowerShell({ script: game.psunapply, name: `game-${id}-revert` })
  })

  console.log("[K3d Tweaks main/games.ts]: Games handlers setup complete")
}

export const cleanupGamesHandlers = (): void => {
  ipcMain.removeHandler("games:fetch")
  ipcMain.removeHandler("game:apply")
  ipcMain.removeHandler("game:unapply")
}

export default {
  setupGamesHandlers,
  cleanupGamesHandlers,
}
