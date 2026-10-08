import { ipcMain } from "electron"
import { Client, PresenceBuilder, ActivityType } from "discord-rpc-new"
import jsonData from "../../package.json"
import log from "electron-log"
import Store from "electron-store"

const store = new Store()

const CLIENT_ID = "1540168677708795966"

const MAX_RECONNECT_ATTEMPTS = 10
const RETRY_INTERVAL_MS = 30000

let client: Client | null = null
let retryTimer: NodeJS.Timeout | null = null
let connected = false

function scheduleRetry(): void {
  if (retryTimer) return
  retryTimer = setInterval(() => {
    if (!client && store.get("rpcEnabled") !== false) {
      void startDiscordRPC()
    }
  }, RETRY_INTERVAL_MS)
  retryTimer.unref?.()
}

function clearRetry(): void {
  if (retryTimer) {
    clearInterval(retryTimer)
    retryTimer = null
  }
}

function buildActivity() {
  return new PresenceBuilder()
    .setType(ActivityType.Playing)
    .setDetails("Optimizing your PC")
    .setState(`Running K3d Tweaks v${jsonData.version ?? "2"}`)
    .setStartTimestamp(Date.now())
    .addButton("Download K3d Tweaks", "https://github.com/vxyaq/k3d-tweaks")
    .addButton("Join Discord", "https://discord.com/invite/En5YJYWj3Z")
    .build()
}

async function startDiscordRPC(): Promise<boolean> {
  if (client) {
    return false
  }

  const rpc = new Client({ maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS })
  client = rpc

  rpc.on("READY", async () => {
    log.log("(rpc) Discord RPC connected")
    connected = true

    try {
      await rpc.setActivity(buildActivity())
      log.log("(rpc) Activity set successfully")
    } catch (err: any) {
      log.warn("(rpc) Failed to set Discord RPC activity:", err?.message ?? String(err))
    }
  })

  const markDown = () => {
    if (client === rpc) connected = false
  }
  rpc.on("disconnected", () => {
    log.log("(rpc) Discord RPC disconnected")
    markDown()
  })
  rpc.on("close", () => {
    log.log("(rpc) Discord RPC connection closed")
    markDown()
  })
  rpc.on("ERROR", (error: Error) => log.warn("(rpc) Discord RPC error:", error.message))
  rpc.on("reconnect_failed", () => {
    log.warn("(rpc) Discord RPC reconnect attempts exhausted, will retry")
    if (client === rpc) client = null
    scheduleRetry()
  })

  try {
    await rpc.login({ clientId: CLIENT_ID })
  } catch (error: any) {
    log.warn("(rpc) Discord RPC initialization failed:", error?.message ?? String(error))
    if (client === rpc) client = null
    try {
      await rpc.destroy()
    } catch {
      return false
    }
    scheduleRetry()
    return false
  }

  return true
}

async function stopDiscordRPC(): Promise<boolean> {
  if (!client) {
    return true
  }

  const current = client
  client = null
  connected = false
  clearRetry()

  try {
    await current.destroy()
  } catch (error: any) {
    log.warn("(rpc) Error stopping Discord RPC:", error.message)
  }

  log.log("(rpc) Discord RPC disconnected")
  return true
}

ipcMain.handle("start-discord-rpc", () => startDiscordRPC())
ipcMain.handle("stop-discord-rpc", () => stopDiscordRPC())

ipcMain.handle("rpc-enabled:get", () => store.get("rpcEnabled") !== false)

ipcMain.handle("rpc:status", () => ({ connected }))

ipcMain.handle("rpc-enabled:set", (_event, value: boolean) => {
  store.set("rpcEnabled", value)
  if (value) {
    startDiscordRPC()
  } else {
    stopDiscordRPC()
  }
  return value
})

export { startDiscordRPC, stopDiscordRPC }
