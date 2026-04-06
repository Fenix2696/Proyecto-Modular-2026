import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import "../../styles/dashboard.css";
import "../../styles/directions.css";

import ErrorBoundary from "../common/ErrorBoundary";
import DashboardTopbar from "./components/DashboardTopbar.jsx";
import DashboardSidebar from "./components/DashboardSidebar.jsx";
import DashboardPanel from "./components/DashboardPanel.jsx";
import AccountModal from "./components/AccountModal.jsx";

import IncidentMapGoogle from "./IncidentMapGoogle";
import ReportModal from "./ReportModal";

import { getAllIncidents, createIncident } from "../../services/api";
import { getMe } from "../../services/user";
import { getActiveAIReports } from "../../services/aiReports";

// consume backend Routes API v2
import { computeTrafficRoutes } from "../../services/routesTraffic";

import { getTimeAgo, inTimeRange } from "./utils/dashboardUtils";

const TYPE_SEARCH_TEXT = {
  robbery: "asalto robo asaltos robos",
  accident: "accidente choque choques colision colisiones",
  emergency: "emergencia emergencias auxilio",
  theft: "hurto hurto/robo robo menor",
  vandalism: "vandalismo danos grafiti destrozos",
};

function riskWeight(type) {
  switch ((type || "").toLowerCase()) {
    case "accident":
      return 3.2;
    case "emergency":
      return 2.4;
    case "robbery":
      return 2.0;
    case "theft":
      return 1.4;
    case "vandalism":
      return 1.2;
    default:
      return 1.0;
  }
}

function waitForGoogle(timeoutMs = 12000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const t = setInterval(() => {
      const ok =
        typeof window !== "undefined" &&
        window.google &&
        window.google.maps &&
        window.google.maps.DirectionsService &&
        window.google.maps.Geocoder &&
        window.google.maps.geometry &&
        window.google.maps.geometry.spherical &&
        window.google.maps.geometry.spherical.computeDistanceBetween;

      if (ok) {
        clearInterval(t);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(t);
        reject(new Error("Google Maps no listo"));
      }
    }, 120);
  });
}

function getModeForDirections(modeKey) {
  if (modeKey === "MOTO") return "DRIVING";
  if (modeKey === "RAIL") return "TRANSIT";
  return modeKey;
}

function getTransitOptions(modeKey) {
  if (modeKey === "RAIL") return { modes: ["RAIL"] };
  return null;
}

