import { createServer } from "node:http"
import { randomBytes } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import readline from "node:readline"

const port = Number(process.env.SERVER_PORT || process.env.PORT || 3000)
const clientId = process.env.DISCORD_CLIENT_ID || "1540168677708795966"
const clientSecret = process.env.DISCORD_CLIENT_SECRET
const redirectUri = process.env.DISCORD_REDIRECT_URI || "https://k3dauth.apps.bot-hosting.cloud/auth/discord/callback"
const appReturnUri = process.env.APP_RETURN_URI || "http://127.0.0.1:43817/oauth/discord/callback"
const licensePath = process.env.LICENSE_PATH || path.join(process.cwd(), "license.txt")

const maxRequestBytes = 16384
const rateWindowMs = 10 * 60 * 1000
const stateTtlMs = 10 * 60 * 1000
const ticketTtlMs = 60 * 1000
const maxEntries = 50000

if (!clientSecret) {
  throw new Error("Missing environment variables: DISCORD_CLIENT_SECRET")
}

const pendingStates = new Map()
const tickets = new Map()
const rateLimits = new Map()

function normalizeHwid(value) {
  const v = String(value || "").trim().toLowerCase()
  if (v.length < 8 || v.length > 64) return ""
  if (!/^[0-9a-f-]+$/.test(v)) return ""
  return v
}

function normalizePlan(value) {
  const v = String(value || "").trim().toLowerCase()
  if (v !== "free" && v !== "pro") return ""
  return v
}

function parseExpiry(value) {
  if (!value) return 0
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim())
  if (!match) return -1
  const time = Date.parse(`${match[1]}-${match[2]}-${match[3]}T23:59:59Z`)
  return Number.isNaN(time) ? -1 : time
}

function loadLicenses() {
  const map = new Map()
  let raw = ""
  try {
    raw = fs.readFileSync(licensePath, "utf8")
  } catch {
    return map
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const parts = trimmed.split(/\s+/)
    if (parts.length < 2) continue
    const hwid = normalizeHwid(parts[0])
    const plan = normalizePlan(parts[1])
    const expiry = parseExpiry(parts[2] || "")
    if (!hwid || !plan || expiry === -1) continue
    map.set(hwid, { plan, expiry })
  }
  return map
}

let licenseCache = loadLicenses()

function planFor(hwid) {
  const entry = licenseCache.get(hwid)
  if (!entry) return "free"
  if (entry.expiry > 0 && Date.now() > entry.expiry) return "free"
  return entry.plan
}

function ensureLicenseFile() {
  try {
    fs.accessSync(licensePath)
    return false
  } catch {
    fs.writeFileSync(licensePath, "# hwid plan [expires YYYY-MM-DD]\n# 550e8400-e29b-41d4-a716-446655440000 pro\n", "utf8")
    return true
  }
}

function saveLicense(hwid, plan, expires) {
  const target = normalizeHwid(hwid)
  const wanted = normalizePlan(plan)
  const expiry = parseExpiry(expires || "")
  if (!target) throw new Error("Invalid HWID.")
  if (!wanted) throw new Error("Invalid plan. Use free or pro.")
  if (expiry === -1) throw new Error("Invalid expiry. Use YYYY-MM-DD.")
  ensureLicenseFile()
  let raw = ""
  try {
    raw = fs.readFileSync(licensePath, "utf8")
  } catch {
    raw = ""
  }
  const lines = raw.split(/\r?\n/)
  const next = []
  let updated = false
  for (const line of lines) {
    const trimmed = line.trim()
    const first = trimmed.split(/\s+/)[0] || ""
    if (trimmed && !trimmed.startsWith("#") && normalizeHwid(first) === target) {
      if (!updated) {
        next.push(expiry > 0 ? `${target} ${wanted} ${expires}` : `${target} ${wanted}`)
        updated = true
      }
      continue
    }
    next.push(line)
  }
  if (!updated) {
    next.push(expiry > 0 ? `${target} ${wanted} ${expires}` : `${target} ${wanted}`)
  }
  fs.writeFileSync(licensePath, next.join("\n"), "utf8")
  licenseCache.set(target, { plan: wanted, expiry })
}

function removeLicense(hwid) {
  const target = normalizeHwid(hwid)
  if (!target) throw new Error("Invalid HWID.")
  let raw = ""
  try {
    raw = fs.readFileSync(licensePath, "utf8")
  } catch {
    raw = ""
  }
  const next = raw.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim()
    const first = trimmed.split(/\s+/)[0] || ""
    return !(trimmed && !trimmed.startsWith("#") && normalizeHwid(first) === target)
  })
  fs.writeFileSync(licensePath, next.join("\n"), "utf8")
  return licenseCache.delete(target)
}

