import { createServer } from "node:http"
import { randomBytes } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import readline from "node:readline"

const port = Number(process.env.SERVER_PORT || process.env.PORT || 3000)
const clientId = process.env.DISCORD_CLIENT_ID || "1540168677708795966"
const clientSecret = process.env.DISCORD_CLIENT_SECRET
const redirectUri =
  process.env.DISCORD_REDIRECT_URI || "https://k3dauth.apps.bot-hosting.cloud/auth/discord/callback"
const appReturnUri = process.env.APP_RETURN_URI || "http://127.0.0.1:43817/oauth/discord/callback"
const licensePath = process.env.LICENSE_PATH || path.join(process.cwd(), "license.txt")

const maxRequestBytes = 16_384
const rateWindowMs = 10 * 60 * 1000
const stateTtlMs = 10 * 60 * 1000
const ticketTtlMs = 60 * 1000
const maxPendingStates = 50000
const maxTickets = 50000

function validatedUrl(value, fallback, allowed) {
  try {
    const parsed = new URL(value || fallback)
    if (!allowed(parsed)) throw new Error("bad url")
    return parsed.toString().replace(/\/$/, "")
  } catch {
    return fallback
  }
}

const validatedRedirectUri = validatedUrl(
  redirectUri,
  "https://k3dauth.apps.bot-hosting.cloud/auth/discord/callback",
  (u) => u.protocol === "https:",
)

const validatedAppReturnUri = validatedUrl(
  appReturnUri,
  "http://127.0.0.1:43817/oauth/discord/callback",
  (u) =>
    (u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) ||
    false,
)

const missingVariables = [["DISCORD_CLIENT_SECRET", clientSecret]]
  .filter(([, value]) => !value)
  .map(([name]) => name)

if (missingVariables.length > 0) {
  throw new Error(`Missing environment variables: ${missingVariables.join(", ")}`)
}

const pendingStates = new Map()
const tickets = new Map()
const rateLimits = new Map()

function normalizeHwid(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
  if (!/^[0-9a-f-]{8,64}$/.test(normalized)) return ""
  return normalized
}

function getClientIp(request) {
  const fwd = request.headers["x-forwarded-for"]
  if (typeof fwd === "string" && fwd) return fwd.split(",")[0].trim()
  return (request.socket && request.socket.remoteAddress) || "unknown"
}

function isRateLimited(ip, scope, limit) {
  const now = Date.now()
  const key = `${scope}:${ip}`
  const hits = (rateLimits.get(key) || []).filter((t) => now - t < rateWindowMs)
  if (hits.length >= limit) return true
  hits.push(now)
  rateLimits.set(key, hits)
  return false
}

function applySecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff")
  response.setHeader("X-Frame-Options", "DENY")
  response.setHeader("Referrer-Policy", "no-referrer")
}

