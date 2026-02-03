const AUTH_URL = "http://localhost:5000/api/auth";

async function parseJsonSafe(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Error en la solicitud");
  return data;
}

export async function loginUser(email, password) {
  const res = await fetch(`${AUTH_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
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

export async function forgotPassword(email) {
  const res = await fetch(`${AUTH_URL}/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return parseJsonSafe(res);
}

export async function resetPassword(token, newPassword) {
  const res = await fetch(`${AUTH_URL}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
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
