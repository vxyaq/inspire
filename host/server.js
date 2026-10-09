import { createServer } from "node:http"
import { randomBytes } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import readline from "node:readline"

const port = Number(process.env.PORT || 3000)
const clientId = process.env.DISCORD_CLIENT_ID || "1540168677708795966"
const clientSecret = process.env.DISCORD_CLIENT_SECRET
const redirectUri =
  process.env.DISCORD_REDIRECT_URI || "https://k3dauth.apps.bot-hosting.cloud/auth/discord/callback"
const appReturnUri = process.env.APP_RETURN_URI || "http://127.0.0.1:43817/oauth/discord/callback"
const licensePath = process.env.LICENSE_PATH || path.join(process.cwd(), "license.txt")

const missingVariables = [["DISCORD_CLIENT_SECRET", clientSecret]]
  .filter(([, value]) => !value)
  .map(([name]) => name)

if (missingVariables.length > 0) {
  throw new Error(`Missing environment variables: ${missingVariables.join(", ")}`)
}

const pendingStates = new Map()
const tickets = new Map()
const stateTtlMs = 10 * 60 * 1000
const ticketTtlMs = 60 * 1000

function loadLicenses() {
  const licenses = new Map()
  let raw = ""
  try {
    raw = fs.readFileSync(licensePath, "utf8")
  } catch {
    return licenses
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const parts = trimmed.split(/\s+/)
    if (parts.length < 2) continue
    const plan = parts[1].toLowerCase()
    if (plan !== "free" && plan !== "pro") continue
    licenses.set(parts[0].toLowerCase(), plan)
  }
  return licenses
}

function ensureLicenseFile() {
  try {
    fs.accessSync(licensePath)
    return false
  } catch {
    fs.writeFileSync(
      licensePath,
      "# hwid plan\n# 550e8400-e29b-41d4-a716-446655440000 pro\n",
      "utf8",
    )
    return true
  }
}

let licenseCache = loadLicenses()

function reloadLicenses() {
  licenseCache = loadLicenses()
  return licenseCache.size
}

function saveLicense(hwid, plan) {
  ensureLicenseFile()
  const target = hwid.toLowerCase()
  let raw = ""
  try {
    raw = fs.readFileSync(licensePath, "utf8")
  } catch {
    raw = ""
  }
  const lines = raw.split(/\r?\n/)
  let updated = false
  const next = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith("#") && trimmed.split(/\s+/)[0].toLowerCase() === target) {
      if (!updated) {
        next.push(`${target} ${plan}`)
        updated = true
      }
      continue
    }
    next.push(line)
  }
  if (!updated) next.push(`${target} ${plan}`)
  fs.writeFileSync(licensePath, next.join("\n"), "utf8")
  licenseCache.set(target, plan)
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" })
  response.end(JSON.stringify(body))
}

function redirect(response, location) {
  response.writeHead(302, { Location: location })
  response.end()
}

function html(response, status, title, message) {
  response.writeHead(status, { "Content-Type": "text/html; charset=utf-8" })
  response.end(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:system-ui;max-width:640px;margin:60px auto;padding:0 24px"><h1>${title}</h1><p>${message}</p></body></html>`)
}

function cleanup() {
  const now = Date.now()
  for (const [state, createdAt] of pendingStates) {
    if (now - createdAt > stateTtlMs) pendingStates.delete(state)
  }
  for (const [ticket, entry] of tickets) {
    if (now - entry.createdAt > ticketTtlMs) tickets.delete(ticket)
  }
}

async function readJson(request) {
  let body = ""
  for await (const chunk of request) body += chunk
  if (body.length > 16_384) throw new Error("Request body is too large.")
  return JSON.parse(body || "{}")
}

async function exchangeCode(code) {
  const response = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  })
  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after") || "?";
      throw new Error(`Discord rate limit (429). Try again in ${retryAfter} seconds.`);
    }
    throw new Error(`Discord token exchange failed (${response.status}).`);
  }
  const token = await response.json()
  if (!token.access_token) throw new Error("Discord did not return an access token.")
  return token.access_token
}

