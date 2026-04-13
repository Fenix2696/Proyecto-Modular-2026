import http from "./http";

// INCIDENTES
export async function getAllIncidents() {
  const { data } = await http.get("/incidents");
  return data;
}

/**
 * Crear incidente
 * - Si payload trae imagen (payload.imageFile o payload.image) -> manda FormData (multipart)
 * - Si no trae imagen -> manda JSON normal como antes
 *
 * Backend espera (opcional):
 *  - image (file)
 * Y campos:
 *  - type, description, address, priority, lat, lng, title (si lo mandas no truena)
 */
export async function createIncident(payload) {
  // Si ya viene como FormData, lo mandamos directo
  if (typeof FormData !== "undefined" && payload instanceof FormData) {
    const { data } = await http.post("/incidents", payload);
    return data;
  }

  const img = payload?.imageFile || payload?.image || null;

  // Si viene un File/Blob, mandamos multipart
  const isBlobLike =
    !!img &&
    (img instanceof Blob ||
      (typeof File !== "undefined" && img instanceof File) ||
      (typeof img === "object" &&
        typeof img.arrayBuffer === "function" &&
        typeof img.type === "string"));

  if (isBlobLike) {
    const fd = new FormData();

    // append de todos los campos (sin reventar)
    Object.entries(payload || {}).forEach(([k, v]) => {
      if (k === "imageFile" || k === "image") return;
      if (v === undefined || v === null) return;

      // numbers/bools a string para FormData
      fd.append(k, typeof v === "string" ? v : String(v));
    });

    // Campo de archivo que espera el backend: "image"
    fd.append("image", img);

    const { data } = await http.post("/incidents", fd);
    return data;
  }

  // Caso normal: JSON como siempre
  const { data } = await http.post("/incidents", payload);
  return data;
}

export async function getIncidentById(id) {
  const { data } = await http.get(`/incidents/${id}`);
  return data;
}

export async function deleteIncident(id) {
  const { data } = await http.delete(`/incidents/${id}`);
  return data;
}

/**
 * URL directa para mostrar la imagen del incidente en un <img />
 * Ejemplo:
 *   <img src={getIncidentImageUrl(incident.id)} />
 */
export function getIncidentImageUrl(id) {
  const base = (http?.defaults?.baseURL || "").replace(/\/+$/, "");
  return `${base}/incidents/${id}/image`;
}
