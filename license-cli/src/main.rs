use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::{self, BufRead};
use std::path::PathBuf;

fn license_path() -> PathBuf {
    match env::var("LICENSE_PATH") {
        Ok(p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => PathBuf::from("license.txt"),
    }
}

fn normalize_hwid(value: &str) -> Option<String> {
    let normalized = value.trim().to_lowercase();
    let ok_len = (8..=64).contains(&normalized.len());
    let ok_chars = normalized.chars().all(|c| c.is_ascii_hexdigit() || c == '-');
    if ok_len && ok_chars {
        Some(normalized)
    } else {
        None
    }
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
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let mut parts = trimmed.split_whitespace();
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
    let normalized_plan = normalize_plan(plan).expect("Invalid plan. Use free or pro.");
    ensure_license_file(path);
    let raw = fs::read_to_string(path).unwrap_or_default();
    let mut next: Vec<String> = Vec::new();
    let mut updated = false;
    for line in raw.lines() {
        let trimmed = line.trim();
        if !trimmed.is_empty()
            && !trimmed.starts_with('#')
            && normalize_hwid(trimmed.split_whitespace().next().unwrap_or("")) == Some(target.clone())
        {
            if !updated {
                next.push(format!("{target} {normalized_plan}"));
                updated = true;
            }
            continue;
        }
        next.push(line.to_string());
    }
    if !updated {
        next.push(format!("{target} {normalized_plan}"));
    }
    fs::write(path, next.join("\n")).expect("unable to write license file");
    map.insert(target, normalized_plan);
}

fn handle_line(path: &PathBuf, map: &mut HashMap<String, String>, line: &str) {
    let parts: Vec<&str> = line.trim().split_whitespace().collect();
    if parts.is_empty() {
        return;
    }
    if parts[0] == "/license" && parts.len() == 1 {
        if ensure_license_file(path) {
            println!("Created: {}", path.display());
        } else {
            println!("Already exists: {}", path.display());
        }
        println!("Format: <hwid> <plan> (plan: free or pro, one per line)");
        println!("Add directly: /license <hwid> <plan>");
        return;
    }
    if parts[0] == "/license" && parts.len() == 3 {
        match (normalize_hwid(parts[1]), normalize_plan(parts[2])) {
            (Some(_), Some(_)) => {
                save_license(path, map, parts[1], parts[2]);
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
        *map = load_licenses(path);
        println!("Reloaded {} licenses.", map.len());
        return;
    }
    println!("Unknown command. Use /license, /license <hwid> <plan> or /reload.");
}

fn main() {
    let path = license_path();
    let mut map = load_licenses(&path);
    let args: Vec<String> = env::args().skip(1).collect();
    if !args.is_empty() {
        handle_line(&path, &mut map, &args.join(" "));
        return;
    }
    let stdin = io::stdin();
    for line in stdin.lock().lines() {
        match line {
            Ok(text) => handle_line(&path, &mut map, &text),
            Err(_) => break,
        }
    }
}
