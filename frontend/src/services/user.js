import http from "./http";

export async function getMe() {
  const { data } = await http.get("/auth/profile");
  return data;
}

export async function updateMe(payload) {
  const { data } = await http.put("/auth/profile", payload);
  return data;
}

export async function changeMyPassword(payload) {
  const { data } = await http.put("/auth/password", payload);
  return data;
}

export async function uploadMyPhoto(file) {
  const formData = new FormData();
  formData.append("photo", file);

  const { data } = await http.post("/users/me/photo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return data;
}

// Admin only
export async function setUserRole(userId, role) {
  const { data } = await http.put(`/users/${userId}/role`, { role });
  return data;
}