function computeIncidentsNearRoute(route, incidents, thresholdM = 220) {
  const path = route?.overview_path || [];
  if (!Array.isArray(path) || path.length === 0) return [];

  const step = Math.max(1, Math.floor(path.length / 110));
  const sample = [];
  for (let i = 0; i < path.length; i += step) sample.push(path[i]);
  if (sample[sample.length - 1] !== path[path.length - 1]) {
    sample.push(path[path.length - 1]);
  }

  const res = [];
  for (const it of incidents || []) {
    const lat = Number(it.lat);
    const lng = Number(it.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const p = new window.google.maps.LatLng(lat, lng);

    let best = Infinity;
    for (const s of sample) {
      const d = window.google.maps.geometry.spherical.computeDistanceBetween(
        p,
        s
      );
      if (d < best) best = d;
      if (best <= 40) break;
    }

    if (best <= thresholdM) res.push({ ...it, distanceToRouteM: best });
  }

  res.sort((a, b) => a.distanceToRouteM - b.distanceToRouteM);
  return res;
}

function scoreRoute(route, incidentsNear) {
  const leg = route?.legs?.[0];
  const baseSec =
    leg?.duration_in_traffic?.value || leg?.duration?.value || 999999;

  let risk = 0;
  for (const it of incidentsNear) {
    const w = riskWeight(it.type);
    const d = Number(it.distanceToRouteM);
    const nearFactor = Number.isFinite(d) ? Math.max(0, 1 - d / 220) : 0.35;
    risk += w * (0.6 + 0.8 * nearFactor);
  }

  const penaltySec = risk * 120;
  return baseSec + penaltySec;
}

function toRoutesInfo(directions, incidents, modeKey) {
  const routes = directions?.routes || [];
  return routes.map((r) => {
    const leg = r.legs?.[0];
    const incidentsNear = computeIncidentsNearRoute(r, incidents, 220);
    const durationSec =
      (modeKey === "DRIVING" || modeKey === "MOTO") &&
      leg?.duration_in_traffic?.value
        ? leg.duration_in_traffic.value
        : leg?.duration?.value;

    return {
      summary: r.summary || "",
      distanceMeters: leg?.distance?.value,
      durationSec,
      incidentsCount: incidentsNear.length,
      incidentsNear,
      note:
        (modeKey === "TRANSIT" || modeKey === "RAIL") &&
        incidentsNear.length > 0
          ? "Precaucion: hay reportes cerca"
          : "",
    };
  });
}

function buildAbsolutePhotoUrl(user, photoTs) {
  const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api")
    .trim()
    .replace(/\/+$/, "");
  const apiHost = apiBase.replace(/\/api$/i, "");

  const u = user || {};
  const id = u.id || u.user_id || u.userId;
  const hasLocalPhoto = u.has_photo === true || u.hasPhoto === true;

  const raw = (u.photo_url || u.photo || u.avatar || u.photo_path || "").trim();
  const normalizedRaw = /^undefined|null$/i.test(raw) ? "" : raw;
  if (normalizedRaw) {
    if (normalizedRaw.startsWith("//")) {
      const abs = `https:${normalizedRaw}`;
      return `${abs}${abs.includes("?") ? "&" : "?"}ts=${photoTs}`;
    }
    if (/^https?:\/\//i.test(normalizedRaw)) {
      return `${normalizedRaw}${normalizedRaw.includes("?") ? "&" : "?"}ts=${photoTs}`;
    }
    if (normalizedRaw.startsWith("/api/")) return `${apiHost}${normalizedRaw}?ts=${photoTs}`;
    if (normalizedRaw.startsWith("/")) return `${apiBase}${normalizedRaw}?ts=${photoTs}`;
  }

  if (id && hasLocalPhoto) return `${apiBase}/users/${id}/photo?ts=${photoTs}`;
  return "";
}

// mapeo modo UI -> Routes API v2
function mapModeToRoutesApi(modeKey) {
  if (modeKey === "MOTO") return "TWO_WHEELER";
  if (modeKey === "WALKING") return "WALK";
  if (modeKey === "BICYCLING") return "BICYCLE";
  if (modeKey === "TRANSIT" || modeKey === "RAIL") return "TRANSIT";
  return "DRIVE";
}

function mapAiCategoryToType(category) {
  const c = String(category || "").toLowerCase();

  if (c === "asalto" || c === "robo") return "robbery";
  if (c === "choque") return "accident";
  if (c === "emergencia" || c === "violencia") return "emergency";
  if (c === "cristalazo" || c === "delito") return "theft";
  if (c === "vandalismo") return "vandalism";

  return "theft";
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activePanel, setActivePanel] = useState("none");

  const [showReportModal, setShowReportModal] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState([]);
  const [aiReports, setAiReports] = useState([]);

  const [mapCenter, setMapCenter] = useState([20.6597, -103.3496]);
  const [mapZoom, setMapZoom] = useState(13);

  const [userLocation, setUserLocation] = useState(null);
  const [followMe, setFollowMe] = useState(false);
  const didInitialFlyToMeRef = useRef(false);

  const sidebarRef = useRef(null);
  const menuButtonRef = useRef(null);

  // DIRECTIONS: origen/destino
  const [originInput, setOriginInput] = useState("Tu ubicacion");
  const originLatLngRef = useRef(null);
  const [originIsMyLocation, setOriginIsMyLocation] = useState(true);

  const [destInput, setDestInput] = useState("");
  const destLatLngRef = useRef(null);
  const [destIsMyLocation, setDestIsMyLocation] = useState(false);

  const [travelMode, setTravelMode] = useState("DRIVING");

  const [directions, setDirections] = useState(null);
  const [routesInfo, setRoutesInfo] = useState([]);
  const [routeIndex, setRouteIndex] = useState(0);

  // trafficData (Routes API v2)
  const [trafficData, setTrafficData] = useState(null);

  // navegacion
  const [navigationActive, setNavigationActive] = useState(false);
  const [navigationCurrentStep, setNavigationCurrentStep] = useState(null);

  const [incidentQuery, setIncidentQuery] = useState("");

  const [filters, setFilters] = useState({
    robbery: true,
    accident: true,
    emergency: true,
    theft: true,
    vandalism: true,
    timeRange: "all",
  });

  const [mapMode, setMapMode] = useState(
    () => localStorage.getItem("mapMode") || "dark"
  );
  useEffect(() => localStorage.setItem("mapMode", mapMode), [mapMode]);

  const [userProfile, setUserProfile] = useState(null);
  const [photoTs, setPhotoTs] = useState(() => Date.now());
  const [clearMapToken, setClearMapToken] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadIncidents(), loadAIReports(50), loadProfile()]);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  useEffect(() => {
    const handleClickOutsideSidebar = (event) => {
      if (sidebarCollapsed) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const clickedInsideSidebar = !!target.closest(".rc-sidebar");
      const clickedInsidePanel = !!target.closest(".rc-panel");
      const clickedMenuButton =
        !!target.closest(".menu-button") ||
        !!target.closest(".rc-menu-btn");

      // Sugerencias / autocomplete / busquedas recientes / wrappers de busqueda
      const clickedInsidePac = !!target.closest(".pac-container");
      const clickedInsideRecent = !!target.closest(".rc-recent-searches");
      const clickedInsidePlacesWrap = !!target.closest(".rc-places-wrap");
      const clickedInsideSearch = !!target.closest(".rc-search");
      const clickedInsideTopbar = !!target.closest(".rc-topbar");
      const clickedInsideAutocompleteWidget =
        !!target.closest(".gmp-autocomplete") ||
        !!target.closest(".gmpx-placeautocomplete");

      if (
        clickedInsideSidebar ||
        clickedInsidePanel ||
        clickedMenuButton ||
        clickedInsidePac ||
        clickedInsideRecent ||
        clickedInsidePlacesWrap ||
        clickedInsideSearch ||
        clickedInsideTopbar ||
        clickedInsideAutocompleteWidget
      ) {
        return;
      }

      setSidebarCollapsed(true);

      if (activePanel !== "none") {
        setActivePanel("none");
      }
    };

    document.addEventListener("mousedown", handleClickOutsideSidebar);
    document.addEventListener("touchstart", handleClickOutsideSidebar);

    return () => {
      document.removeEventListener("mousedown", handleClickOutsideSidebar);
      document.removeEventListener("touchstart", handleClickOutsideSidebar);
    };
  }, [sidebarCollapsed, activePanel]);

  // first view = my location + zoom
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    if (didInitialFlyToMeRef.current) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy, heading, speed } =
          pos.coords || {};
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        const loc = {
          lat: latitude,
          lng: longitude,
          accuracy: Number.isFinite(accuracy) ? accuracy : null,
          heading: Number.isFinite(heading) ? heading : null,
          speed: Number.isFinite(speed) ? speed : null,
          ts: pos.timestamp || Date.now(),
        };

        setUserLocation(loc);
        setMapCenter([loc.lat, loc.lng]);
        setMapZoom(16);
        setFollowMe(true);
        didInitialFlyToMeRef.current = true;
      },
      () => {
        didInitialFlyToMeRef.current = true;
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 12000 }
    );
  }, []);

  // realtime location
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, heading, speed } =
          pos.coords || {};
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        const next = {
          lat: latitude,
          lng: longitude,
          accuracy: Number.isFinite(accuracy) ? accuracy : null,
          heading: Number.isFinite(heading) ? heading : null,
          speed: Number.isFinite(speed) ? speed : null,
          ts: pos.timestamp || Date.now(),
        };

        setUserLocation(next);

        if (followMe) {
          setMapCenter([next.lat, next.lng]);
          setMapZoom((z) => Math.max(z, 16));
        }
      },
      () => {
        setUserLocation(null);
        setFollowMe(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [followMe]);

  const loadProfile = async () => {
    try {
      const res = await getMe();
      if (res?.success && res.user) {
        setUserProfile(res.user);
        localStorage.setItem("user", JSON.stringify(res.user));
        return;
      }
      const raw = localStorage.getItem("user");
      setUserProfile(raw ? JSON.parse(raw) : { email: "Usuario" });
    } catch {
      const raw = localStorage.getItem("user");
      setUserProfile(raw ? JSON.parse(raw) : { email: "Usuario" });
    }
  };

  const loadIncidents = async () => {
    try {
      const res = await getAllIncidents();
      if (res?.success && Array.isArray(res.data)) {
        const clean = res.data
          .map((i) => ({
            ...i,
            timestamp: i.timestamp ? new Date(i.timestamp) : new Date(),
          }))
          .filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng));
        setIncidents(clean);
      } else {
        setIncidents([]);
      }
    } catch {
      setIncidents([]);
    }
  };

  const loadAIReports = async (limit = 50) => {
    try {
      const response = await getActiveAIReports(limit);
      const rows = response?.data || [];

      const activos = rows.filter(
        (r) =>
          r.is_active === true ||
          r.is_active === undefined ||
          r.is_active === null
      );

      setAiReports(activos.length ? activos : rows);

      return activos.length ? activos : rows;
    } catch (error) {
      console.error("Error cargando noticias IA:", error);
      setAiReports([]);
      return [];
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  const filteredIncidents = useMemo(() => {
    const q = (incidentQuery || "").trim().toLowerCase();
    return incidents.filter((i) => {
      if (!filters[i.type]) return false;
      if (!inTimeRange(i.timestamp, filters.timeRange)) return false;
      if (!q) return true;

      const t = (i.title || "").toLowerCase();
      const d = (i.description || "").toLowerCase();
      const a = (i.address || "").toLowerCase();
      const typeText = (TYPE_SEARCH_TEXT[i.type] || i.type || "").toLowerCase();
      return (
        t.includes(q) ||
        d.includes(q) ||
        a.includes(q) ||
        typeText.includes(q)
      );
    });
  }, [incidents, incidentQuery, filters]);

  const aiRouteIncidents = useMemo(() => {
    const q = (incidentQuery || "").trim().toLowerCase();

    return (aiReports || [])
      .map((r) => {
        const lat = Number(r.lat ?? r.latitude);
        const lng = Number(r.lng ?? r.longitude);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        const type = mapAiCategoryToType(r.category);
        const timestampValue =
          r.published_at ||
          r.publishedAt ||
          r.date ||
          r.created_at ||
          r.createdAt ||
          r.updated_at ||
          r.updatedAt;

        const timestamp = timestampValue ? new Date(timestampValue) : new Date();

        return {
          id: `ai-${r.id}`,
          type,
          lat,
          lng,
          title: r.title || "Reporte IA",
          description: r.summary || r.description || r.title || "Reporte IA",
          address: r.address || r.location || "",
          timestamp,
          source: "ai",
          category: r.category || "otro",
          source_name: r.source_name || "IA",
        };
      })
      .filter((i) => {
        if (!i) return false;
        if (!filters[i.type]) return false;
        if (!inTimeRange(i.timestamp, filters.timeRange)) return false;
        if (!q) return true;

        const t = (i.title || "").toLowerCase();
        const d = (i.description || "").toLowerCase();
        const a = (i.address || "").toLowerCase();
        const typeText = (TYPE_SEARCH_TEXT[i.type] || i.type || "").toLowerCase();

        return (
          t.includes(q) ||
          d.includes(q) ||
          a.includes(q) ||
          typeText.includes(q)
        );
      });
  }, [aiReports, incidentQuery, filters]);

  const allRouteIncidents = useMemo(() => {
    return [...filteredIncidents, ...aiRouteIncidents];
  }, [filteredIncidents, aiRouteIncidents]);

  const stats = useMemo(() => {
    const base = {
      total: allRouteIncidents.length,
      robbery: 0,
      accident: 0,
      emergency: 0,
      theft: 0,
      vandalism: 0,
    };
    for (const i of allRouteIncidents) {
      if (base[i.type] !== undefined) base[i.type] += 1;
    }
    return base;
  }, [allRouteIncidents]);

  const handleCenterToMe = () => {
    if (!userLocation) return;
    setFollowMe(true);
    setMapCenter([userLocation.lat, userLocation.lng]);
    setMapZoom((z) => Math.max(z, 16));
  };

  const handleUserPanMap = () => {
    if (followMe) setFollowMe(false);
  };

  const handleCreate = async (data) => {
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      alert("Ubicacion invalida");
      return;
    }

    try {
      const res = await createIncident({ ...data, lat, lng });
      if (!res?.success) {
        alert(res?.message || "Error al crear incidente");
        return;
      }
      setShowReportModal(false);
      setFollowMe(false);
      setMapCenter([lat, lng]);
      setMapZoom((z) => Math.max(z, 16));
      await loadIncidents();
    } catch {
      alert("Error al crear incidente");
    }
  };

  const focusIncident = (i) => {
    setFollowMe(false);
    setMapCenter([i.lat, i.lng]);
    setMapZoom((z) => Math.max(z, 16));
    setActivePanel("none");
  };

  const resetFilters = () => {
    setFilters({
      robbery: true,
      accident: true,
      emergency: true,
      theft: true,
      vandalism: true,
      timeRange: "all",
    });
    setIncidentQuery("");
  };

  const handleProfileUpdated = async () => {
    await loadProfile();
    setPhotoTs(Date.now());
  };

  const getPointLatLng = (isMyLocation, refObj) => {
    if (isMyLocation) {
      if (!userLocation) return null;
      return new window.google.maps.LatLng(userLocation.lat, userLocation.lng);
    }
    const p = refObj?.current;
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
    return new window.google.maps.LatLng(p.lat, p.lng);
  };

  const getPointPlain = (isMyLocation, refObj) => {
    if (isMyLocation) {
      if (!userLocation) return null;
      return { lat: Number(userLocation.lat), lng: Number(userLocation.lng) };
    }
    const p = refObj?.current;
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
    return { lat: Number(p.lat), lng: Number(p.lng) };
  };

  const buildDirections = async (modeKey) => {
    await waitForGoogle();

    const originLL = getPointLatLng(originIsMyLocation, originLatLngRef);
    const destLL = getPointLatLng(destIsMyLocation, destLatLngRef);
    if (!originLL || !destLL) return;

    try {
      const originPlain = getPointPlain(originIsMyLocation, originLatLngRef);
      const destPlain = getPointPlain(destIsMyLocation, destLatLngRef);

      if (originPlain && destPlain) {
        const backendMode = mapModeToRoutesApi(modeKey);
        const trafficRes = await computeTrafficRoutes({
          origin: originPlain,
          destination: destPlain,
          travelMode: backendMode,
          alternatives: true,
        });

        if (trafficRes?.success && trafficRes?.data) {
          setTrafficData(trafficRes.data);
        } else {
          setTrafficData(null);
        }
      } else {
        setTrafficData(null);
      }
    } catch (e) {
      console.warn("No se pudo obtener trafficData:", e?.message || e);
      setTrafficData(null);
    }

    const service = new window.google.maps.DirectionsService();
    const mode = getModeForDirections(modeKey);

    const req = {
      origin: originLL,
      destination: destLL,
      travelMode: window.google.maps.TravelMode[mode],
      provideRouteAlternatives: true,
    };

    if (modeKey === "DRIVING" || modeKey === "MOTO") {
      req.drivingOptions = {
        departureTime: new Date(),
        trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
      };
    }

    const tr = getTransitOptions(modeKey);
    if (tr) {
      req.transitOptions = {
        departureTime: new Date(),
        modes: tr.modes.map((m) => window.google.maps.TransitMode[m]),
      };
    }

    const res = await new Promise((resolve, reject) => {
      service.route(req, (result, status) => {
        if (status === "OK" && result) resolve(result);
        else reject(new Error(status || "Directions error"));
      });
    });

    const info = toRoutesInfo(res, allRouteIncidents, modeKey);

    let bestIdx = 0;
    let bestScore = Infinity;
    for (let i = 0; i < res.routes.length; i++) {
      const near = info[i]?.incidentsNear || [];
      const score = scoreRoute(res.routes[i], near);
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    setDirections(res);
    setRoutesInfo(info);
    setRouteIndex(bestIdx);
  };

  const openDirectionsPanel = () => setActivePanel("directions");

  const handleClearDirections = () => {
    setNavigationActive(false);
    setNavigationCurrentStep(null);

    setDirections(null);
    setRoutesInfo([]);
    setRouteIndex(0);
    setTrafficData(null);

    setDestInput("");
    destLatLngRef.current = null;
    setDestIsMyLocation(false);

    // IMPORTANTE:
    // al salir de la navegacion o limpiar la ruta,
    // NO reactivar followMe automaticamente
    setFollowMe(false);

    setClearMapToken((prev) => prev + 1);
  };

  const handleStartNavigation = () => {
    if (!directions?.routes?.length) return;
    setNavigationActive(true);
  };

  const handleStopNavigation = () => {
    setNavigationActive(false);
    setNavigationCurrentStep(null);
    setFollowMe(false);
  };

  const handleNavigationStepChange = (step) => {
    setNavigationCurrentStep(step || null);
  };

  const handleNavigationComplete = () => {
    setNavigationActive(false);
    setNavigationCurrentStep(null);
    setFollowMe(false);
  };

  const handleOriginSelect = async ({ lat, lng, address }) => {
    originLatLngRef.current = { lat, lng, address: address || "" };
    setOriginInput(address || "");
    setOriginIsMyLocation(false);

    openDirectionsPanel();
    setNavigationActive(false);
    setNavigationCurrentStep(null);

    try {
      await buildDirections(travelMode);
    } catch {
      setDirections(null);
      setRoutesInfo([]);
      setTrafficData(null);
    }
  };

  const handleDestinationSelect = async ({ lat, lng, address }) => {
    destLatLngRef.current = { lat, lng, address: address || "" };
    setDestInput(address || "");
    setDestIsMyLocation(false);

    openDirectionsPanel();

    setNavigationActive(false);
    setNavigationCurrentStep(null);

    setFollowMe(false);
    setMapCenter([lat, lng]);
    setMapZoom((z) => Math.max(z, 14));

    try {
      await buildDirections(travelMode);
    } catch {
      setDirections(null);
      setRoutesInfo([]);
      setTrafficData(null);
    }
  };

  const geocodeByText = async (q) => {
    const text = (q || "").trim();
    if (!text) return null;

    await waitForGoogle();
    const geocoder = new window.google.maps.Geocoder();

    const { results } = await new Promise((resolve, reject) => {
      geocoder.geocode({ address: text, region: "mx" }, (res, status) => {
        if (status === "OK" && res && res.length) resolve({ results: res });
        else reject(new Error(status || "Geocode error"));
      });
    });

    const best = results[0];
    const loc = best.geometry?.location;
    const lat = loc?.lat?.();
    const lng = loc?.lng?.();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng, address: best.formatted_address || text };
  };

  const handleOriginEnter = async (text) => {
    openDirectionsPanel();
    try {
      const p = await geocodeByText(text);
      if (!p) return;
      originLatLngRef.current = p;
      setOriginInput(p.address || "");
      setOriginIsMyLocation(false);

      setNavigationActive(false);
      setNavigationCurrentStep(null);

      await buildDirections(travelMode);
    } catch {}
  };

  const handleDestinationEnter = async (text) => {
    openDirectionsPanel();
    try {
      const p = await geocodeByText(text);
      if (!p) return;
      destLatLngRef.current = p;
      setDestInput(p.address || "");
      setDestIsMyLocation(false);

      setNavigationActive(false);
      setNavigationCurrentStep(null);

      setFollowMe(false);
      setMapCenter([p.lat, p.lng]);
      setMapZoom((z) => Math.max(z, 14));

      await buildDirections(travelMode);
    } catch {}
  };

  useEffect(() => {
    if (!userLocation && (originIsMyLocation || destIsMyLocation)) return;
    if (!originIsMyLocation && !originLatLngRef.current) return;
    if (!destIsMyLocation && !destLatLngRef.current) return;

    (async () => {
      try {
        await buildDirections(travelMode);
      } catch {}
    })();
  }, [travelMode, originIsMyLocation, destIsMyLocation, userLocation]);

  const handleSwap = () => {
    setOriginIsMyLocation((prevOriginMy) => {
      setDestIsMyLocation(prevOriginMy);
      return destIsMyLocation;
    });

    setOriginInput((prevOriginText) => {
      setDestInput(prevOriginText);
      return destInput;
    });

    const tmp = originLatLngRef.current;
    originLatLngRef.current = destLatLngRef.current;
    destLatLngRef.current = tmp;

    setNavigationActive(false);
    setNavigationCurrentStep(null);

    setDirections(null);
    setRoutesInfo([]);
    setRouteIndex(0);
    setTrafficData(null);

    setTimeout(() => {
      buildDirections(travelMode).catch(() => {});
    }, 0);
  };

  const incidentsForSelectedRoute = useMemo(() => {
    const r = routesInfo[routeIndex];
    return r?.incidentsNear || [];
  }, [routesInfo, routeIndex]);

  const userPhotoUrl = useMemo(
    () => buildAbsolutePhotoUrl(userProfile, photoTs),
    [userProfile, photoTs]
  );

  if (loading) return <div className="rc-loading">Cargando dashboard...</div>;

  return (
    <ErrorBoundary>
      <div className={`rc-dashboard ${!sidebarCollapsed ? "sidebar-open" : ""}`}>
        <DashboardTopbar
          menuButtonRef={menuButtonRef}
          onToggleSidebar={() => {
            if (activePanel !== "none") {
              setActivePanel("none");
              setSidebarCollapsed(false);
              return;
            }

            setSidebarCollapsed((v) => !v);
          }}
          destinationInput={destInput}
          setDestinationInput={setDestInput}
          onDestinationSelect={handleDestinationSelect}
          onDestinationEnter={handleDestinationEnter}
          onClearDestination={handleClearDirections}
          onOpenReport={() => setShowReportModal(true)}
          userProfile={userProfile}
          photoTs={photoTs}
          onOpenAccount={() => setShowAccount(true)}
          onLogout={handleLogout}
        />

        <div className="rc-body">
          <DashboardSidebar
            sidebarRef={sidebarRef}
            collapsed={sidebarCollapsed}
            activePanel={activePanel}
            setActivePanel={setActivePanel}
            onLogout={handleLogout}
            userProfile={userProfile}
            photoTs={photoTs}
            onOpenAccount={() => setShowAccount(true)}
          />

          <DashboardPanel
            activePanel={activePanel}
            setActivePanel={setActivePanel}
            searchQuery={incidentQuery}
            setSearchQuery={setIncidentQuery}
            highlightQuery={incidentQuery}
            onPlaceSelect={({ lat, lng }) => {
              setFollowMe(false);
              setMapCenter([lat, lng]);
              setMapZoom((z) => Math.max(z, 16));
            }}
            filteredIncidents={filteredIncidents}
            aiReports={aiReports}
            onReloadAIReports={loadAIReports}
            onFocusIncident={focusIncident}
            getTimeAgo={getTimeAgo}
            filters={filters}
            setFilters={setFilters}
            onResetFilters={resetFilters}
            stats={stats}
            originLabel="Tu ubicacion"
            originIsMyLocation={originIsMyLocation}
            originValue={originIsMyLocation ? "Tu ubicacion" : originInput}
            setOriginValue={setOriginInput}
            onOriginSelect={handleOriginSelect}
            onOriginEnter={handleOriginEnter}
            destIsMyLocation={destIsMyLocation}
            destValue={destIsMyLocation ? "Tu ubicacion" : destInput}
            setDestValue={setDestInput}
            onDestSelect={handleDestinationSelect}
            onDestEnter={handleDestinationEnter}
            onSwap={handleSwap}
            directionsModeKey={travelMode}
            setDirectionsModeKey={setTravelMode}
            directionsRoutesInfo={routesInfo}
            directionsSelectedRouteIndex={routeIndex}
            setDirectionsSelectedRouteIndex={setRouteIndex}
            directionsIncidentsForSelectedRoute={incidentsForSelectedRoute}
            hasDirectionsRoute={!!directions?.routes?.length}
            isNavigationActive={navigationActive}
            navigationCurrentStep={navigationCurrentStep}
            onStartNavigation={handleStartNavigation}
            onStopNavigation={handleStopNavigation}
            onClearDirections={handleClearDirections}
            onStartRouteAndFocusMap={() => {
              handleStartNavigation();
              setFollowMe(true);
              setActivePanel("none");
              setSidebarCollapsed(true);
            }}
          />

          <main className="rc-main">
            <div className="rc-map-wrap">
              <IncidentMapGoogle
                center={mapCenter}
                zoom={mapZoom}
                incidents={filteredIncidents}
                aiReports={[...aiReports]}
                mapMode={mapMode}
                onChangeMapMode={setMapMode}
                userLocation={userLocation}
                followMe={followMe}
                onCenterToMe={handleCenterToMe}
                onUserPanMap={handleUserPanMap}
                directions={directions}
                routeIndex={routeIndex}
                trafficData={trafficData}
                navigationActive={navigationActive}
                onStopNavigation={handleStopNavigation}
                onClearDirections={handleClearDirections}
                onNavigationStepChange={handleNavigationStepChange}
                onNavigationComplete={handleNavigationComplete}
                clearMapToken={clearMapToken}
              />
            </div>
          </main>
        </div>

        {showReportModal && (
          <ReportModal
            onClose={() => setShowReportModal(false)}
            onSubmit={handleCreate}
            currentPosition={mapCenter}
          />
        )}

        <AccountModal
          open={showAccount}
          onClose={() => setShowAccount(false)}
          user={userProfile}
          userPhotoUrl={userPhotoUrl}
          onUpdated={handleProfileUpdated}
        />
      </div>
    </ErrorBoundary>
  );
}
