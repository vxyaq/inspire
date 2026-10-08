import { contextBridge, ipcRenderer } from "electron"
import { electronAPI } from "@electron-toolkit/preload"

const api = {}

const background = {
  getPath: (index?: number): Promise<string | null> =>
    ipcRenderer.invoke("background:get-path", index),
  getDataUrl: (index?: number): Promise<string | null> =>
    ipcRenderer.invoke("background:get-data-url", index),
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
