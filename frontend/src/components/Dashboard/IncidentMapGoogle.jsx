import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { GoogleMap, InfoWindow, useLoadScript } from "@react-google-maps/api";

import MapTypeSelector from "./components/MapTypeSelector";
import HeatmapControls from "./components/HeatmapControls";
import { buildHeatmapData, getHeatmapOptions } from "./utils/heatmapUtils";

const containerStyle = { width: "100%", height: "100%" };
const GOOGLE_LIBRARIES = ["places", "visualization", "geometry"];

const TYPE = {
  robbery: { label: "Robos/Asaltos", color: "#ef4444", emoji: "🚨", z: 60 },
  accident: { label: "Accidentes", color: "#f59e0b", emoji: "🚗", z: 40 },
  emergency: { label: "Emergencias", color: "#dc2626", emoji: "⚠️", z: 80 },
  theft: { label: "Hurtos", color: "#f97316", emoji: "🔒", z: 50 },
  vandalism: { label: "Vandalismo", color: "#8b5cf6", emoji: "🏚️", z: 30 },
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

function buildSvgPin({ emoji, color, selected }) {
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
            fill="${color}" stroke="rgba(255,255,255,0.95)" stroke-width="3" ${filterAttr}/>
      <circle cx="32" cy="30" r="${circle}" fill="rgba(255,255,255,0.92)"/>
      <text x="32" y="35" font-size="${font}" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
    </g>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getMarkerIcon(typeKey, selected) {
  const t = TYPE[typeKey] || TYPE.robbery;
  const url = buildSvgPin({ emoji: t.emoji, color: t.color, selected });

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

// user dot
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
  if (s.includes("TRAFFIC_JAM") || s.includes("JAM")) return "#ef4444"; // rojo
  if (s.includes("SLOW")) return "#f59e0b"; // amarillo/naranja
  if (s.includes("NORMAL")) return "#22c55e"; // verde
  return "#60a5fa"; // fallback
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

export default function IncidentMapGoogle({
  center,
  zoom,
  incidents,
  mapMode,
  onChangeMapMode,
  onMapBackgroundClick,

  userLocation,
  followMe,
  onCenterToMe,
  onUserPanMap,

  directions,
  routeIndex = 0,

  // NUEVO
  trafficData,
}) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_LIBRARIES,
  });

  const [mapObj, setMapObj] = useState(null);

  const markersRef = useRef(new Map());
  const heatLayerRef = useRef(null);

  const [selected, setSelected] = useState(null);
  const [showMapMode, setShowMapMode] = useState(false);

  const [heatPanelOpen, setHeatPanelOpen] = useState(false);
  const [heatmapOn, setHeatmapOn] = useState(false);

  // location layers
  const meMarkerRef = useRef(null);
  const meAccuracyRef = useRef(null);
  const mePulseRef = useRef(null);
  const meHeadingRef = useRef(null);
  const latestPosRef = useRef(null);

  // directions renderer
  const dirRendererRef = useRef(null);

  // traffic polylines
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
        return { ...i, lat, lng, type: i.type || "robbery" };
      })
      .filter(Boolean);
  }, [incidents]);

  const options = useMemo(() => computeMapOptions(effectiveMapMode), [effectiveMapMode]);

  const heatmapData = useMemo(() => {
    if (!isLoaded) return [];
    if (!window.google) return [];
    return buildHeatmapData({
      google: window.google,
      incidents: cleanIncidents,
      mode: "all",
      weighted: true,
    });
  }, [isLoaded, cleanIncidents]);

  const heatmapOptions = useMemo(() => {
    const count = Array.isArray(heatmapData) ? heatmapData.length : 0;
    return getHeatmapOptions({ preset: "auto", pointCount: count });
  }, [heatmapData]);

  const onMapClick = useCallback(() => {
    setSelected(null);
    setShowMapMode(false);
    setHeatPanelOpen(false);
    if (onMapBackgroundClick) onMapBackgroundClick();
  }, [onMapBackgroundClick]);

  const handleMapLoad = useCallback((map) => {
    setMapObj(map);
  }, []);

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
        } catch (_) {}
        ref.current = null;
      }
    });
  }, [cleanupPulseInterval]);

  const cleanupDirections = useCallback(() => {
    if (dirRendererRef.current) {
      try {
        dirRendererRef.current.setMap(null);
      } catch (_) {}
      dirRendererRef.current = null;
    }
  }, []);

  const cleanupTrafficPolylines = useCallback(() => {
    const arr = trafficPolylinesRef.current || [];
    for (const pl of arr) {
      try {
        pl.setMap(null);
      } catch (_) {}
    }
    trafficPolylinesRef.current = [];
  }, []);

  const cleanupDestMarker = useCallback(() => {
    if (destMarkerRef.current) {
      try {
        destMarkerRef.current.setMap(null);
      } catch (_) {}
      destMarkerRef.current = null;
    }
  }, []);

  const handleMapUnmount = useCallback(() => {
    for (const m of markersRef.current.values()) m.setMap(null);
    markersRef.current.clear();

    if (heatLayerRef.current) {
      try {
        heatLayerRef.current.setMap(null);
      } catch (_) {}
      heatLayerRef.current = null;
    }

    cleanupMeLayers();
    cleanupDirections();
    cleanupTrafficPolylines();
    cleanupDestMarker();

    setMapObj(null);
  }, [cleanupMeLayers, cleanupDirections, cleanupTrafficPolylines, cleanupDestMarker]);

  // draw directions (base route)
  useEffect(() => {
    if (!isLoaded || !mapObj || !window.google) return;

    if (!directions || !directions.routes || directions.routes.length === 0) {
      cleanupDirections();
      cleanupTrafficPolylines();
      cleanupDestMarker();
      return;
    }

    const hasTrafficOverlay = !!trafficData;

    if (!dirRendererRef.current) {
      dirRendererRef.current = new window.google.maps.DirectionsRenderer({
        map: mapObj,
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: {
          strokeOpacity: hasTrafficOverlay ? 0 : 0.9, // si hay trafico segmentado, ocultamos la azul
          strokeWeight: 6,
          strokeColor: "#60a5fa",
        },
      });
    } else {
      try {
        dirRendererRef.current.setOptions({
          polylineOptions: {
            strokeOpacity: hasTrafficOverlay ? 0 : 0.9,
            strokeWeight: 6,
            strokeColor: "#60a5fa",
          },
        });
      } catch (_) {}
    }

    dirRendererRef.current.setDirections(directions);

    try {
      dirRendererRef.current.setRouteIndex(routeIndex || 0);
    } catch (_) {}
  }, [isLoaded, mapObj, directions, routeIndex, trafficData, cleanupDirections, cleanupTrafficPolylines, cleanupDestMarker]);

  // destination pin marker (end_location of selected route)
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

  // traffic overlay (Routes API v2) - only on route
  useEffect(() => {
    if (!isLoaded || !mapObj || !window.google) return;

    // reset previous traffic polylines
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

    // If no intervals, draw single green polyline (meaning "no data but route ok")
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

  // location: dot + pulse + accuracy + heading
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
        radius: 10,
        strokeOpacity: 0,
        fillColor: "#3b82f6",
        fillOpacity: 0.22,
        zIndex: 3500,
        clickable: false,
      });

      let r = 10;
      let growing = true;

      mePulseRef.current.__pulseInterval = setInterval(() => {
        if (!mePulseRef.current) return;
        const p = latestPosRef.current;
        if (!p) return;

        if (growing) {
          r += 2;
          if (r > 46) growing = false;
        } else {
          r -= 2;
          if (r < 10) growing = true;
        }

        try {
          mePulseRef.current.setCenter(p);
          mePulseRef.current.setRadius(r);
        } catch (_) {}
      }, 60);
    } else {
      mePulseRef.current.setCenter(pos);
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
      } catch (_) {}
      meAccuracyRef.current = null;
    }

    if (Number.isFinite(userLocation.heading)) {
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
      } catch (_) {}
      meHeadingRef.current = null;
    }
  }, [isLoaded, mapObj, userLocation, cleanupMeLayers]);

  // heatmap
  useEffect(() => {
    if (!isLoaded) return;
    if (!mapObj) return;
    if (!window.google?.maps?.visualization?.HeatmapLayer) return;

    if (!heatmapOn) {
      if (heatLayerRef.current) {
        try {
          heatLayerRef.current.setMap(null);
        } catch (_) {}
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
      } catch (_) {}
    }
  }, [isLoaded, mapObj, heatmapOn, heatmapData, heatmapOptions]);

  // incident markers
  useEffect(() => {
    if (!isLoaded) return;
    if (!mapObj) return;

    for (const m of markersRef.current.values()) m.setMap(null);
    markersRef.current.clear();

    if (heatmapOn) return;

    for (const i of cleanIncidents) {
      const isSel = selected?.id === i.id;
      const t = TYPE[i.type] || TYPE.robbery;

      const marker = new window.google.maps.Marker({
        map: mapObj,
        position: { lat: i.lat, lng: i.lng },
        icon: getMarkerIcon(i.type, isSel),
        zIndex: isSel ? 2000 : t.z,
      });

      marker.addListener("click", () => {
        setSelected(i);
        setShowMapMode(false);
        setHeatPanelOpen(false);
      });

      markersRef.current.set(i.id, marker);
    }
  }, [isLoaded, mapObj, cleanIncidents, selected, heatmapOn]);

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
        onZoomChanged={() => onUserPanMap?.()}
        options={options}
        onLoad={handleMapLoad}
        onUnmount={handleMapUnmount}
      >
        {!heatmapOn && selected && (
          <InfoWindow position={{ lat: selected.lat, lng: selected.lng }} onCloseClick={() => setSelected(null)}>
            <div style={{ maxWidth: 280 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                {selected.title || (TYPE[selected.type]?.label ?? "Incidente")}
              </div>
              <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>{selected.description}</div>
              {selected.address ? <div style={{ fontSize: 12, opacity: 0.75 }}>{selected.address}</div> : null}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

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
          setHeatPanelOpen((v) => !v);
        }}
        title="Zonas calientes"
      >
        🔥
      </button>

      <HeatmapControls open={heatPanelOpen} setOpen={setHeatPanelOpen} heatmapOn={heatmapOn} setHeatmapOn={setHeatmapOn} />

      <button
        type="button"
        className="rc-maptype-fab"
        onClick={() => {
          setHeatPanelOpen(false);
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
