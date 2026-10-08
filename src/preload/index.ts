import { contextBridge, ipcRenderer } from "electron"
import { electronAPI } from "@electron-toolkit/preload"

const api = {}

const background = {
  getPath: (): Promise<string | null> => ipcRenderer.invoke("background:get-path"),
  getDataUrl: (): Promise<string | null> => ipcRenderer.invoke("background:get-data-url"),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI)
    contextBridge.exposeInMainWorld("api", api)
    contextBridge.exposeInMainWorld("background", background)
  } catch (error) {
    console.error(error)
  }
} else {
  ;(window as any).electron = electronAPI
  ;(window as any).api = api
  ;(window as any).background = background
}
