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

// Construye data compatible con Google Heatmap:
// [{ location: LatLng, weight: number }, ...]
export function buildHeatmapData({ google, incidents = [], mode = "all", weighted = true } = {}) {
  if (!google || !google.maps || !Array.isArray(incidents)) return [];

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
        location: new google.maps.LatLng(lat, lng),
        weight: w,
      };
    })
    .filter(Boolean);
}

// Opciones visuales del heatmap
// IMPORTANT: = {} evita el error "Cannot read properties of undefined (reading 'preset')"
export function getHeatmapOptions({ preset = "auto", pointCount = 0 } = {}) {
  let radius = 45;
  let blur = 28;
  let opacity = 0.85;
  let maxIntensity = 12;

  const count = Number(pointCount);
  const n = Number.isFinite(count) ? count : 0;

  // Auto tuning segun cantidad de puntos
  if (preset === "auto") {
    if (n < 20) {
      radius = 55;
      blur = 34;
      maxIntensity = 6;
    } else if (n < 80) {
      radius = 48;
      blur = 30;
      maxIntensity = 10;
    } else if (n < 200) {
      radius = 40;
      blur = 26;
      maxIntensity = 14;
    } else {
      radius = 34;
      blur = 22;
      maxIntensity = 18;
    }
  } else if (preset === "tight") {
    // Heatmap mas concentrado
    radius = 30;
    blur = 18;
    opacity = 0.9;
    maxIntensity = Math.max(10, Math.round(n / 10));
  } else if (preset === "soft") {
    // Heatmap mas amplio y difuso
    radius = 60;
    blur = 40;
    opacity = 0.75;
    maxIntensity = 10;
  }

  // Gradiente clasico tipo Google (azul -> rojo)
  const gradient = [
    "rgba(0, 0, 255, 0)",
    "rgba(0, 0, 255, 0.7)",
    "rgba(0, 255, 255, 0.8)",
    "rgba(0, 255, 0, 0.8)",
    "rgba(255, 255, 0, 0.9)",
    "rgba(255, 128, 0, 0.95)",
    "rgba(255, 0, 0, 1)",
  ];

  return {
    radius,
    blur,
    opacity,
    dissipating: true,
    maxIntensity,
    gradient,
  };
}
