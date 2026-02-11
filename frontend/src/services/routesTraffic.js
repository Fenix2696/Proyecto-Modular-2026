// frontend/src/services/routesTraffic.js
import http from "./http";

/**
 * Pide rutas con trafico segmentado (speedReadingIntervals) usando tu backend:
 * POST /api/routes/traffic
 *
 * params:
 * {
 *   origin: { lat, lng },
 *   destination: { lat, lng },
 *   travelMode: "DRIVE" | "TWO_WHEELER" | "WALK" | "TRANSIT" | "BICYCLE"
 *   alternatives?: boolean
 * }
 */
export async function computeTrafficRoutes({
  origin,
  destination,
  travelMode = "DRIVE",
  alternatives = true,
}) {
  const payload = {
    origin,
    destination,
    travelMode,
    alternatives,
  };

  const res = await http.post("/routes/traffic", payload);

  //  backend responde { success, data }
  return res.data;
}
