import { ipcMain, shell } from "electron"
import { createServer, type Server } from "node:http"
import { randomBytes } from "node:crypto"
import Store from "electron-store"
import si from "systeminformation"

export type AuthProvider = "discord" | "google"

export interface AccountProfile {
  provider: AuthProvider
  id: string
  displayName: string
  email?: string
  avatarUrl?: string
  plan?: "free" | "pro"
}

type AuthResponse =
  | { ok: true; account: AccountProfile }
  | { ok: false; error: string }

const store = new Store<{ account?: AccountProfile; authResetVersion?: number }>()
const AUTH_SERVER_URL = "https://inspire.wisp.uno"
const DISCORD_REDIRECT_URI = "http://127.0.0.1:43817/oauth/discord/callback"

const AUTH_RESET_VERSION = 1
if (store.get("authResetVersion") !== AUTH_RESET_VERSION) {
  store.delete("account")
  store.set("authResetVersion", AUTH_RESET_VERSION)
}

let activeLogin: Promise<AuthResponse> | null = null

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()))
}

function waitForDiscordCallback(state: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const callbackUrl = new URL(request.url ?? "/", DISCORD_REDIRECT_URI)
      if (callbackUrl.pathname !== "/oauth/discord/callback") {
        response.writeHead(404).end()
        return
      }

      const returnedState = callbackUrl.searchParams.get("state")
      const error = callbackUrl.searchParams.get("error")
      const ticket = callbackUrl.searchParams.get("ticket")
      clearTimeout(timeout)

      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      response.end(
        `<html><body style="font-family: sans-serif; text-align: center; padding: 40px;"><h2>${
          error ? "Sign-in was cancelled" : "Sign-in complete"
        }</h2><p>You can close this window and return to K3d Tweaks.</p></body></html>`,
      )

      void closeServer(server)
      if (error) {
        reject(new Error(`Discord OAuth failed: ${error}`))
      } else if (!ticket || returnedState !== state) {
        reject(new Error("Invalid Discord OAuth callback."))
      } else {
        resolve(ticket)
      }
    })

    const timeout = setTimeout(() => {
      void closeServer(server)
      reject(new Error("Discord sign-in timed out."))
    }, 5 * 60 * 1000)

    server.once("error", (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    server.listen(43817, "127.0.0.1")
  })
}

async function loginWithDiscord(): Promise<AuthResponse> {
  const state = randomBytes(32).toString("hex")
  const authorizationUrl = new URL(`${AUTH_SERVER_URL}/auth/discord`)
  authorizationUrl.searchParams.set("state", state)
  const callback = waitForDiscordCallback(state)
  if (!authorizationUrl.protocol.startsWith("https")) {
    throw new Error("Refusing to open a non-HTTPS authorization URL.")
  }
  await shell.openExternal(authorizationUrl.toString())
  const ticket = await callback
  let hwid = ""
  try {
    const uuidData = await si.uuid()
    hwid = uuidData.os || uuidData.hardware || ""
  } catch {
    hwid = ""
  }
  const profileResponse = await fetch(`${AUTH_SERVER_URL}/auth/discord/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket, hwid }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!profileResponse.ok) {
    throw new Error(`Login server rejected the request (${profileResponse.status}).`)
  }

  const contentType = profileResponse.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    throw new Error("Login server is unavailable. Try again later.")
  }

  const payload = (await profileResponse.json()) as { account?: AccountProfile }
  if (!payload.account) throw new Error("Auth server did not return an account.")
  const account = payload.account
  store.set("account", account)
  return { ok: true, account }
}

ipcMain.handle("auth:get-session", (): AccountProfile | null => {
  return store.get("account") ?? null
})

async function refreshAccountPlan(): Promise<AccountProfile | null> {
  const account = store.get("account")
  if (!account) return null
  let hwid = ""
  try {
    const uuidData = await si.uuid()
    hwid = uuidData.os || uuidData.hardware || ""
  } catch {
    hwid = ""
  }
  if (!hwid) return account
  try {
    const planResponse = await fetch(
      `${AUTH_SERVER_URL}/plan?hwid=${encodeURIComponent(hwid)}`,
      { signal: AbortSignal.timeout(10_000) },
    )
    if (!planResponse.ok) return account
    const data = (await planResponse.json()) as { plan?: string }
    const plan: "free" | "pro" = data.plan === "pro" ? "pro" : "free"
    if (plan === account.plan) return account
    const updated = { ...account, plan }
    store.set("account", updated)
    return updated
  } catch {
    return account
  }
}

ipcMain.handle("auth:refresh-plan", refreshAccountPlan)

ipcMain.handle("auth:login", async (_event, provider: AuthProvider): Promise<AuthResponse> => {
  if (provider !== "discord" && provider !== "google") {
    return { ok: false, error: "Unsupported login provider." }
  }

  if (provider === "discord") {
    if (!activeLogin) {
      activeLogin = loginWithDiscord().catch((error) => ({
        ok: false as const,
    error:
      error instanceof DOMException && error.name === "TimeoutError"
        ? "Login server did not respond in time."
        : error instanceof TypeError
          ? "Could not connect to the login server."
          : error instanceof Error
            ? error.message
            : String(error),
      }))
      void activeLogin.then(
        () => {
          activeLogin = null
        },
        () => {
          activeLogin = null
        },
      )
    }
    return activeLogin
  }

  return { ok: false, error: "Google OAuth is not configured yet. Add a Google Client ID first." }
})

