const CONFIG = {
  clientId: "1540168677708795966",
  redirectUri: window.location.origin + window.location.pathname,
  discordInvite: "#",
};

async function fetchProfile(token) {
  const res = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) throw new Error("profile");
  return res.json();
}

function renderUser(user) {
  const area = document.getElementById("auth-area");
  const avatar = user.avatar
    ? "https://cdn.discordapp.com/avatars/" + user.id + "/" + user.avatar + ".png?size=64"
    : "assets/k3dtweaks-logo.svg";
  const name = user.global_name || user.username;
  area.innerHTML = "";
  const chip = document.createElement("div");
  chip.className = "user-chip";
  const img = document.createElement("img");
  img.src = avatar;
  img.alt = "";
  const span = document.createElement("span");
  span.textContent = name;
  const out = document.createElement("button");
  out.textContent = "Log out";
  out.onclick = () => {
    sessionStorage.removeItem("k3d_token");
    history.replaceState(null, "", window.location.pathname);
    window.location.reload();
  };
  chip.append(img, span, out);
  area.append(chip);
}

async function initAuth() {
  const buy = document.getElementById("buy-btn");
  if (buy) buy.href = CONFIG.discordInvite;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const stored = sessionStorage.getItem("k3d_token");
  const token = hash.get("access_token") || stored;
  if (hash.get("access_token")) {
    sessionStorage.setItem("k3d_token", hash.get("access_token"));
    history.replaceState(null, "", window.location.pathname);
  }
  if (!token) return;
  try {
    renderUser(await fetchProfile(token));
    sessionStorage.setItem("k3d_token", token);
  } catch {
    sessionStorage.removeItem("k3d_token");
  }
}

document.getElementById("login-btn").addEventListener("click", () => {
  const url =
    "https://discord.com/oauth2/authorize?client_id=" +
    CONFIG.clientId +
    "&redirect_uri=" +
    encodeURIComponent(CONFIG.redirectUri) +
    "&response_type=token&scope=identify%20email";
  window.location.href = url;
});

initAuth();