function applyCors(request, response) {
  const origin = request.headers.origin
  if (!origin) return true
  const allowed =
    origin.startsWith("file://") ||
    origin.includes("127.0.0.1") ||
    origin.includes("localhost")
  if (!allowed) return false
  response.setHeader("Access-Control-Allow-Origin", origin)
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  response.setHeader("Access-Control-Allow-Headers", "Content-Type")
  return true
}

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
    const hwid = normalizeHwid(parts[0])
    const plan = parts[1].toLowerCase()
    if (!hwid || (plan !== "free" && plan !== "pro")) continue
    licenses.set(hwid, plan)
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
  const target = normalizeHwid(hwid)
  const normalizedPlan = String(plan || "").toLowerCase()
  if (!target) throw new Error("Invalid HWID.")
  if (normalizedPlan !== "free" && normalizedPlan !== "pro") {
    throw new Error("Invalid plan. Use free or pro.")
  }
  ensureLicenseFile()
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
    if (
      trimmed &&
      !trimmed.startsWith("#") &&
      normalizeHwid(trimmed.split(/\s+/)[0]) === target
    ) {
      if (!updated) {
        next.push(`${target} ${normalizedPlan}`)
        updated = true
      }
      continue
    }
    next.push(line)
  }
  if (!updated) next.push(`${target} ${normalizedPlan}`)
  fs.writeFileSync(licensePath, next.join("\n"), "utf8")
  licenseCache.set(target, normalizedPlan)
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
    if (now - createdAt > stateTtlMs) {
      pendingStates.delete(state)
    }
  }
  for (const [ticket, entry] of tickets) {
    if (now - entry.createdAt > ticketTtlMs) {
      tickets.delete(ticket)
    }
  }
  for (const [key, hits] of rateLimits) {
    const activeHits = hits.filter((timestamp) => now - timestamp < rateWindowMs)
    if (activeHits.length) {
      rateLimits.set(key, activeHits)
    } else {
      rateLimits.delete(key)
    }
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

async function exchangeCode(code) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: validatedRedirectUri,
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
      continue
    }
    if (response.status === 429) {
      throw new Error("Discord rate limit reached.")
    }
    throw new Error(`Discord token exchange failed with status ${response.status}.`)
  }
  throw new Error("Discord token exchange failed after retry.")
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
  applySecurityHeaders(response)
  cleanup()
  let url
  try {
    url = new URL(request.url || "/", "http://localhost")
  } catch {
    return json(response, 400, { error: "Invalid request URL." })
  }
  if (!applyCors(request, response)) {
    return json(response, 403, { error: "Origin not allowed." })
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204, { "Content-Length": "0" })
    return response.end()
  }
  try {
    const ip = getClientIp(request)
    if (request.method === "GET" && url.pathname === "/auth/discord") {
      if (isRateLimited(ip, "login", 10)) {
        return json(response, 429, {
          error: "Too many sign-in attempts. Try again in a few minutes.",
        })
      }
      const state = url.searchParams.get("state") || ""
      if (!/^[A-Za-z0-9._~-]{1,256}$/.test(state)) {
        return json(response, 400, { error: "Invalid state." })
      }
      if (pendingStates.size >= maxPendingStates && !pendingStates.has(state)) {
        return json(response, 503, {
          error: "Authentication service is busy. Try again shortly.",
        })
      }
      pendingStates.set(state, Date.now())
      const authorizationUrl = new URL("https://discord.com/oauth2/authorize")
      authorizationUrl.search = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        scope: "identify email",
        redirect_uri: validatedRedirectUri,
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
        return html(
          response,
          400,
          "Invalid sign-in",
          "This sign-in link was already used or expired. Return to the app and try again.",
        )
      }
      pendingStates.delete(state)
      if (oauthError || !code) {
        return html(
          response,
          400,
          "Sign-in cancelled",
          "Discord did not authorize the request.",
        )
      }
      const accessToken = await exchangeCode(code)
      const profile = await getDiscordProfile(accessToken)
      if (tickets.size >= maxTickets) {
        return html(
          response,
          503,
          "Sign-in unavailable",
          "The authentication service is busy. Return to the app and try again.",
        )
      }
      const ticket = randomBytes(32).toString("hex")
      tickets.set(ticket, {
        createdAt: Date.now(),
        profile,
      })
      const appUrl = new URL(validatedAppReturnUri)
      appUrl.searchParams.set("ticket", ticket)
      appUrl.searchParams.set("state", state)
      return redirect(response, appUrl.toString())
    }
    if (request.method === "POST" && url.pathname === "/auth/discord/consume") {
      if (isRateLimited(ip, "consume", 30)) {
        return json(response, 429, {
          error: "Too many requests. Try again later.",
        })
      }
      const body = await readJson(request)
      const ticket = typeof body.ticket === "string" ? body.ticket : ""
      const hwid = normalizeHwid(body.hwid)
      if (!/^[a-f0-9]{64}$/.test(ticket) || !hwid) {
        return json(response, 400, {
          error: "Invalid ticket or HWID.",
        })
      }
      const entry = tickets.get(ticket)
      if (!entry || Date.now() - entry.createdAt > ticketTtlMs) {
        tickets.delete(ticket)
        return json(response, 401, {
          error: "Invalid or expired sign-in ticket.",
        })
      }
      tickets.delete(ticket)
      const plan = licenseCache.get(hwid) || "free"
      return json(response, 200, {
        account: {
          ...entry.profile,
          plan,
        },
      })
    }
    if (request.method === "GET" && url.pathname === "/plan") {
      if (isRateLimited(ip, "plan", 60)) {
        return json(response, 429, {
          error: "Too many requests. Try again later.",
        })
      }
      const hwid = normalizeHwid(url.searchParams.get("hwid") || "")
      if (!hwid) {
        return json(response, 400, { error: "Invalid HWID." })
      }
      return json(response, 200, {
        plan: licenseCache.get(hwid) || "free",
      })
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, { ok: true })
    }
    return json(response, 404, { error: "Not found." })
  } catch (error) {
    console.error(error)
    if (response.destroyed || response.writableEnded) {
      return
    }
    const message = error instanceof Error ? error.message : "Unexpected server error."
    if (message === "Invalid JSON body.") {
      return json(response, 400, { error: message })
    }
    if (message === "Request body is too large.") {
      return json(response, 413, { error: message })
    }
    return json(response, 500, {
      error: "Authentication server error.",
    })
  }
})

server.headersTimeout = 15000
server.requestTimeout = 20000
server.keepAliveTimeout = 5000

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

rl.on("line", (line) => {
  const parts = line.trim().split(/\s+/)
  if (!parts[0]) {
    return
  }
  if (parts[0] === "/license" && parts.length === 1) {
    try {
      const created = ensureLicenseFile()
      console.log(`${created ? "Created" : "Already exists"}: ${licensePath}`)
      console.log("Format: <hwid> <plan> (plan: free or pro, one per line)")
      console.log("Add directly: /license <hwid> <plan>")
    } catch (error) {
      console.error("Unable to initialize license file:", error)
    }
    return
  }
  if (parts[0] === "/license" && parts.length === 3) {
    try {
      saveLicense(parts[1], parts[2])
      console.log(`Saved ${parts[1].toLowerCase()} as ${parts[2].toLowerCase()}.`)
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Unable to save license.")
    }
    return
  }
  if (parts[0] === "/reload" && parts.length === 1) {
    const count = reloadLicenses()
    console.log(`Reloaded ${count} licenses.`)
    return
  }
  console.log("Unknown command. Use /license, /license <hwid> <plan> or /reload.")
})

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
