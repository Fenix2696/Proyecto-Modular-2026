// =====================================
// heatmapUtils.js
// =====================================

// Pesos por tipo (ajusta si quieres)
const TYPE_WEIGHT = {
  robbery: 1.2,
  accident: 0.9,
  emergency: 1.5,
  theft: 0.7,
  vandalism: 0.6,
};

// Construye puntos para una capa de intensidad propia basada en google.maps.Circle.
// Evita google.maps.visualization.HeatmapLayer, removido desde Maps JS API 3.65.
export function buildHeatmapData({ incidents = [], mode = "all", weighted = true } = {}) {
  if (!Array.isArray(incidents)) return [];

  return incidents
    .filter((i) => {
      if (mode === "all") return true;
      return i?.type === mode;
    })
    .map((i) => {
      const lat = Number(i?.lat);
      const lng = Number(i?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const w = weighted ? TYPE_WEIGHT[i?.type] ?? 1 : 1;

      return {
        lat,
        lng,
        type: i?.type || "theft",
        weight: w,
      };
    })
    .filter(Boolean);
}

// Opciones visuales de la capa de intensidad.
// IMPORTANT: = {} evita el error "Cannot read properties of undefined (reading 'preset')"
export function getHeatmapOptions({ preset = "auto", pointCount = 0 } = {}) {
  let radiusMeters = 520;
  let opacity = 0.85;

  const count = Number(pointCount);
  const n = Number.isFinite(count) ? count : 0;

  // Auto tuning segun cantidad de puntos
  if (preset === "auto") {
    if (n < 20) {
      radiusMeters = 680;
    } else if (n < 80) {
      radiusMeters = 560;
    } else if (n < 200) {
      radiusMeters = 440;
    } else {
      radiusMeters = 340;
    }
  } else if (preset === "tight") {
    radiusMeters = 320;
    opacity = 0.9;
  } else if (preset === "soft") {
    radiusMeters = 760;
    opacity = 0.75;
  }

  return {
    radiusMeters,
    opacity,
  };
}

export function getHeatPointStyle(point, options = {}) {
  const weight = Number(point?.weight);
  const w = Number.isFinite(weight) ? Math.max(0.4, Math.min(weight, 1.8)) : 1;
  const radiusMeters = Number(options.radiusMeters) || 520;
  const opacity = Number(options.opacity) || 0.85;

  let fillColor = "#22c55e";
  if (w >= 1.35) fillColor = "#ef4444";
  else if (w >= 1.1) fillColor = "#f97316";
  else if (w >= 0.85) fillColor = "#facc15";

  return {
    radius: radiusMeters * (0.75 + w * 0.3),
    fillColor,
    fillOpacity: Math.min(0.34, 0.12 + w * 0.08) * opacity,
    strokeColor: fillColor,
    strokeOpacity: 0.12 * opacity,
    strokeWeight: 1,
    clickable: false,
    zIndex: 20,
  };
}
