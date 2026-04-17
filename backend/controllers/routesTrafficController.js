// backend/controllers/routesTrafficController.js

/**
 * Compute routes with traffic speed intervals using Google Routes API (v2)
 * Docs: https://routes.googleapis.com/directions/v2:computeRoutes
 *
 * Espera body:
 * {
 *   origin: { lat: number, lng: number },
 *   destination: { lat: number, lng: number },
 *   travelMode: "DRIVE" | "TWO_WHEELER" | "WALK" | "TRANSIT" | "BICYCLE",
 *   alternatives: boolean
 * }
 */

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

function isValidLatLng(p) {
  return (
    p &&
    Number.isFinite(Number(p.lat)) &&
    Number.isFinite(Number(p.lng)) &&
    Math.abs(Number(p.lat)) <= 90 &&
    Math.abs(Number(p.lng)) <= 180
  );
}

async function fetchJson(url, options) {
  // Node 18+ tiene fetch global. Si no, fallamos con un mensaje claro.
  if (typeof fetch !== "function") {
    throw new Error(
      "Este backend requiere Node.js 18+ (para fetch). Actualiza Node o instala un polyfill."
    );
  }

  const res = await fetch(url, options);
  const text = await res.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      `Routes API error (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.details = data;
    throw err;
  }

  return data;
}

function normalizeTravelMode(mode) {
  const m = String(mode || "DRIVE").toUpperCase();

  // Mapeos para tu UI actual (DRIVING/MOTO/RAIL/etc.)
  if (m === "DRIVING") return "DRIVE";
  if (m === "MOTO") return "TWO_WHEELER";
  if (m === "WALKING") return "WALK";
  if (m === "BICYCLING") return "BICYCLE";
  if (m === "RAIL") return "TRANSIT"; // rail va dentro de transit (lo afinamos despues)

  // Valores permitidos por Routes API:
  // DRIVE, TWO_WHEELER, WALK, TRANSIT, BICYCLE
  if (["DRIVE", "TWO_WHEELER", "WALK", "TRANSIT", "BICYCLE"].includes(m)) return m;

  return "DRIVE";
}

exports.computeTrafficRoutes = async (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message:
          "Falta GOOGLE_MAPS_API_KEY en backend/.env (key de Google Cloud con Routes API habilitada)",
      });
    }

    const { origin, destination, travelMode, alternatives } = req.body || {};

    if (!isValidLatLng(origin) || !isValidLatLng(destination)) {
      return res.status(400).json({
        success: false,
        message:
          "origin y destination deben ser { lat, lng } validos (numeros).",
      });
    }

    const mode = normalizeTravelMode(travelMode);

    // FieldMask: pide SOLO lo necesario (rapido y barato)
    const fieldMask = [
      "routes.polyline.encodedPolyline",
      "routes.travelAdvisory.speedReadingIntervals",
      "routes.duration",
      "routes.distanceMeters",
    ].join(",");

    const body = {
      origin: { location: { latLng: { latitude: Number(origin.lat), longitude: Number(origin.lng) } } },
      destination: { location: { latLng: { latitude: Number(destination.lat), longitude: Number(destination.lng) } } },
      travelMode: mode,
      polylineQuality: "HIGH_QUALITY",
      computeAlternativeRoutes: Boolean(alternatives),
    };

    // Google Routes no permite routingPreference en TRANSIT/WALK/BICYCLE.
    if (mode === "DRIVE" || mode === "TWO_WHEELER") {
      body.routingPreference = "TRAFFIC_AWARE";
    }

    const data = await fetchJson(ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
    });

    // Respuesta directa (puedes simplificar luego)
    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("computeTrafficRoutes error:", err?.message || err);
    return res.status(err.status || 500).json({
      success: false,
      message: err?.message || "Error en Routes API",
      details: err.details || null,
    });
  }
};