async function getDiscordProfile(accessToken) {
  const response = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error(`Discord profile request failed (${response.status}).`)
  const user = await response.json()
  return {
    provider: "discord",
    id: user.id,
    displayName: user.global_name || user.username,
    email: user.email || undefined,
    avatarUrl: user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
      : undefined,
  }
}

const server = createServer(async (request, response) => {
  cleanup()
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`)

  try {
    if (request.method === "GET" && url.pathname === "/auth/discord") {
      const state = url.searchParams.get("state")
      if (!state || state.length > 256) return json(response, 400, { error: "Invalid state." })
      pendingStates.set(state, Date.now())

      const authorizationUrl = new URL("https://discord.com/oauth2/authorize")
      authorizationUrl.search = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        scope: "identify email",
        redirect_uri: redirectUri,
        state,
      }).toString()
      return redirect(response, authorizationUrl.toString())
    }

    if (request.method === "GET" && url.pathname === "/auth/discord/callback") {
      const state = url.searchParams.get("state")
      const code = url.searchParams.get("code")
      const error = url.searchParams.get("error")
      if (!state || !pendingStates.has(state))
        return html(
          response,
          400,
          "Invalid sign-in",
          "This sign-in link was already used or expired. Go back to the app and click Sign in again to get a fresh link.",
        )
      if (error || !code) {
        pendingStates.delete(state)
        return html(response, 400, "Sign-in cancelled", "Discord did not authorize the request.")
      }

      const profile = await getDiscordProfile(await exchangeCode(code))
      pendingStates.delete(state)
      const ticket = randomBytes(32).toString("hex")
      tickets.set(ticket, { createdAt: Date.now(), profile })
      const appUrl = new URL(appReturnUri)
      appUrl.searchParams.set("ticket", ticket)
      appUrl.searchParams.set("state", state)
      return redirect(response, appUrl.toString())
    }

    if (request.method === "POST" && url.pathname === "/auth/discord/consume") {
      const body = await readJson(request)
      const ticket = typeof body.ticket === "string" ? body.ticket : ""
      const hwid = typeof body.hwid === "string" ? body.hwid.toLowerCase() : ""
      const entry = tickets.get(ticket)
      if (!entry || Date.now() - entry.createdAt > ticketTtlMs) {
        tickets.delete(ticket)
        return json(response, 401, { error: "Invalid or expired sign-in ticket." })
      }
      tickets.delete(ticket)
      const plan = licenseCache.get(hwid) || "free"
      return json(response, 200, { account: { ...entry.profile, plan } })
    }

    if (request.method === "GET" && url.pathname === "/plan") {
      const hwid = (url.searchParams.get("hwid") || "").toLowerCase()
      return json(response, 200, { plan: licenseCache.get(hwid) || "free" })
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, { ok: true })
    }

    return json(response, 404, { error: "Not found." })
  } catch (error) {
    console.error(error)
    const detail = error instanceof Error ? error.message : String(error)
    return json(response, 500, { error: `Authentication server error: ${detail}` })
  }
})

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.on("line", (line) => {
  const parts = line.trim().split(/\s+/)
  if (parts[0] === "/license" && parts.length === 1) {
    const created = ensureLicenseFile()
    console.log(created ? `Created ${licensePath}` : `Already exists: ${licensePath}`)
    console.log("Format: <hwid> <plan> (plan: free or pro, one per line)")
    console.log("Add directly: /license <hwid> <plan>")
    return
  }
  if (parts[0] === "/license" && parts.length === 3) {
    const plan = parts[2].toLowerCase()
    if (plan !== "free" && plan !== "pro") {
      console.log("Invalid plan. Use free or pro.")
      return
    }
    saveLicense(parts[1], plan)
    console.log(`Saved ${parts[1].toLowerCase()} as ${plan}.`)
    return
  }
  if (parts[0] === "/reload" && parts.length === 1) {
    const count = reloadLicenses()
    console.log(`Reloaded ${count} licenses. Users get the new plan on next app start.`)
    return
  }
})

server.listen(port, "0.0.0.0", () => {
  console.log(`K3d Tweaks auth server listening on port ${port}`)
})
