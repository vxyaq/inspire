import { app, ipcMain } from "electron"
import path from "path"
import fs from "fs"

const BG_FILENAMES = ["background.webp", "background2.webp", "background.png"]

export const getBackgroundPath = (index = 0): string | null => {
  const fileName = BG_FILENAMES[index] || BG_FILENAMES[0]
  let userDataDir: string | null = null
  try {
    userDataDir = app.getPath("userData")
  } catch {
    userDataDir = process.env.APPDATA
      ? path.join(process.env.APPDATA, "K3d Tweaks")
      : process.env.HOME
        ? path.join(process.env.HOME, ".k3d")
        : null
  }

  if (userDataDir) {
    const userBgPath = path.join(userDataDir, fileName)
    if (fs.existsSync(userBgPath)) {
      return userBgPath
    }
  }

  const resourcesPath: string | undefined = (process as any).resourcesPath
  if (resourcesPath) {
    const resPath = path.join(resourcesPath, fileName)
    if (fs.existsSync(resPath)) {
      return resPath
    }
  }

  const devPath = path.resolve(process.cwd(), "resources", fileName)
  if (fs.existsSync(devPath)) {
    return devPath
  }

  const rootBgPath = path.resolve(__dirname, "../..", fileName)
  if (fs.existsSync(rootBgPath)) {
    return rootBgPath
  }

  return null
}

export const registerBackgroundIpc = () => {
  ipcMain.handle("background:get-path", (_event, index?: number) => {
    return getBackgroundPath(typeof index === "number" ? index : 0)
  })

  ipcMain.handle("background:get-data-url", (_event, index?: number) => {
    const bgPath = getBackgroundPath(typeof index === "number" ? index : 0)
    if (!bgPath) return null
    try {
      const data = fs.readFileSync(bgPath)
      const ext = path.extname(bgPath).toLowerCase()
      const mime =
        ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".webp"
            ? "image/webp"
            : "image/png"
      return `data:${mime};base64,${data.toString("base64")}`
    } catch (err) {
      console.error("[K3d Tweaks]: Failed to read background image:", err)
      return null
    }
  })
}
