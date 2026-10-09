use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{Html, Redirect},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    env,
    fs,
    net::SocketAddr,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tokio::io::{self, AsyncBufReadExt};

const STATE_TTL: u64 = 600;
const TICKET_TTL: u64 = 60;
const RATE_WINDOW: u64 = 600;
const MAX_ENTRIES: usize = 50000;

#[derive(Clone)]
struct Config {
    port: u16,
    client_id: String,
    client_secret: String,
    redirect_uri: String,
    app_return_uri: String,
    license_path: PathBuf,
}

#[derive(Clone)]
struct Ticket {
    created_at: u64,
    profile: serde_json::Value,
}

struct Shared {
    config: Config,
    http: reqwest::Client,
    pending: Mutex<HashMap<String, u64>>,
    tickets: Mutex<HashMap<String, Ticket>>,
    licenses: Mutex<HashMap<String, String>>,
    rates: Mutex<HashMap<String, Vec<u64>>>,
}

type AppState = Arc<Shared>;

#[derive(Serialize)]
struct Health {
    ok: bool,
}

#[derive(Deserialize)]
struct ConsumeBody {
    ticket: Option<String>,
    hwid: Option<serde_json::Value>,
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn env_or(key: &str, fallback: &str) -> String {
    match env::var(key) {
        Ok(v) => {
            let trimmed = v.trim().to_string();
            if trimmed.is_empty() {
                fallback.to_string()
            } else {
                trimmed
            }
        }
        Err(_) => fallback.to_string(),
    }
}

fn normalize_hwid(value: &str) -> Option<String> {
    let v = value.trim().to_lowercase();
    if !(8..=64).contains(&v.len()) {
        return None;
    }
    if !v.chars().all(|c| c.is_ascii_hexdigit() || c == '-') {
        return None;
    }
    Some(v)
}

fn normalize_plan(value: &str) -> Option<String> {
    match value.trim().to_lowercase().as_str() {
        "free" => Some("free".to_string()),
        "pro" => Some("pro".to_string()),
        _ => None,
    }
}

fn load_licenses(path: &PathBuf) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let raw = fs::read_to_string(path).unwrap_or_default();
    for line in raw.lines() {
        let t = line.trim();
        if t.is_empty() || t.starts_with('#') {
            continue;
        }
        let mut parts = t.split_whitespace();
        let hwid = parts.next().unwrap_or("");
        let plan = parts.next().unwrap_or("");
        if let (Some(h), Some(p)) = (normalize_hwid(hwid), normalize_plan(plan)) {
            map.insert(h, p);
        }
    }
    map
}

fn ensure_license_file(path: &PathBuf) -> bool {
    if path.exists() {
        return false;
    }
    fs::write(
        path,
        "# hwid plan\n# 550e8400-e29b-41d4-a716-446655440000 pro\n",
    )
    .expect("unable to create license file");
    true
}

fn save_license(path: &PathBuf, map: &mut HashMap<String, String>, hwid: &str, plan: &str) {
    let target = normalize_hwid(hwid).expect("Invalid HWID.");
    let wanted = normalize_plan(plan).expect("Invalid plan. Use free or pro.");
    ensure_license_file(path);
    let raw = fs::read_to_string(path).unwrap_or_default();
    let mut next: Vec<String> = Vec::new();
    let mut updated = false;
    for line in raw.lines() {
        let t = line.trim();
        let first = t.split_whitespace().next().unwrap_or("");
        if !t.is_empty()
            && !t.starts_with('#')
            && normalize_hwid(first).as_deref() == Some(target.as_str())
        {
            if !updated {
                next.push(format!("{target} {wanted}"));
                updated = true;
            }
            continue;
        }
        next.push(line.to_string());
    }
    if !updated {
        next.push(format!("{target} {wanted}"));
    }
    fs::write(path, next.join("\n")).expect("unable to write license file");
    map.insert(target, wanted);
}

fn hex(bytes: &[u8]) -> String {
    const TABLE: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(TABLE[(b >> 4) as usize] as char);
        out.push(TABLE[(b & 15) as usize] as char);
    }
    out
}

fn client_ip(headers: &HeaderMap) -> String {
    if let Some(fwd) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
        if let Some(first) = fwd.split(',').next() {
            let trimmed = first.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }
    "unknown".to_string()
}

fn is_limited(state: &AppState, ip: &str, scope: &str, limit: usize) -> bool {
    let now = now();
    let mut rates = state.rates.lock().unwrap();
    let key = format!("{scope}:{ip}");
    let hits = rates.entry(key).or_default();
    hits.retain(|t| now - *t < RATE_WINDOW);
    if hits.len() >= limit {
        return true;
    }
    hits.push(now);
    false
}

