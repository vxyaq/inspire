import { Tray, Menu, app, BrowserWindow } from "electron"
import { getAppIcon } from "@main/utils"

export function createTray(mainWindow: BrowserWindow): Tray {
  const tray = new Tray(getAppIcon())

  const contextMenu = Menu.buildFromTemplate([
    { label: "Open Window", click: (): void => mainWindow.show() },
    { label: "Quit", click: (): void => app.quit() },
  ])

  tray.setToolTip("Inspire Optimizer")
  tray.setTitle("Inspire Optimizer")
  tray.setContextMenu(contextMenu)
  tray.on("click", (): void => ToggleWindowState(mainWindow))

  return tray
}

function ToggleWindowState(mainWindow: BrowserWindow): void {
  mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
}
