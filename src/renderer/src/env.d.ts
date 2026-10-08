/// <reference types="vite/client" />

interface Window {
  electron: {
    minimize: () => void
    toggleMaximize: () => void
    close: () => void
    invoke: (channel: string, data?: any) => Promise<any>
    ipcRenderer: import("electron").IpcRenderer
  }
  api: any
}
