import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/dashboard.css";

import ErrorBoundary from "../common/ErrorBoundary";
import DashboardTopbar from "./components/DashboardTopbar.jsx";
import DashboardSidebar from "./components/DashboardSidebar.jsx";
import DashboardPanel from "./components/DashboardPanel.jsx";
import AccountModal from "./components/AccountModal.jsx";

import IncidentMapGoogle from "./IncidentMapGoogle";
import ReportModal from "./ReportModal";

import { getAllIncidents, createIncident } from "../../services/api";
import { getMe } from "../../services/user";
import { getTimeAgo, inTimeRange } from "./utils/dashboardUtils";

function Dashboard() {
  const navigate = useNavigate();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activePanel, setActivePanel] = useState("none");
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState([]);
  const [mapCenter, setMapCenter] = useState([20.6597, -103.3496]);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [filters, setFilters] = useState({
    robbery: true,
    accident: true,
    emergency: true,
    theft: true,
    vandalism: true,
    timeRange: "all",
  });

  const [mapMode, setMapMode] = useState(() => localStorage.getItem("mapMode") || "dark");
  useEffect(() => localStorage.setItem("mapMode", mapMode), [mapMode]);

  const [userProfile, setUserProfile] = useState(null);

  // cache-bust para la foto (cambia cuando subes foto)
  const [photoTs, setPhotoTs] = useState(() => Date.now());

  const apiBase = useMemo(() => {
    return (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
  }, []);

  // ORIGEN sin /api (para poder concatenar photo_url que ya viene como /api/...)
  const apiOrigin = useMemo(() => apiBase.replace(/\/api$/i, ""), [apiBase]);

  const userPhotoUrl = useMemo(() => {
    const u = userProfile || {};
    if (!u?.id) return "";

    // Preferir lo que manda el backend (evita /api/api y rutas mal armadas)
    if (u.photo_url) return `${apiOrigin}${u.photo_url}?ts=${photoTs}`;

    // Fallback (por si no viene photo_url)
    return `${apiBase}/users/${u.id}/photo?ts=${photoTs}`;
  }, [apiBase, apiOrigin, userProfile, photoTs]);

  const userDisplay = useMemo(() => {
    const u = userProfile || {};
    return u.email || u.username || "Usuario";
  }, [userProfile]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadIncidents(), loadProfile()]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const loadProfile = async () => {
    try {
      const res = await getMe();
      if (res?.success && res.user) {
        setUserProfile(res.user);
        localStorage.setItem("user", JSON.stringify(res.user));
        return;
      }
      const raw = localStorage.getItem("user");
      if (raw) setUserProfile(JSON.parse(raw));
      else setUserProfile({ email: "Usuario" });
    } catch (e) {
      console.error("Error loadProfile:", e);
      const raw = localStorage.getItem("user");
      if (raw) {
        try {
          setUserProfile(JSON.parse(raw));
        } catch {
          setUserProfile({ email: "Usuario" });
        }
      } else {
        setUserProfile({ email: "Usuario" });
      }
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
    } catch (e) {
      console.error("Error loadIncidents:", e);
      setIncidents([]);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  const filteredIncidents = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    return incidents.filter((i) => {
      if (!filters[i.type]) return false;
      if (!inTimeRange(i.timestamp, filters.timeRange)) return false;

      if (q) {
        const t = (i.title || "").toLowerCase();
        const d = (i.description || "").toLowerCase();
        const a = (i.address || "").toLowerCase();
        return t.includes(q) || d.includes(q) || a.includes(q);
      }
      return true;
    });
  }, [incidents, searchQuery, filters]);

  const stats = useMemo(() => {
    const base = { total: filteredIncidents.length, robbery: 0, accident: 0, emergency: 0, theft: 0, vandalism: 0 };
    for (const i of filteredIncidents) if (base[i.type] !== undefined) base[i.type] += 1;
    return base;
  }, [filteredIncidents]);

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
      setMapCenter([lat, lng]);
      await loadIncidents();
    } catch (e) {
      console.error(e);
      alert("Error al crear incidente");
    }
  };

  const focusIncident = (i) => {
    setMapCenter([i.lat, i.lng]);
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
    setSearchInput("");
    setSearchQuery("");
  };

  const handlePlaceSelect = ({ lat, lng, address }) => {
    setMapCenter([lat, lng]);
    if (address) setSearchInput(address);
  };

  // Se llama cuando AccountModal guarda
  const handleProfileUpdated = async () => {
    await loadProfile();
    setPhotoTs(Date.now()); // fuerza recarga de imagen
  };

  if (loading) return <div className="rc-loading">Cargando dashboard...</div>;

  return (
    <ErrorBoundary>
      <div className="rc-dashboard">
        <DashboardTopbar
          onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          onPlaceSelect={handlePlaceSelect}
          onOpenReport={() => setShowReportModal(true)}
          userDisplay={userDisplay}
          userPhotoUrl={userPhotoUrl}
          onOpenAccount={() => setShowAccount(true)}
          onLogout={handleLogout}
        />

        <div className="rc-body">
          <DashboardSidebar
            sidebarCollapsed={sidebarCollapsed}
            activePanel={activePanel}
            setActivePanel={setActivePanel}
            onLogout={handleLogout}
          />

          <DashboardPanel
            activePanel={activePanel}
            setActivePanel={setActivePanel}
            searchQuery={searchInput}
            setSearchQuery={setSearchInput}
            highlightQuery={searchQuery}
            onPlaceSelect={handlePlaceSelect}
            filteredIncidents={filteredIncidents}
            onFocusIncident={focusIncident}
            getTimeAgo={getTimeAgo}
            filters={filters}
            setFilters={setFilters}
            onResetFilters={resetFilters}
            stats={stats}
          />

          <main className="rc-main">
            <div className="rc-map-wrap">
              <IncidentMapGoogle
                center={mapCenter}
                incidents={filteredIncidents}
                mapMode={mapMode}
                onChangeMapMode={setMapMode}
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

export default Dashboard;
