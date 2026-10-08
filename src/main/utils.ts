import { app } from "electron"
import path from "path"

export const is = {
  dev: app.isPackaged === false ? true : false,
}

export const platform = {
  windows: process.platform === "win32",
  linux: process.platform === "linux",
  mac: process.platform === "darwin",
}

export const getResourcePath = (fileName: string): string => {
  if (is.dev) {
    return path.resolve(process.cwd(), "resources", fileName)
  }
  return path.join(process.resourcesPath, fileName)
}

export const getAppIcon = (): string => {
  return platform.windows ? getResourcePath("inspire2.ico") : getResourcePath("inspirelogo.png")
}
