use axum::{routing::get, Json, Router};
use serde::Serialize;
use std::{env, net::SocketAddr};

#[derive(Serialize)]
struct Health {
    ok: bool,
}

#[derive(Serialize)]
struct Latest {
    version: String,
    url: String,
    notes: String,
}

async fn health() -> Json<Health> {
    Json(Health { ok: true })
}

async fn latest() -> Json<Latest> {
    Json(Latest {
        version: env::var("APP_VERSION").unwrap_or_else(|_| "0.0.0".to_string()),
        url: env::var("APP_DOWNLOAD_URL").unwrap_or_default(),
        notes: env::var("APP_NOTES").unwrap_or_default(),
    })
}

fn port() -> u16 {
    env::var("SERVER_PORT")
        .or_else(|_| env::var("PORT"))
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(3001)
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/health", get(health))
        .route("/latest", get(latest));
    let addr = SocketAddr::from(([0, 0, 0, 0], port()));
    println!("K3d update server on {addr}");
    axum::serve(
        tokio::net::TcpListener::bind(addr).await.unwrap(),
        app,
    )
    .await
    .unwrap();
}