function clientIp(request) {
  const fwd = request.headers["x-forwarded-for"]
  if (typeof fwd === "string" && fwd) {
    const first = fwd.split(",")[0].trim()
    if (first) return first
  }
  return (request.socket && request.socket.remoteAddress) || "unknown"
}

function isLimited(ip, scope, limit) {
  const now = Date.now()
  const key = `${scope}:${ip}`
  const hits = (rateLimits.get(key) || []).filter((t) => now - t < rateWindowMs)
  if (hits.length >= limit) return true
  hits.push(now)
  rateLimits.set(key, hits)
  return false
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

function originAllowed(request) {
  const origin = request.headers.origin
  if (!origin) return true
  return (
    origin.startsWith("file://") ||
    origin.includes("127.0.0.1") ||
    origin.includes("localhost")
  )
}

function cleanup() {
  const now = Date.now()
  for (const [state, createdAt] of pendingStates) {
    if (now - createdAt > stateTtlMs) pendingStates.delete(state)
  }
  for (const [ticket, entry] of tickets) {
    if (now - entry.createdAt > ticketTtlMs) tickets.delete(ticket)
  }
  for (const [key, hits] of rateLimits) {
    const active = hits.filter((t) => now - t < rateWindowMs)
    if (active.length) rateLimits.set(key, active)
    else rateLimits.delete(key)
  }
}

async function readJson(request) {
  const contentLength = Number(request.headers["content-length"] || 0)
  if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
    request.resume()
    throw new Error("Request body is too large.")
  }
  const chunks = []
  let total = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length
    if (total > maxRequestBytes) {
      request.resume()
      throw new Error("Request body is too large.")
    }
    chunks.push(buffer)
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid JSON body.")
    }
    return parsed
  } catch {
    throw new Error("Invalid JSON body.")
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function exchangeCode(code, attempt) {
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
    signal: AbortSignal.timeout(10000),
  })
  if (response.ok) {
    const token = await response.json()
    if (typeof token.access_token !== "string" || !token.access_token) {
      throw new Error("Discord did not return an access token.")
    }
    return token.access_token
  }
  if (response.status === 429 && attempt === 0) {
    const retryAfter = Number(response.headers.get("retry-after") || "2")
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000
    await sleep(Math.min(waitMs, 8000))
    return exchangeCode(code, 1)
  }
  if (response.status === 429) {
    throw new Error("Discord rate limit reached.")
  }
  throw new Error(`Discord token exchange failed with status ${response.status}.`)
}

