import type { BrowserWindow } from "electron"

export const logo = "[K3d Tweaks]:"

export let mainWindow: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow | null): void {
  mainWindow = win
}