fn prune(state: &AppState) {
    let now = now();
    state
        .pending
        .lock()
        .unwrap()
        .retain(|_, t| now - *t < STATE_TTL);
    state
        .tickets
        .lock()
        .unwrap()
        .retain(|_, t| now - t.created_at < TICKET_TTL);
    state.rates.lock().unwrap().retain(|_, hits| {
        hits.retain(|t| now - *t < RATE_WINDOW);
        !hits.is_empty()
    });
    if state.pending.lock().unwrap().len() > MAX_ENTRIES {
        state.pending.lock().unwrap().clear();
    }
    if state.tickets.lock().unwrap().len() > MAX_ENTRIES {
        state.tickets.lock().unwrap().clear();
    }
}

fn page(title: &str, message: &str) -> Html<String> {
    Html(format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>{title}</title></head><body style=\"font-family:system-ui;max-width:640px;margin:60px auto;padding:0 24px\"><h1>{title}</h1><p>{message}</p></body></html>"
    ))
}

fn valid_state(state: &str) -> bool {
    (1..=256).contains(&state.len())
        && state
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '~' | '-'))
}

fn url_encode(value: &str) -> String {
    let mut out = String::new();
    for b in value.bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'.' | b'_' | b'~') {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

fn bad_request(message: &str) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::BAD_REQUEST,
        Json(serde_json::json!({ "error": message })),
    )
}

fn login_limited() -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::TOO_MANY_REQUESTS,
        Json(
            serde_json::json!({ "error": "Too many sign-in attempts. Try again in a few minutes." }),
        ),
    )
}

fn busy_html() -> (StatusCode, Html<String>) {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        page(
            "Sign-in unavailable",
            "The authentication service is busy. Return to the app and try again.",
        ),
    )
}

async fn exchange_code(
    http: &reqwest::Client,
    client_id: &str,
    client_secret: &str,
    redirect_uri: &str,
    code: &str,
) -> Result<String, String> {
    for attempt in 0..2 {
        let body = format!(
            "client_id={}&client_secret={}&grant_type=authorization_code&code={}&redirect_uri={}",
            url_encode(client_id),
            url_encode(client_secret),
            url_encode(code),
            url_encode(redirect_uri)
        );
        let res = http
            .post("https://discord.com/api/v10/oauth2/token")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .map_err(|e| format!("Discord request failed: {e}"))?;
        if res.status().is_success() {
            let token: serde_json::Value =
                res.json().await.map_err(|_| "Bad token response.".to_string())?;
            if let Some(access) = token.get("access_token").and_then(|v| v.as_str()) {
                if !access.is_empty() {
                    return Ok(access.to_string());
                }
            }
            return Err("Discord did not return an access token.".to_string());
        }
        if res.status().as_u16() == 429 && attempt == 0 {
            let wait = res
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(2)
                .min(8);
            tokio::time::sleep(Duration::from_secs(wait)).await;
            continue;
        }
        if res.status().as_u16() == 429 {
            return Err("Discord rate limit reached.".to_string());
        }
        return Err(format!(
            "Discord token exchange failed with status {}.",
            res.status()
        ));
    }
    Err("Discord token exchange failed after retry.".to_string())
}

async fn discord_profile(
    http: &reqwest::Client,
    access_token: &str,
) -> Result<serde_json::Value, String> {
    let res = http
        .get("https://discord.com/api/v10/users/@me")
        .header("Authorization", format!("Bearer {access_token}"))
        .send()
        .await
        .map_err(|e| format!("Discord request failed: {e}"))?;
    if !res.status().is_success() {
        return Err(format!(
            "Discord profile request failed with status {}.",
            res.status()
        ));
    }
    let user: serde_json::Value = res
        .json()
        .await
        .map_err(|_| "Bad profile response.".to_string())?;
    let id = user.get("id").and_then(|v| v.as_str()).unwrap_or("");
    let username = user
        .get("username")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if id.is_empty() || username.is_empty() {
        return Err("Discord returned an invalid user profile.".to_string());
    }
    let display = user
        .get("global_name")
        .and_then(|v| v.as_str())
        .filter(|v| !v.is_empty())
        .unwrap_or(username);
    let avatar = user.get("avatar").and_then(|v| v.as_str()).unwrap_or("");
    let mut profile = serde_json::Map::new();
    profile.insert("provider".into(), "discord".into());
    profile.insert("id".into(), id.into());
    profile.insert("displayName".into(), display.into());
    if let Some(email) = user.get("email").and_then(|v| v.as_str()) {
        profile.insert("email".into(), email.into());
    }
    if !avatar.is_empty() {
        let ext = if avatar.starts_with("a_") { "gif" } else { "png" };
        profile.insert(
            "avatarUrl".into(),
            format!("https://cdn.discordapp.com/avatars/{id}/{avatar}.{ext}?size=128").into(),
        );
    }
    Ok(serde_json::Value::Object(profile))
}

