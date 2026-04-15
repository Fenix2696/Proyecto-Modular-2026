import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { GoogleMap, InfoWindow, useLoadScript } from "@react-google-maps/api";

import MapTypeSelector from "./components/MapTypeSelector";
import HeatmapControls from "./components/HeatmapControls";
import { buildHeatmapData, getHeatmapOptions } from "./utils/heatmapUtils";

// url helper para imagen del incidente normal
import { getIncidentImageUrl } from "../../services/api";

const containerStyle = { width: "100%", height: "100%" };
const GOOGLE_LIBRARIES = ["places", "visualization", "geometry"];

const TYPE = {
  robbery: { label: "Robos/Asaltos", color: "#ef4444", emoji: "🚨", z: 60 },
  accident: { label: "Accidentes", color: "#f59e0b", emoji: "🚗", z: 40 },
  emergency: { label: "Emergencias", color: "#dc2626", emoji: "⚠️", z: 80 },
  theft: { label: "Hurtos", color: "#f97316", emoji: "🔒", z: 50 },
  vandalism: { label: "Vandalismo", color: "#8b5cf6", emoji: "🏚️", z: 30 },
};

const AI_CATEGORY_META = {
  asalto: { label: "Asalto", color: "#ef4444", emoji: "🚨", z: 120 },
  robo: { label: "Robo", color: "#f97316", emoji: "🔓", z: 120 },
  cristalazo: { label: "Cristalazo", color: "#fb7185", emoji: "🪟", z: 120 },
  choque: { label: "Choque", color: "#3b82f6", emoji: "🚗", z: 120 },
  violencia: { label: "Violencia", color: "#dc2626", emoji: "⚠️", z: 120 },
  emergencia: { label: "Emergencia", color: "#10b981", emoji: "🚒", z: 120 },
  delito: { label: "Delito", color: "#8b5cf6", emoji: "🕵️", z: 120 },
  vandalismo: { label: "Vandalismo", color: "#64748b", emoji: "🏚️", z: 120 },
  otro: { label: "Reporte IA", color: "#f59e0b", emoji: "📰", z: 120 },
};

const DEFAULT_CENTER = { lat: 20.6597, lng: -103.3496 };

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0b1220" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b1220" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0f1a2e" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#16213a" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0b1220" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#223256" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#111a2f" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1b33" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
];

const LIGHT_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f5f7fb" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#334155" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f7fb" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e2e8f0" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#334155" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe8ff" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#1e293b" }] },
];

