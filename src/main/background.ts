import { app, ipcMain } from "electron"
import path from "path"
import fs from "fs"

const BG_FILENAME = "background.png"

export const getBackgroundPath = (): string | null => {
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
    const userBgPath = path.join(userDataDir, BG_FILENAME)
    if (fs.existsSync(userBgPath)) {
      return userBgPath
    }
  }

  const rootBgPath = path.resolve(__dirname, "../..", BG_FILENAME)
  if (fs.existsSync(rootBgPath)) {
    return rootBgPath
  }

  return null
}

export const registerBackgroundIpc = () => {
  ipcMain.handle("background:get-path", () => {
    return getBackgroundPath()
  })

  // Returns the background as a data URL so it works both from the dev server
  // (http origin, where file:// subresources are blocked) and from the packaged
  // app (file origin, where Windows paths with backslashes break CSS url()).
  ipcMain.handle("background:get-data-url", () => {
    const bgPath = getBackgroundPath()
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