async fn auth_start(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Redirect, (StatusCode, Json<serde_json::Value>)> {
    if is_limited(&state, &client_ip(&headers), "login", 10) {
        return Err(login_limited());
    }
    let oauth_state = params.get("state").cloned().unwrap_or_default();
    if !valid_state(&oauth_state) {
        return Err(bad_request("Invalid state."));
    }
    {
        let mut pending = state.pending.lock().unwrap();
        if pending.len() >= MAX_ENTRIES && !pending.contains_key(&oauth_state) {
            return Err((
                StatusCode::SERVICE_UNAVAILABLE,
                Json(
                    serde_json::json!({ "error": "Authentication service is busy. Try again shortly." }),
                ),
            ));
        }
        pending.insert(oauth_state.clone(), now());
    }
    let cfg = &state.config;
    Ok(Redirect::to(&format!(
        "https://discord.com/oauth2/authorize?response_type=code&client_id={}&scope=identify%20email&redirect_uri={}&state={}",
        url_encode(&cfg.client_id),
        url_encode(&cfg.redirect_uri),
        url_encode(&oauth_state)
    )))
}

async fn auth_callback(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Redirect, (StatusCode, Html<String>)> {
    let oauth_state = params.get("state").cloned().unwrap_or_default();
    let code = params.get("code").cloned().unwrap_or_default();
    let oauth_error = params.get("error").cloned().unwrap_or_default();
    let created_at = state.pending.lock().unwrap().get(&oauth_state).copied();
    if oauth_state.is_empty() || created_at.is_none() || now() - created_at.unwrap() > STATE_TTL {
        state.pending.lock().unwrap().remove(&oauth_state);
        return Err((
            StatusCode::BAD_REQUEST,
            page(
                "Invalid sign-in",
                "This sign-in link was already used or expired. Return to the app and try again.",
            ),
        ));
    }
    state.pending.lock().unwrap().remove(&oauth_state);
    if !oauth_error.is_empty() || code.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            page("Sign-in cancelled", "Discord did not authorize the request."),
        ));
    }
    let cfg = state.config.clone();
    let access = exchange_code(
        &state.http,
        &cfg.client_id,
        &cfg.client_secret,
        &cfg.redirect_uri,
        &code,
    )
    .await
    .map_err(|e| {
        eprintln!("exchange failed: {e}");
        (
            StatusCode::BAD_GATEWAY,
            page("Sign-in failed", "Discord did not authorize the request. Try again."),
        )
    })?;
    let profile = discord_profile(&state.http, &access).await.map_err(|e| {
        eprintln!("profile failed: {e}");
        (
            StatusCode::BAD_GATEWAY,
            page("Sign-in failed", "Discord did not authorize the request. Try again."),
        )
    })?;
    {
        if state.tickets.lock().unwrap().len() >= MAX_ENTRIES {
            return Err(busy_html());
        }
        let bytes: [u8; 32] = rand::random();
        let ticket = hex(&bytes);
        state.tickets.lock().unwrap().insert(
            ticket.clone(),
            Ticket {
                created_at: now(),
                profile,
            },
        );
        let url = format!(
            "{}?ticket={}&state={}",
            cfg.app_return_uri,
            ticket,
            url_encode(&oauth_state)
        );
        return Ok(Redirect::to(&url));
    }
}

async fn consume(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<serde_json::Value>,
) -> (StatusCode, Json<serde_json::Value>) {
    if is_limited(&state, &client_ip(&headers), "consume", 30) {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(serde_json::json!({ "error": "Too many requests. Try again later." })),
        );
    }
    let ticket = body.get("ticket").and_then(|v| v.as_str()).unwrap_or("");
    let hwid_raw = body.get("hwid").and_then(|v| v.as_str()).unwrap_or("");
    let hwid = normalize_hwid(hwid_raw).unwrap_or_default();
    if ticket.len() != 64
        || !ticket.chars().all(|c| c.is_ascii_hexdigit())
        || hwid.is_empty()
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid ticket or HWID." })),
        );
    }
    let entry = state.tickets.lock().unwrap().remove(ticket);
    match entry {
        Some(e) if now() - e.created_at < TICKET_TTL => {
            let plan = state
                .licenses
                .lock()
                .unwrap()
                .get(&hwid)
                .cloned()
                .unwrap_or_else(|| "free".to_string());
            let mut account = e.profile;
            if let Some(obj) = account.as_object_mut() {
                obj.insert("plan".to_string(), plan.into());
            }
            (StatusCode::OK, Json(serde_json::json!({ "account": account })))
        }
        _ => (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Invalid or expired sign-in ticket." })),
        ),
    }
}