async function getDiscordProfile(accessToken) {
  const response = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) {
    throw new Error(`Discord profile request failed with status ${response.status}.`)
  }
  const user = await response.json()
  if (typeof user.id !== "string" || typeof user.username !== "string") {
    throw new Error("Discord returned an invalid user profile.")
  }
  const avatarHash = typeof user.avatar === "string" ? user.avatar : ""
  const extension = avatarHash.startsWith("a_") ? "gif" : "png"
  return {
    provider: "discord",
    id: user.id,
    displayName:
      typeof user.global_name === "string" && user.global_name
        ? user.global_name
        : user.username,
    email: typeof user.email === "string" ? user.email : undefined,
    avatarUrl: avatarHash
      ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(avatarHash)}.${extension}?size=128`
      : undefined,
  }
}

const server = createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff")
  response.setHeader("X-Frame-Options", "DENY")
  response.setHeader("Referrer-Policy", "no-referrer")
  cleanup()
  let url
  try {
    url = new URL(request.url || "/", "http://localhost")
  } catch {
    return json(response, 400, { error: "Invalid request URL." })
  }
  if (!originAllowed(request)) {
    return json(response, 403, { error: "Origin not allowed." })
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204, { "Content-Length": "0" })
    return response.end()
  }
  try {
    const ip = clientIp(request)
    if (request.method === "GET" && url.pathname === "/auth/discord") {
      if (isLimited(ip, "login", 10)) {
        return json(response, 429, { error: "Too many sign-in attempts. Try again in a few minutes." })
      }
      const state = url.searchParams.get("state") || ""
      if (!/^[A-Za-z0-9._~-]{1,256}$/.test(state)) {
        return json(response, 400, { error: "Invalid state." })
      }
      if (pendingStates.size >= maxEntries && !pendingStates.has(state)) {
        return json(response, 503, { error: "Authentication service is busy. Try again shortly." })
      }
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
      const state = url.searchParams.get("state") || ""
      const code = url.searchParams.get("code") || ""
      const oauthError = url.searchParams.get("error")
      const createdAt = pendingStates.get(state)
      if (!state || createdAt === undefined || Date.now() - createdAt > stateTtlMs) {
        pendingStates.delete(state)
        return html(response, 400, "Invalid sign-in", "This sign-in link was already used or expired. Return to the app and try again.")
      }
      pendingStates.delete(state)
      if (oauthError || !code) {
        return html(response, 400, "Sign-in cancelled", "Discord did not authorize the request.")
      }
      const profile = await getDiscordProfile(await exchangeCode(code, 0))
      if (tickets.size >= maxEntries) {
        return html(response, 503, "Sign-in unavailable", "The authentication service is busy. Return to the app and try again.")
      }
      const ticket = randomBytes(32).toString("hex")
      tickets.set(ticket, { createdAt: Date.now(), profile })
      const appUrl = new URL(appReturnUri)
      appUrl.searchParams.set("ticket", ticket)
      appUrl.searchParams.set("state", state)
      return redirect(response, appUrl.toString())
    }
    if (request.method === "POST" && url.pathname === "/auth/discord/consume") {
      if (isLimited(ip, "consume", 30)) {
        return json(response, 429, { error: "Too many requests. Try again later." })
      }
      const body = await readJson(request)
      const ticket = typeof body.ticket === "string" ? body.ticket : ""
      const hwid = normalizeHwid(body.hwid)
      if (!/^[a-f0-9]{64}$/.test(ticket) || !hwid) {
        return json(response, 400, { error: "Invalid ticket or HWID." })
      }
      const entry = tickets.get(ticket)
      if (!entry || Date.now() - entry.createdAt > ticketTtlMs) {
        tickets.delete(ticket)
        return json(response, 401, { error: "Invalid or expired sign-in ticket." })
      }
      tickets.delete(ticket)
      return json(response, 200, { account: { ...entry.profile, plan: planFor(hwid) } })
    }
    if (request.method === "GET" && url.pathname === "/plan") {
      if (isLimited(ip, "plan", 60)) {
        return json(response, 429, { error: "Too many requests. Try again later." })
      }
      const hwid = normalizeHwid(url.searchParams.get("hwid") || "")
      if (!hwid) {
        return json(response, 400, { error: "Invalid HWID." })
      }
      return json(response, 200, { plan: planFor(hwid) })
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, { ok: true })
    }
    return json(response, 404, { error: "Not found." })
  } catch (error) {
    console.error(error)
    if (response.destroyed || response.writableEnded) return
    const message = error instanceof Error ? error.message : "Unexpected server error."
    if (message === "Invalid JSON body.") return json(response, 400, { error: message })
    if (message === "Request body is too large.") return json(response, 413, { error: message })
    return json(response, 500, { error: "Authentication server error." })
  }
})

server.headersTimeout = 15000
server.requestTimeout = 20000
server.keepAliveTimeout = 5000

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.on("line", (line) => {
  const parts = line.trim().split(/\s+/)
  if (!parts[0]) return
  if (parts[0] === "/license" && parts.length === 1) {
    try {
      const created = ensureLicenseFile()
      console.log(`${created ? "Created" : "Already exists"}: ${licensePath}`)
      console.log("Format: <hwid> <plan> [expires YYYY-MM-DD]")
      console.log("Add directly: /license <hwid> <plan> [expires]")
    } catch (error) {
      console.error("Unable to initialize license file:", error)
    }
    return
  }
  if (parts[0] === "/license" && (parts.length === 3 || parts.length === 4)) {
    try {
      saveLicense(parts[1], parts[2], parts[3] || "")
      console.log(`Saved ${parts[1].toLowerCase()} as ${parts[2].toLowerCase()}.`)
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Unable to save license.")
    }
    return
  }
  if (parts[0] === "/licenses" && parts.length === 1) {
    if (licenseCache.size === 0) {
      console.log("No licenses.")
      return
    }
    for (const [hwid, entry] of licenseCache) {
      const status = entry.expiry > 0 && Date.now() > entry.expiry ? "expired" : entry.plan
      const extra = entry.expiry > 0 ? ` until ${new Date(entry.expiry).toISOString().slice(0, 10)}` : ""
      console.log(`${hwid} ${status}${extra}`)
    }
    return
  }
  if (parts[0] === "/remove" && parts.length === 2) {
    try {
      if (removeLicense(parts[1])) console.log(`Removed ${parts[1].toLowerCase()}.`)
      else console.log("License not found.")
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Unable to remove license.")
    }
    return
  }
  if (parts[0] === "/reload" && parts.length === 1) {
    const count = reloadLicenses()
    console.log(`Reloaded ${count} licenses.`)
    return
  }
  console.log("Unknown command. Use /license, /licenses, /remove <hwid> or /reload.")
})

function reloadLicenses() {
  licenseCache = loadLicenses()
  return licenseCache.size
}

function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`)
  rl.close()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 5000).unref()
}

process.once("SIGINT", () => shutdown("SIGINT"))
process.once("SIGTERM", () => shutdown("SIGTERM"))

server.listen(port, "0.0.0.0", () => {
  console.log(`K3d Tweaks auth server listening on port ${port}`)
  console.log(`License file: ${licensePath}`)
})
