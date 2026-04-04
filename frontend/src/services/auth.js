const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000/api")
  .trim()
  .replace(/\/+$/, "");

const AUTH_URL = `${API_BASE}/auth`;

async function parseJsonSafe(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Error en la solicitud");
  return data;
}

export async function loginUser(identifier, password) {
  const res = await fetch(`${AUTH_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  return parseJsonSafe(res);
}

export async function registerUser(payload) {
  const res = await fetch(`${AUTH_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonSafe(res);
}

export async function checkUsername(username) {
  const res = await fetch(
    `${AUTH_URL}/check-username?username=${encodeURIComponent(username)}`
  );
  return parseJsonSafe(res);
}

export async function forgotPassword(email) {
  const res = await fetch(`${AUTH_URL}/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return parseJsonSafe(res);
}

export async function resetPassword(token, password) {
  const res = await fetch(`${AUTH_URL}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  return parseJsonSafe(res);
}

export async function loginWithGoogle(idToken) {
  const res = await fetch(`${AUTH_URL}/oauth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  return parseJsonSafe(res);
}