async fn plan(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> (StatusCode, Json<serde_json::Value>) {
    if is_limited(&state, &client_ip(&headers), "plan", 60) {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(serde_json::json!({ "error": "Too many requests. Try again later." })),
        );
    }
    let hwid = normalize_hwid(params.get("hwid").cloned().unwrap_or_default().as_str())
        .unwrap_or_default();
    if hwid.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid HWID." })),
        );
    }
    let plan = state
        .licenses
        .lock()
        .unwrap()
        .get(&hwid)
        .cloned()
        .unwrap_or_else(|| "free".to_string());
    (StatusCode::OK, Json(serde_json::json!({ "plan": plan })))
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "ok": true }))
}

fn handle_line(state: &AppState, line: &str) {
    let parts: Vec<&str> = line.trim().split_whitespace().collect();
    if parts.is_empty() {
        return;
    }
    let path = state.config.license_path.clone();
    if parts[0] == "/license" && parts.len() == 1 {
        if ensure_license_file(&path) {
            println!("Created: {}", path.display());
        } else {
            println!("Already exists: {}", path.display());
        }
        println!("Format: <hwid> <plan> (plan: free or pro, one per line)");
        println!("Add directly: /license <hwid> <plan>");
        return;
    }
    if parts[0] == "/license" && parts.len() == 3 {
        let mut licenses = state.licenses.lock().unwrap();
        match (normalize_hwid(parts[1]), normalize_plan(parts[2])) {
            (Some(_), Some(_)) => {
                save_license(&path, &mut licenses, parts[1], parts[2]);
                println!(
                    "Saved {} as {}.",
                    parts[1].to_lowercase(),
                    parts[2].to_lowercase()
                );
            }
            _ => println!("Invalid HWID or plan. Use free or pro."),
        }
        return;
    }
    if parts[0] == "/reload" && parts.len() == 1 {
        let fresh = load_licenses(&path);
        let count = fresh.len();
        *state.licenses.lock().unwrap() = fresh;
        println!("Reloaded {count} licenses.");
        return;
    }
    println!("Unknown command. Use /license, /license <hwid> <plan> or /reload.");
}

#[tokio::main]
async fn main() {
    let secret = env_or("DISCORD_CLIENT_SECRET", "");
    if secret.is_empty() {
        eprintln!("Missing environment variables: DISCORD_CLIENT_SECRET");
        std::process::exit(1);
    }
    let port: u16 = env::var("SERVER_PORT")
        .or_else(|_| env::var("PORT"))
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(3000);
    let config = Config {
        port,
        client_id: env_or("DISCORD_CLIENT_ID", "1540168677708795966"),
        client_secret: secret,
        redirect_uri: env_or(
            "DISCORD_REDIRECT_URI",
            "https://k3dauth.apps.bot-hosting.cloud/auth/discord/callback",
        ),
        app_return_uri: env_or(
            "APP_RETURN_URI",
            "http://127.0.0.1:43817/oauth/discord/callback",
        ),
        license_path: PathBuf::from(env_or("LICENSE_PATH", "license.txt")),
    };
    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .expect("http client");
    let state: AppState = Arc::new(Shared {
        config: config.clone(),
        http,
        pending: Mutex::new(HashMap::new()),
        tickets: Mutex::new(HashMap::new()),
        licenses: Mutex::new(load_licenses(&config.license_path)),
        rates: Mutex::new(HashMap::new()),
    });
    let prune_state = state.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(60)).await;
            prune(&prune_state);
        }
    });
    let repl_state = state.clone();
    tokio::spawn(async move {
        let stdin = io::stdin();
        let mut lines = io::BufReader::new(stdin).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            handle_line(&repl_state, &line);
        }
    });
    let app = Router::new()
        .route("/auth/discord", get(auth_start))
        .route("/auth/discord/callback", get(auth_callback))
        .route("/auth/discord/consume", post(consume))
        .route("/plan", get(plan))
        .route("/health", get(health))
        .with_state(state);
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    println!("K3d Tweaks auth server listening on port {}", config.port);
    println!("License file: {}", config.license_path.display());
    axum::serve(
        tokio::net::TcpListener::bind(addr).await.unwrap(),
        app.into_make_service(),
    )
    .await
    .unwrap();
}