function safeNum(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function buildSvgPin({ emoji, color, selected, ringColor = "#ffffff" }) {
  const size = selected ? 62 : 52;
  const circle = selected ? 20 : 18;
  const font = selected ? 18 : 16;

  const glow = selected
    ? `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
         <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
         <feMerge>
           <feMergeNode in="coloredBlur"/>
           <feMergeNode in="SourceGraphic"/>
         </feMerge>
       </filter>`
    : "";

  const filterAttr = selected ? `filter="url(#glow)"` : "";

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
    <defs>
      ${glow}
      <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <g filter="url(#shadow)">
      <path d="M32 60c0 0 18-16.3 18-30C50 18.4 42.2 10 32 10S14 18.4 14 30c0 13.7 18 30 18 30z"
            fill="${color}" stroke="${ringColor}" stroke-width="3" ${filterAttr}/>
      <circle cx="32" cy="30" r="${circle}" fill="rgba(255,255,255,0.92)"/>
      <text x="32" y="35" font-size="${font}" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
    </g>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getMarkerIcon(typeKey, selected) {
  const t = TYPE[typeKey] || TYPE.robbery;
  const url = buildSvgPin({
    emoji: t.emoji,
    color: t.color,
    selected,
    ringColor: "#ffffff",
  });

  return {
    url,
    scaledSize: new window.google.maps.Size(selected ? 62 : 52, selected ? 62 : 52),
    anchor: new window.google.maps.Point(selected ? 31 : 26, selected ? 62 : 52),
  };
}

function getAICategoryMeta(category) {
  const key = String(category || "").toLowerCase();
  return AI_CATEGORY_META[key] || AI_CATEGORY_META.otro;
}

function getAIReportIcon(category, selected) {
  const meta = getAICategoryMeta(category);
  const url = buildSvgPin({
    emoji: meta.emoji,
    color: meta.color,
    selected,
    ringColor: "#38bdf8",
  });

  return {
    url,
    scaledSize: new window.google.maps.Size(selected ? 62 : 52, selected ? 62 : 52),
    anchor: new window.google.maps.Point(selected ? 31 : 26, selected ? 62 : 52),
  };
}

function computeMapOptions(mapMode) {
  const mapTypeId = mapMode === "satellite" ? "satellite" : "roadmap";
  let styles = undefined;
  if (mapMode === "dark") styles = DARK_MAP_STYLE;
  if (mapMode === "street") styles = LIGHT_MAP_STYLE;

  return {
    mapTypeId,
    styles,
    fullscreenControl: false,
    streetViewControl: false,
    mapTypeControl: false,
    clickableIcons: false,
    gestureHandling: "greedy",
    zoomControl: true,
  };
}

function getUserDotIcon() {
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    scale: 7,
    fillColor: "#3b82f6",
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 3,
  };
}

function getHeadingArrowIcon(heading = 0) {
  return {
    path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
    scale: 5,
    rotation: heading,
    fillColor: "#2563eb",
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };
}

function buildDestinationPinIcon() {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <defs>
      <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <g filter="url(#shadow)">
      <path d="M32 60c0 0 18-16.3 18-30C50 18.4 42.2 10 32 10S14 18.4 14 30c0 13.7 18 30 18 30z"
            fill="#ef4444" stroke="rgba(255,255,255,0.95)" stroke-width="3"/>
      <circle cx="32" cy="30" r="10" fill="rgba(255,255,255,0.92)"/>
      <circle cx="32" cy="30" r="5.5" fill="#ef4444"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getTrafficColor(speed) {
  const s = String(speed || "").toUpperCase();
  if (s.includes("TRAFFIC_JAM") || s.includes("JAM")) return "#ef4444";
  if (s.includes("SLOW")) return "#f59e0b";
  if (s.includes("NORMAL")) return "#22c55e";
  return "#60a5fa";
}

function safeDecodePolyline(encoded) {
  try {
    if (!encoded) return null;
    if (!window.google?.maps?.geometry?.encoding?.decodePath) return null;
    return window.google.maps.geometry.encoding.decodePath(encoded);
  } catch {
    return null;
  }
}

function getSelectedLatLng(item) {
  if (!item) return null;

  const lat = safeNum(item.lat ?? item.latitude);
  const lng = safeNum(item.lng ?? item.longitude);

  if (lat === null || lng === null) return null;
  return { lat, lng };
}

function mapAIToHeatType(category) {
  const c = String(category || "").toLowerCase();

  if (c === "asalto" || c === "robo") return "robbery";
  if (c === "choque") return "accident";
  if (c === "emergencia" || c === "violencia") return "emergency";
  if (c === "cristalazo" || c === "delito") return "theft";
  if (c === "vandalismo") return "vandalism";

  return "theft";
}


function stripHtml(html) {
  if (!html) return "";

  const div = document.createElement("div");
  div.innerHTML = html;

  // Esto convierte entidades HTML (&nbsp;, etc)
  return div.textContent || div.innerText || "";
}

function cleanInstruction(html) {
  const text = stripHtml(html);

  return text
    .replace(/\s+/g, " ")
    .replace("hacia", "→ hacia")
    .replace("Gira", "↪ Gira")
    .replace("Continua", "↑ Continua")
    .replace("Dirígete", "↑ Dirígete")
    .trim();
}
function LegendPin({ emoji, bg, ring }) {
  return (
    <span
      style={{
        width: 20,
        height: 20,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        border: `2px solid ${ring}`,
        fontSize: 11,
        flex: "0 0 auto",
      }}
    >
      {emoji}
    </span>
  );
}

export default function IncidentMapGoogle({
  center,
  zoom,
  incidents,
  aiReports = [],
  mapMode,
  onChangeMapMode,
  onMapBackgroundClick,
  userLocation,
  followMe,
  onCenterToMe,
  onUserPanMap,
  directions,
  routeIndex = 0,
  trafficData,
  navigationActive = false,
  onStopNavigation,
  onClearDirections,
  onExitNavigation,
  onNavigationStepChange,
  onNavigationComplete,
  clearMapToken = 0,
}) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_LIBRARIES,
  });

  const [mapObj, setMapObj] = useState(null);

  const markersRef = useRef(new Map());
  const aiMarkersRef = useRef(new Map());
  const heatLayerRef = useRef(null);

  const [selected, setSelected] = useState(null);
  const [showMapMode, setShowMapMode] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  const [heatPanelOpen, setHeatPanelOpen] = useState(false);
  const [heatmapOn, setHeatmapOn] = useState(false);

  const [imgOpen, setImgOpen] = useState(false);
  const [imgTs, setImgTs] = useState(() => Date.now());
  const [navStepIndex, setNavStepIndex] = useState(0);

  const incidentImageUrl = useMemo(() => {
    if (!selected?.id || selected?.isAIReport) return "";
    return `${getIncidentImageUrl(selected.id)}?ts=${imgTs}`;
  }, [selected?.id, selected?.isAIReport, imgTs]);

  useEffect(() => {
    setImgOpen(false);
  }, [selected?.id, selected?.isAIReport]);

  const meMarkerRef = useRef(null);
  const meAccuracyRef = useRef(null);
  const mePulseRef = useRef(null);
  const meHeadingRef = useRef(null);
  const latestPosRef = useRef(null);
  const lastEmittedViewportRef = useRef({ lat: null, lng: null, zoom: null });

  const dirRendererRef = useRef(null);
  const lastSelectedMarkerKeyRef = useRef(null);

  const trafficPolylinesRef = useRef([]);
  const destMarkerRef = useRef(null);

  useEffect(() => {
    if (heatmapOn) setSelected(null);
  }, [heatmapOn]);

  const effectiveMapMode = mapMode || localStorage.getItem("mapMode") || "dark";

  useEffect(() => {
    localStorage.setItem("mapMode", effectiveMapMode);
  }, [effectiveMapMode]);

  const mapCenter = useMemo(() => {
    const lat = safeNum(center?.[0]);
    const lng = safeNum(center?.[1]);
    return { lat: lat ?? DEFAULT_CENTER.lat, lng: lng ?? DEFAULT_CENTER.lng };
  }, [center]);

  const mapZoom = useMemo(() => {
    const z = Number(zoom);
    if (!Number.isFinite(z)) return 13;
    return Math.min(20, Math.max(3, z));
  }, [zoom]);

  const cleanIncidents = useMemo(() => {
    return (incidents || [])
      .map((i) => {
        const lat = safeNum(i.lat);
        const lng = safeNum(i.lng);
        if (lat === null || lng === null) return null;
        return { ...i, lat, lng, type: i.type || "robbery", isAIReport: false };
      })
      .filter(Boolean);
  }, [incidents]);

  const cleanAIReports = useMemo(() => {
    return (aiReports || [])
      .map((r) => {
        const latitude = Number(r.latitude ?? r.lat);
        const longitude = Number(r.longitude ?? r.lng);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

        return {
          ...r,
          latitude,
          longitude,
          category: String(r.category || "otro").toLowerCase(),
          isAIReport: true,
        };
      })
      .filter(Boolean);
  }, [aiReports]);

  const heatmapSourceItems = useMemo(() => {
    const baseIncidents = cleanIncidents.map((i) => ({
      ...i,
      lat: Number(i.lat),
      lng: Number(i.lng),
      type: i.type,
    }));

    const aiAsHeatItems = cleanAIReports.map((r) => ({
      id: `ai-${r.id}`,
      lat: Number(r.latitude),
      lng: Number(r.longitude),
      type: mapAIToHeatType(r.category),
      isAIReport: true,
      weight: 1.35,
    }));

    return [...baseIncidents, ...aiAsHeatItems];
  }, [cleanIncidents, cleanAIReports]);

  const options = useMemo(() => computeMapOptions(effectiveMapMode), [effectiveMapMode]);

  const heatmapData = useMemo(() => {
    if (!isLoaded) return [];
    if (!window.google) return [];
    return buildHeatmapData({
      google: window.google,
      incidents: heatmapSourceItems,
      mode: "all",
      weighted: true,
    });
  }, [isLoaded, heatmapSourceItems]);

  const heatmapOptions = useMemo(() => {
    const count = Array.isArray(heatmapData) ? heatmapData.length : 0;
    return getHeatmapOptions({ preset: "auto", pointCount: count });
  }, [heatmapData]);

  const legendCounts = useMemo(() => {
    return {
      user: cleanIncidents.length,
      ai: cleanAIReports.length,
    };
  }, [cleanIncidents, cleanAIReports]);

  const routeSteps = useMemo(() => {
    if (!directions?.routes?.length) return [];
    const idx = Math.min(
      Math.max(Number(routeIndex) || 0, 0),
      directions.routes.length - 1
    );
    const leg = directions.routes[idx]?.legs?.[0];
    return Array.isArray(leg?.steps) ? leg.steps : [];
  }, [directions, routeIndex]);

  const currentNavStep = routeSteps[navStepIndex] || null;

  const currentNavInstruction = useMemo(() => {
    if (!currentNavStep) return null;

    return {
      index: navStepIndex,
      stepNumber: navStepIndex + 1,
      totalSteps: routeSteps.length,
      htmlInstruction: currentNavStep.html_instructions || "",
      plainInstruction:
        cleanInstruction(
          currentNavStep.html_instructions ||
          currentNavStep.instructions ||
          ""
        ) || "Sigue la ruta",
      distanceText: currentNavStep.distance?.text || "",
      durationText: currentNavStep.duration?.text || "",
      maneuver: currentNavStep.maneuver || "",
      startLocation: currentNavStep.start_location || null,
      endLocation: currentNavStep.end_location || null,
    };
  }, [currentNavStep, navStepIndex, routeSteps.length]);

  const onMapClick = useCallback(() => {
    setSelected(null);
    setShowMapMode(false);
    setHeatPanelOpen(false);
    setShowLegend(false);
    if (onMapBackgroundClick) onMapBackgroundClick();
  }, [onMapBackgroundClick]);

  const handleMapLoad = useCallback((map) => {
    setMapObj(map);
  }, []);

  const emitViewportToParent = useCallback(() => {
    if (!mapObj || !onUserPanMap) return;

    const centerNow = mapObj.getCenter?.();
    const lat = centerNow?.lat?.();
    const lng = centerNow?.lng?.();
    const zoomNow = mapObj.getZoom?.();

    const safeLat = Number.isFinite(lat) ? lat : undefined;
    const safeLng = Number.isFinite(lng) ? lng : undefined;
    const safeZoom = Number.isFinite(zoomNow) ? zoomNow : undefined;

    const prev = lastEmittedViewportRef.current;
    const changed =
      !Number.isFinite(prev.lat) ||
      !Number.isFinite(prev.lng) ||
      !Number.isFinite(prev.zoom) ||
      !Number.isFinite(safeLat) ||
      !Number.isFinite(safeLng) ||
      !Number.isFinite(safeZoom) ||
      Math.abs(prev.lat - safeLat) > 0.00001 ||
      Math.abs(prev.lng - safeLng) > 0.00001 ||
      prev.zoom !== safeZoom;

    if (!changed) return;

    lastEmittedViewportRef.current = {
      lat: safeLat,
      lng: safeLng,
      zoom: safeZoom,
    };

    onUserPanMap({ lat: safeLat, lng: safeLng, zoom: safeZoom });
  }, [mapObj, onUserPanMap]);

  const cleanupPulseInterval = useCallback(() => {
    if (mePulseRef.current?.__pulseInterval) {
      clearInterval(mePulseRef.current.__pulseInterval);
      mePulseRef.current.__pulseInterval = null;
    }
  }, []);

  const cleanupMeLayers = useCallback(() => {
    cleanupPulseInterval();
    [meMarkerRef, meAccuracyRef, mePulseRef, meHeadingRef].forEach((ref) => {
      if (ref.current) {
        try {
          ref.current.setMap(null);
        } catch { /* no-op */ }
        ref.current = null;
      }
    });
  }, [cleanupPulseInterval]);

  const cleanupDirections = useCallback(() => {
    if (dirRendererRef.current) {
      try {
        dirRendererRef.current.setDirections({ routes: [] });
      } catch { /* no-op */ }

      try {
        dirRendererRef.current.setRouteIndex(0);
      } catch { /* no-op */ }

      try {
        dirRendererRef.current.setPanel(null);
      } catch { /* no-op */ }

      try {
        dirRendererRef.current.setMap(null);
      } catch { /* no-op */ }

      dirRendererRef.current = null;
    }
  }, []);

  const cleanupTrafficPolylines = useCallback(() => {
    const arr = trafficPolylinesRef.current || [];
    for (const pl of arr) {
      try {
        pl.setMap(null);
      } catch { /* no-op */ }
    }
    trafficPolylinesRef.current = [];
  }, []);

  const cleanupDestMarker = useCallback(() => {
    if (destMarkerRef.current) {
      try {
        destMarkerRef.current.setMap(null);
      } catch { /* no-op */ }
      destMarkerRef.current = null;
    }
  }, []);

  const handleMapUnmount = useCallback(() => {
    for (const m of markersRef.current.values()) m.setMap(null);
    markersRef.current.clear();

    for (const m of aiMarkersRef.current.values()) m.setMap(null);
    aiMarkersRef.current.clear();

    if (heatLayerRef.current) {
      try {
        heatLayerRef.current.setMap(null);
      } catch { /* no-op */ }
      heatLayerRef.current = null;
    }

    cleanupMeLayers();
    cleanupDirections();
    cleanupTrafficPolylines();
    cleanupDestMarker();

    setMapObj(null);
  }, [cleanupMeLayers, cleanupDirections, cleanupTrafficPolylines, cleanupDestMarker]);

  useEffect(() => {
    if (!mapObj || !clearMapToken) return;

    cleanupDirections();
    cleanupTrafficPolylines();
    cleanupDestMarker();
    setSelected(null);
  }, [
    clearMapToken,
    mapObj,
    cleanupDirections,
    cleanupTrafficPolylines,
    cleanupDestMarker,
  ]);

  useEffect(() => {
    if (!isLoaded || !mapObj || !window.google) return;

    if (!directions || !directions.routes || directions.routes.length === 0) {
      cleanupDirections();
      cleanupTrafficPolylines();
      cleanupDestMarker();
      return;
    }

    const hasTrafficOverlay = !!trafficData;
    const baseRouteOpacity = hasTrafficOverlay ? 0.62 : 0.9;

    if (!dirRendererRef.current) {
      dirRendererRef.current = new window.google.maps.DirectionsRenderer({
        map: mapObj,
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: {
          strokeOpacity: baseRouteOpacity,
          strokeWeight: 6,
          strokeColor: "#60a5fa",
        },
      });
    } else {
      try {
        dirRendererRef.current.setOptions({
          polylineOptions: {
            strokeOpacity: baseRouteOpacity,
            strokeWeight: 6,
            strokeColor: "#60a5fa",
          },
        });
      } catch { /* no-op */ }
    }

    dirRendererRef.current.setDirections(directions);

    try {
      dirRendererRef.current.setRouteIndex(routeIndex || 0);
    } catch { /* no-op */ }
  }, [isLoaded, mapObj, directions, routeIndex, trafficData, cleanupDirections, cleanupTrafficPolylines, cleanupDestMarker]);

  useEffect(() => {
    if (!isLoaded || !mapObj || !window.google) return;

    if (!directions?.routes?.length) {
      cleanupDestMarker();
      return;
    }

    const idx = Math.min(Math.max(Number(routeIndex) || 0, 0), directions.routes.length - 1);
    const leg = directions.routes[idx]?.legs?.[0];
    const endLoc = leg?.end_location;

    const lat = endLoc?.lat?.();
    const lng = endLoc?.lng?.();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      cleanupDestMarker();
      return;
    }

    const pos = { lat, lng };
    const iconUrl = buildDestinationPinIcon();

    if (!destMarkerRef.current) {
      destMarkerRef.current = new window.google.maps.Marker({
        map: mapObj,
        position: pos,
        zIndex: 5000,
        title: "Destino",
        icon: {
          url: iconUrl,
          scaledSize: new window.google.maps.Size(46, 46),
          anchor: new window.google.maps.Point(23, 46),
        },
      });
    } else {
      destMarkerRef.current.setPosition(pos);
      destMarkerRef.current.setMap(mapObj);
    }
  }, [isLoaded, mapObj, directions, routeIndex, cleanupDestMarker]);

  useEffect(() => {
    if (!isLoaded || !mapObj || !window.google) return;

    cleanupTrafficPolylines();
    if (!trafficData) return;

    const routes = trafficData?.routes || trafficData?.data?.routes || [];
    if (!Array.isArray(routes) || routes.length === 0) return;

    const idx = Math.min(Math.max(Number(routeIndex) || 0, 0), routes.length - 1);
    const r = routes[idx] || routes[0];

    const encoded = r?.polyline?.encodedPolyline || r?.polyline?.encoded_polyline;
    const path = safeDecodePolyline(encoded);
    if (!path || path.length < 2) return;

    const intervals =
      r?.travelAdvisory?.speedReadingIntervals ||
      r?.travelAdvisory?.speed_reading_intervals ||
      r?.travel_advisory?.speedReadingIntervals ||
      [];

    if (!Array.isArray(intervals) || intervals.length === 0) {
      const pl = new window.google.maps.Polyline({
        map: mapObj,
        path,
        strokeOpacity: 0.95,
        strokeWeight: 7,
        strokeColor: "#22c55e",
        zIndex: 4500,
      });
      trafficPolylinesRef.current = [pl];
      return;
    }

    const polys = [];
    for (const it of intervals) {
      const s = Number(it?.startPolylinePointIndex ?? it?.startPolylinePointIndex?.value ?? 0);
      const e = Number(it?.endPolylinePointIndex ?? it?.endPolylinePointIndex?.value ?? 0);
      const speed = it?.speed || it?.trafficSpeed || it?.status;

      const startIdx = Number.isFinite(s) ? Math.max(0, Math.min(s, path.length - 1)) : 0;
      const endIdx = Number.isFinite(e) ? Math.max(startIdx + 1, Math.min(e, path.length - 1)) : Math.min(startIdx + 1, path.length - 1);

      const seg = path.slice(startIdx, endIdx + 1);
      if (seg.length < 2) continue;

      const color = getTrafficColor(speed);

      const pl = new window.google.maps.Polyline({
        map: mapObj,
        path: seg,
        strokeOpacity: 0.98,
        strokeWeight: 7,
        strokeColor: color,
        zIndex: 4600,
      });

      polys.push(pl);
    }

    trafficPolylinesRef.current = polys;
  }, [isLoaded, mapObj, trafficData, routeIndex, cleanupTrafficPolylines]);

  useEffect(() => {
    if (!isLoaded || !mapObj || !window.google) return;

    const has = userLocation && Number.isFinite(userLocation.lat) && Number.isFinite(userLocation.lng);

    if (!has) {
      latestPosRef.current = null;
      cleanupMeLayers();
      return;
    }

    const pos = { lat: userLocation.lat, lng: userLocation.lng };
    latestPosRef.current = pos;

    const accuracy = Number.isFinite(userLocation.accuracy) ? userLocation.accuracy : null;

    if (!meMarkerRef.current) {
      meMarkerRef.current = new window.google.maps.Marker({
        map: mapObj,
        position: pos,
        zIndex: 4000,
        icon: getUserDotIcon(),
        title: "Tu ubicacion",
        clickable: false,
      });
    } else {
      meMarkerRef.current.setPosition(pos);
      meMarkerRef.current.setMap(mapObj);
    }

    if (!mePulseRef.current) {
      mePulseRef.current = new window.google.maps.Circle({
        map: mapObj,
        center: pos,
        radius: 18,
        strokeOpacity: 0,
        fillColor: "#3b82f6",
        fillOpacity: 0.18,
        zIndex: 3500,
        clickable: false,
      });
    } else {
      mePulseRef.current.setCenter(pos);
      mePulseRef.current.setRadius(18);
      mePulseRef.current.setMap(mapObj);
    }

    if (accuracy && accuracy > 0) {
      if (!meAccuracyRef.current) {
        meAccuracyRef.current = new window.google.maps.Circle({
          map: mapObj,
          center: pos,
          radius: accuracy,
          strokeColor: "#3b82f6",
          strokeOpacity: 0.25,
          strokeWeight: 2,
          fillColor: "#3b82f6",
          fillOpacity: 0.12,
          zIndex: 3000,
          clickable: false,
        });
      } else {
        meAccuracyRef.current.setCenter(pos);
        meAccuracyRef.current.setRadius(accuracy);
        meAccuracyRef.current.setMap(mapObj);
      }
    } else if (meAccuracyRef.current) {
      try {
        meAccuracyRef.current.setMap(null);
      } catch { /* no-op */ }
      meAccuracyRef.current = null;
    }

    if (navigationActive && Number.isFinite(userLocation.heading)) {
      const heading = userLocation.heading || 0;
      if (!meHeadingRef.current) {
        meHeadingRef.current = new window.google.maps.Marker({
          map: mapObj,
          position: pos,
          zIndex: 4200,
          icon: getHeadingArrowIcon(heading),
          clickable: false,
          title: "Direccion",
        });
      } else {
        meHeadingRef.current.setPosition(pos);
        meHeadingRef.current.setIcon(getHeadingArrowIcon(heading));
        meHeadingRef.current.setMap(mapObj);
      }
    } else if (meHeadingRef.current) {
      try {
        meHeadingRef.current.setMap(null);
      } catch { /* no-op */ }
      meHeadingRef.current = null;
    }
  }, [isLoaded, mapObj, userLocation, navigationActive, cleanupMeLayers]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!mapObj) return;
    if (!window.google?.maps?.visualization?.HeatmapLayer) return;

    if (!heatmapOn) {
      if (heatLayerRef.current) {
        try {
          heatLayerRef.current.setMap(null);
        } catch { /* no-op */ }
        heatLayerRef.current = null;
      }
      return;
    }

    if (!heatLayerRef.current) {
      heatLayerRef.current = new window.google.maps.visualization.HeatmapLayer({
        data: heatmapData,
        ...heatmapOptions,
      });
      heatLayerRef.current.setMap(mapObj);
    } else {
      try {
        heatLayerRef.current.setData(heatmapData);
        heatLayerRef.current.setOptions(heatmapOptions);
        heatLayerRef.current.setMap(mapObj);
      } catch { /* no-op */ }
    }
  }, [isLoaded, mapObj, heatmapOn, heatmapData, heatmapOptions]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!mapObj) return;

    for (const m of markersRef.current.values()) m.setMap(null);
    markersRef.current.clear();

    if (heatmapOn) return;

    for (const i of cleanIncidents) {
      const t = TYPE[i.type] || TYPE.robbery;

      const marker = new window.google.maps.Marker({
        map: mapObj,
        position: { lat: i.lat, lng: i.lng },
        icon: getMarkerIcon(i.type, false),
        zIndex: t.z,
      });

      marker.addListener("click", () => {
        setSelected(i);
        setShowMapMode(false);
        setHeatPanelOpen(false);
        setShowLegend(false);
      });

      marker.__type = i.type;
      markersRef.current.set(i.id, marker);
    }
  }, [isLoaded, mapObj, cleanIncidents, heatmapOn]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!mapObj) return;

    for (const m of aiMarkersRef.current.values()) m.setMap(null);
    aiMarkersRef.current.clear();

    if (heatmapOn) return;

    for (const r of cleanAIReports) {
      const meta = getAICategoryMeta(r.category);

      const marker = new window.google.maps.Marker({
        map: mapObj,
        position: { lat: r.latitude, lng: r.longitude },
        icon: getAIReportIcon(r.category, false),
        zIndex: meta.z,
      });

      marker.addListener("click", () => {
        setSelected(r);
        setShowMapMode(false);
        setHeatPanelOpen(false);
        setShowLegend(false);
      });

      marker.__category = r.category;
      aiMarkersRef.current.set(`ai-${r.id}`, marker);
    }
  }, [isLoaded, mapObj, cleanAIReports, heatmapOn]);

  useEffect(() => {
    if (!isLoaded) return;
    if (heatmapOn) return;

    const prevKey = lastSelectedMarkerKeyRef.current;
    const nextKey = selected
      ? selected.isAIReport
        ? `ai-${selected.id}`
        : `${selected.id}`
      : null;

    if (prevKey && prevKey !== nextKey) {
      if (prevKey.startsWith("ai-")) {
        const prevAi = aiMarkersRef.current.get(prevKey);
        if (prevAi) {
          const prevCategory = String(prevAi.__category || "otro").toLowerCase();
          const prevMeta = getAICategoryMeta(prevCategory);
          prevAi.setIcon(getAIReportIcon(prevCategory, false));
          prevAi.setZIndex(prevMeta.z);
        }
      } else {
        const prev = markersRef.current.get(Number(prevKey));
        if (prev) {
          const prevType = prev.__type || "robbery";
          const prevMeta = TYPE[prevType] || TYPE.robbery;
          prev.setIcon(getMarkerIcon(prevType, false));
          prev.setZIndex(prevMeta.z);
        }
      }
    }

    if (nextKey) {
      if (nextKey.startsWith("ai-")) {
        const nextAi = aiMarkersRef.current.get(nextKey);
        if (nextAi) {
          const nextCategory = String(nextAi.__category || "otro").toLowerCase();
          nextAi.setIcon(getAIReportIcon(nextCategory, true));
          nextAi.setZIndex(2400);
        }
      } else {
        const next = markersRef.current.get(Number(nextKey));
        if (next) {
          const nextType = next.__type || "robbery";
          next.setIcon(getMarkerIcon(nextType, true));
          next.setZIndex(2000);
        }
      }
    }

    lastSelectedMarkerKeyRef.current = nextKey;
  }, [isLoaded, selected, heatmapOn]);

  useEffect(() => {
    if (!navigationActive) {
      setNavStepIndex(0);
      return;
    }

    if (!routeSteps.length) {
      setNavStepIndex(0);
      return;
    }

    setNavStepIndex((prev) => {
      if (prev < 0 || prev >= routeSteps.length) return 0;
      return prev;
    });
  }, [navigationActive, routeSteps.length]);

  useEffect(() => {
    if (!navigationActive) return;
    if (!currentNavInstruction) return;
    onNavigationStepChange?.(currentNavInstruction);
  }, [navigationActive, currentNavInstruction, onNavigationStepChange]);

  useEffect(() => {
    if (!navigationActive) return;
    if (!isLoaded || !window.google?.maps?.geometry?.spherical) return;
    if (!userLocation) return;
    if (!currentNavStep?.end_location) return;
    if (!routeSteps.length) return;

    const userLatLng = new window.google.maps.LatLng(userLocation.lat, userLocation.lng);

    const endLat =
      typeof currentNavStep.end_location.lat === "function"
        ? currentNavStep.end_location.lat()
        : currentNavStep.end_location.lat;

    const endLng =
      typeof currentNavStep.end_location.lng === "function"
        ? currentNavStep.end_location.lng()
        : currentNavStep.end_location.lng;

    if (!Number.isFinite(endLat) || !Number.isFinite(endLng)) return;

    const endLatLng = new window.google.maps.LatLng(endLat, endLng);

    const distanceToStepEnd =
      window.google.maps.geometry.spherical.computeDistanceBetween(
        userLatLng,
        endLatLng
      );

    if (distanceToStepEnd <= 25) {
      const nextIndex = navStepIndex + 1;

      if (nextIndex >= routeSteps.length) {
        onNavigationComplete?.();
        return;
      }

      setNavStepIndex(nextIndex);
    }
  }, [
    navigationActive,
    isLoaded,
    userLocation,
    currentNavStep,
    navStepIndex,
    routeSteps,
    onNavigationComplete,
  ]);

  useEffect(() => {
    if (!mapObj) return;

    if (!navigationActive || !followMe) {
      try {
        mapObj.setTilt?.(0);
      } catch { /* no-op */ }
      return;
    }

    if (!userLocation) return;

    try {
      mapObj.panTo({ lat: userLocation.lat, lng: userLocation.lng });

      if ((mapObj.getZoom?.() || 0) < 17) {
        mapObj.setZoom(17);
      }

      if (Number.isFinite(userLocation.heading)) {
        try {
          mapObj.setHeading?.(userLocation.heading || 0);
        } catch { /* no-op */ }
      }

      try {
        mapObj.setTilt?.(45);
      } catch { /* no-op */ }
    } catch { /* no-op */ }
  }, [navigationActive, followMe, mapObj, userLocation]);

  const selectedPosition = useMemo(() => getSelectedLatLng(selected), [selected]);

  if (loadError) return <div style={{ padding: 16 }}>Error cargando Google Maps.</div>;
  if (!isLoaded) return <div style={{ padding: 16 }}>Cargando Google Maps...</div>;

  return (
    <div className="rc-gmap-root">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={mapZoom}
        onClick={onMapClick}
        onDragStart={() => onUserPanMap?.()}
        onDrag={() => onUserPanMap?.()}
        onZoomChanged={() => onUserPanMap?.()}
        onIdle={emitViewportToParent}
        options={options}
        onLoad={handleMapLoad}
        onUnmount={handleMapUnmount}
      >
        {!heatmapOn && selected && selectedPosition && (
          <InfoWindow position={selectedPosition} onCloseClick={() => setSelected(null)}>
            {selected.isAIReport ? (
              <div style={{ maxWidth: 300 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 8,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(56,189,248,0.14)",
                    color: "#0ea5e9",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  <span>🧠</span>
                  <span>Reporte IA</span>
                </div>

                <div style={{ fontWeight: 900, marginBottom: 8 }}>
                  {selected.title || "Reporte IA"}
                </div>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 999,
                    marginBottom: 10,
                    fontSize: 12,
                    fontWeight: 800,
                    background: `${getAICategoryMeta(selected.category).color}22`,
                    color: getAICategoryMeta(selected.category).color,
                  }}
                >
                  <span>{getAICategoryMeta(selected.category).emoji}</span>
                  <span>{getAICategoryMeta(selected.category).label}</span>
                </div>

                {selected.image_url ? (
                  <div
                    style={{
                      marginBottom: 10,
                      borderRadius: 12,
                      overflow: "hidden",
                      border: "1px solid rgba(0,0,0,0.08)",
                    }}
                  >
                    <img
                      src={selected.image_url}
                      alt={selected.title || "Reporte"}
                      style={{
                        width: "100%",
                        maxHeight: 150,
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>
                ) : null}

                <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 10 }}>
                  {selected.summary || selected.body || "Sin resumen disponible"}
                </div>

                {selected.address_text ? (
                  <div style={{ fontSize: 12, opacity: 0.78, marginBottom: 8 }}>
                    {selected.address_text}
                  </div>
                ) : null}

                <div style={{ fontSize: 12, opacity: 0.72, marginBottom: 10 }}>
                  {[selected.city, selected.state].filter(Boolean).join(", ")}
                </div>

                {selected.source_url ? (
                  <a
                    href={selected.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rc-primary-btn"
                    style={{
                      width: "100%",
                      display: "inline-flex",
                      justifyContent: "center",
                      alignItems: "center",
                      textDecoration: "none",
                      padding: "10px 12px",
                      borderRadius: 12,
                      fontWeight: 800,
                      boxSizing: "border-box",
                    }}
                  >
                    Ver noticia
                  </a>
                ) : null}
              </div>
            ) : (
              <div style={{ maxWidth: 280 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 8,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.10)",
                    color: "#e2e8f0",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  <span>👤</span>
                  <span>Reporte de usuario</span>
                </div>

                <div style={{ fontWeight: 900, marginBottom: 6 }}>
                  {selected.title || (TYPE[selected.type]?.label ?? "Incidente")}
                </div>

                <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
                  {selected.description}
                </div>

                {selected.address ? (
                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
                    {selected.address}
                  </div>
                ) : null}

                {selected.has_image ? (
                  <button
                    type="button"
                    className="rc-primary-btn"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 12, fontWeight: 800 }}
                    onClick={() => {
                      setImgTs(Date.now());
                      setImgOpen(true);
                    }}
                  >
                    Ver imagen del incidente
                  </button>
                ) : null}
              </div>
            )}
          </InfoWindow>
        )}
      </GoogleMap>

      {navigationActive && currentNavInstruction && (
        <div
          style={{
            position: "absolute",
            top: 18,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 35,
            width: "min(92vw, 680px)",
            background: "#0f766e",
            color: "#ffffff",
            borderRadius: 22,
            padding: "14px 18px",
            boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  opacity: 0.78,
                  marginBottom: 4,
                }}
              >
                Navegacion activa
              </div>

              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  lineHeight: 1.2,
                  marginBottom: 8,
                }}
              >
                {currentNavInstruction.plainInstruction || "Sigue la ruta"}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  fontSize: 12,
                  opacity: 0.92,
                }}
              >
                {currentNavInstruction.distanceText && (
                  <span>{currentNavInstruction.distanceText}</span>
                )}
                {currentNavInstruction.durationText && (
                  <span>• {currentNavInstruction.durationText}</span>
                )}
                <span>
                  • Paso {currentNavInstruction.stepNumber} de {" "}
                  {currentNavInstruction.totalSteps}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (onExitNavigation) {
                  onExitNavigation();
                  return;
                }
                onStopNavigation?.();
                onClearDirections?.();
              }}
              style={{
                minWidth: 120,
                height: 42,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.16)",
                background: "rgba(239,68,68,0.18)",
                color: "#ffffff",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Salir
            </button>
          </div>
        </div>
      )}

      {imgOpen && selected?.has_image && !selected?.isAIReport && (
        <div className="rc-modal-backdrop" onClick={() => setImgOpen(false)}>
          <div className="rc-modal" style={{ maxWidth: 860 }} onClick={(e) => e.stopPropagation()}>
            <div className="rc-modal-head">
              <div className="rc-modal-title">Imagen del incidente</div>
              <button className="rc-icon-btn" type="button" onClick={() => setImgOpen(false)}>
                ✕
              </button>
            </div>

            <div className="rc-modal-body">
              <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.10)" }}>
                <img
                  src={incidentImageUrl}
                  alt="Incidente"
                  style={{
                    width: "100%",
                    maxHeight: "70vh",
                    objectFit: "contain",
                    display: "block",
                    background: "rgba(0,0,0,0.25)",
                  }}
                />
              </div>
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                {selected.title || (TYPE[selected.type]?.label ?? "Incidente")}
              </div>
            </div>
          </div>
        </div>
      )}

      {showLegend && (
        <div
          style={{
            position: "absolute",
            left: 75,
            bottom: 186,
            zIndex: 25,
            minWidth: 220,
            maxWidth: 280,
            padding: "12px 14px",
            borderRadius: 18,
            background: "#1e293b",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 10px 35px rgba(0,0,0,0.25)",
            color: "#e5eefc",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900 }}>
              Tipos de puntos
            </div>

            <button
              type="button"
              onClick={() => setShowLegend(false)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "#e5eefc",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.05)",
              }}
            >
              <LegendPin emoji="🚨" bg="#ef4444" ring="#ffffff" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800 }}>Reportes de usuarios</div>
                <div style={{ fontSize: 11, opacity: 0.72 }}>
                  {legendCounts.user} visibles • borde blanco
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 12,
                background: "rgba(56,189,248,0.10)",
              }}
            >
              <LegendPin emoji="🧠" bg="#0ea5e9" ring="#38bdf8" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800 }}>Noticias / IA</div>
                <div style={{ fontSize: 11, opacity: 0.72 }}>
                  {legendCounts.ai} visibles • borde azul
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        className={`rc-me-fab ${userLocation ? "" : "disabled"} ${followMe ? "active" : ""}`}
        onClick={() => onCenterToMe?.()}
        title={userLocation ? "Centrar a mi ubicacion" : "Ubicacion no disponible"}
      >
        ⦿
      </button>

      <button
        type="button"
        className={`rc-heatmap-fab ${heatmapOn ? "active" : ""}`}
        onClick={() => {
          setShowMapMode(false);
          setShowLegend(false);
          setHeatPanelOpen((v) => !v);
        }}
        title="Zonas calientes"
      >
        🔥
      </button>

      <button
        type="button"
        className="rc-legend-fab"
        onClick={() => {
          setShowMapMode(false);
          setHeatPanelOpen(false);
          setShowLegend((v) => !v);
        }}
        title="Tipos de Reportes"
      >
        🤖
      </button>

      <HeatmapControls
        open={heatPanelOpen}
        setOpen={setHeatPanelOpen}
        heatmapOn={heatmapOn}
        setHeatmapOn={setHeatmapOn}
      />

      <button
        type="button"
        className="rc-maptype-fab"
        onClick={() => {
          setHeatPanelOpen(false);
          setShowLegend(false);
          setShowMapMode(true);
        }}
        title="Cambiar tipo de mapa"
      >
        <span className="rc-maptype-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      {showMapMode && (
        <MapTypeSelector
          activeType={effectiveMapMode}
          onSelect={(val) => {
            localStorage.setItem("mapMode", val);
            onChangeMapMode?.(val);
            setShowMapMode(false);
          }}
          onClose={() => setShowMapMode(false)}
        />
      )}
    </div>
  );
}
