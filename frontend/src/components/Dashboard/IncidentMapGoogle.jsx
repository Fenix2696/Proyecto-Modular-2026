import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { GoogleMap, InfoWindow, useLoadScript } from "@react-google-maps/api";

import MapTypeSelector from "./components/MapTypeSelector";
import HeatmapControls from "./components/HeatmapControls";
import { buildHeatmapData, getHeatmapOptions } from "./utils/heatmapUtils";

const containerStyle = { width: "100%", height: "100%" };
const GOOGLE_LIBRARIES = ["places", "visualization"];

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

function getDraftIcon() {
  const url = buildSvgPin({ emoji: "📍", color: "#22c55e", selected: true });
  return {
    url,
    scaledSize: new window.google.maps.Size(62, 62),
    anchor: new window.google.maps.Point(31, 62),
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

export default function IncidentMapGoogle({
  center,
  incidents,
  mapMode,
  onChangeMapMode,
  onMapBackgroundClick,
  draftPin,
}) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_LIBRARIES,
  });

  const [mapObj, setMapObj] = useState(null);

  const markersRef = useRef(new Map());
  const heatLayerRef = useRef(null); // capa nativa

  const [selected, setSelected] = useState(null);
  const [showMapMode, setShowMapMode] = useState(false);

  const [heatPanelOpen, setHeatPanelOpen] = useState(false);
  const [heatmapOn, setHeatmapOn] = useState(false);

  const [draftOpen, setDraftOpen] = useState(false);

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
    setDraftOpen(false);
    if (onMapBackgroundClick) onMapBackgroundClick();
  }, [onMapBackgroundClick]);

  const handleMapLoad = useCallback((map) => {
    setMapObj(map);
  }, []);

  const handleMapUnmount = useCallback(() => {
    for (const m of markersRef.current.values()) m.setMap(null);
    markersRef.current.clear();

    // quitar heatmap si quedo vivo
    if (heatLayerRef.current) {
      try {
        heatLayerRef.current.setMap(null);
      } catch (_) {}
      heatLayerRef.current = null;
    }

    setMapObj(null);
  }, []);

  // ============ HEATMAP NATIVO (FIX DEFINITIVO) ============
  useEffect(() => {
    if (!isLoaded) return;
    if (!mapObj) return;
    if (!window.google?.maps?.visualization?.HeatmapLayer) return;

    // si OFF: quitar y salir
    if (!heatmapOn) {
      if (heatLayerRef.current) {
        try {
          heatLayerRef.current.setMap(null);
        } catch (_) {}
        heatLayerRef.current = null;
      }
      return;
    }

    // ON: crear si no existe
    if (!heatLayerRef.current) {
      heatLayerRef.current = new window.google.maps.visualization.HeatmapLayer({
        data: heatmapData,
        ...heatmapOptions,
      });
      heatLayerRef.current.setMap(mapObj);
    } else {
      // actualizar data/opciones si ya existe
      try {
        heatLayerRef.current.setData(heatmapData);
        heatLayerRef.current.setOptions(heatmapOptions);
        heatLayerRef.current.setMap(mapObj);
      } catch (_) {}
    }

    // cleanup por si se desmonta el componente
    return () => {
      if (heatLayerRef.current && !heatmapOn) {
        try {
          heatLayerRef.current.setMap(null);
        } catch (_) {}
        heatLayerRef.current = null;
      }
    };
  }, [isLoaded, mapObj, heatmapOn, heatmapData, heatmapOptions]);
  // =========================================================

  // Markers: se apagan si heatmapOn
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
        zIndex: isSel ? 999 : t.z,
      });

      marker.addListener("click", () => {
        setSelected(i);
        setShowMapMode(false);
        setHeatPanelOpen(false);
        setDraftOpen(false);
      });

      markersRef.current.set(i.id, marker);
    }
  }, [isLoaded, mapObj, cleanIncidents, selected, heatmapOn]);

  useEffect(() => {
    if (!draftPin) setDraftOpen(false);
  }, [draftPin]);

  if (loadError) return <div style={{ padding: 16 }}>Error cargando Google Maps.</div>;
  if (!isLoaded) return <div style={{ padding: 16 }}>Cargando Google Maps...</div>;

  return (
    <div className="rc-gmap-root">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={13}
        onClick={onMapClick}
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

        {draftPin && draftOpen && (
          <InfoWindow
            position={{ lat: Number(draftPin.lat), lng: Number(draftPin.lng) }}
            onCloseClick={() => setDraftOpen(false)}
            options={{ disableAutoPan: true }}
          >
            <div style={{ maxWidth: 260 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Ubicacion del reporte</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                {draftPin.address ? draftPin.address : "Selecciona una direccion con Google Places."}
              </div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>
                {Number(draftPin.lat).toFixed(5)}, {Number(draftPin.lng).toFixed(5)}
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      <DraftPinMarker isLoaded={isLoaded} map={mapObj} draftPin={draftPin} onClick={() => setDraftOpen(true)} />

      <button
        type="button"
        className={`rc-heatmap-fab ${heatmapOn ? "active" : ""}`}
        onClick={() => {
          // evita overlays encimados
          setShowMapMode(false);
          setHeatPanelOpen((v) => !v);
        }}
        title="Zonas calientes"
      >
        🔥
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
            if (onChangeMapMode) onChangeMapMode(val);
            setShowMapMode(false);
          }}
          onClose={() => setShowMapMode(false)}
        />
      )}
    </div>
  );
}

function DraftPinMarker({ isLoaded, map, draftPin, onClick }) {
  const markerRef = useRef(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!map) return;

    if (!draftPin) {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      return;
    }

    const pos = { lat: Number(draftPin.lat), lng: Number(draftPin.lng) };
    if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return;

    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        map,
        position: pos,
        icon: getDraftIcon(),
        zIndex: 2000,
        title: "Ubicacion del reporte",
      });

      if (onClick) markerRef.current.addListener("click", onClick);
    } else {
      markerRef.current.setPosition(pos);
    }
  }, [isLoaded, map, draftPin, onClick]);

  return null;
}
