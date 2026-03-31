import React, { useMemo } from "react";
import {
  SlidersHorizontal,
  BarChart3,
  Power,
  Route,
  Newspaper,
  UserCircle2,
} from "lucide-react";

function buildAbsolutePhotoUrl(user, photoTs) {
  const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api")
    .trim()
    .replace(/\/+$/, "");
  const apiHost = apiBase.replace(/\/api$/i, "");

  const u = user || {};
  const id = u.id || u.user_id || u.userId;
  const raw = (u.photo_url || u.photo || u.avatar || "").trim();

  if (raw) {
    if (/^https?:\/\//i.test(raw)) {
      return `${raw}${raw.includes("?") ? "&" : "?"}ts=${photoTs}`;
    }
    if (raw.startsWith("/api/")) return `${apiHost}${raw}?ts=${photoTs}`;
    if (raw.startsWith("/")) return `${apiBase}${raw}?ts=${photoTs}`;
    return `${apiBase}/${raw}?ts=${photoTs}`;
  }

  if (id) return `${apiBase}/users/${id}/photo?ts=${photoTs}`;
  return "";
}

function SidebarAvatar({ name, src }) {
  const initials = useMemo(() => {
    const base = (name || "U").trim();
    const parts = base.split(/[\s.@_+-]+/).filter(Boolean);
    const a = parts[0]?.[0] || "U";
    const b = parts[1]?.[0] || "";
    return (a + b).toUpperCase();
  }, [name]);

  return (
    <div className="rc-sidebar-account-avatar">
      {src ? <img src={src} alt="Foto" /> : <span>{initials}</span>}
    </div>
  );
}

export default function DashboardSidebar({
  sidebarRef,
  sidebarCollapsed,
  collapsed,
  activePanel,
  setActivePanel,
  onLogout,
  userProfile,
  photoTs,
  onOpenAccount,
}) {
  const isCollapsed = typeof sidebarCollapsed === "boolean"
    ? sidebarCollapsed
    : !!collapsed;

  const items = [
    { key: "news", label: "Noticias", Icon: Newspaper, title: "Noticias IA" },
    { key: "directions", label: "Direcciones", Icon: Route, title: "Direcciones" },
    { key: "filters", label: "Filtros", Icon: SlidersHorizontal, title: "Filtros" },
    { key: "stats", label: "Estadisticas", Icon: BarChart3, title: "Estadisticas" },
  ];

  const handleClick = (key) => {
    setActivePanel((prev) => (prev === key ? "none" : key));
  };

  const name =
    userProfile?.name ||
    userProfile?.full_name ||
    userProfile?.username ||
    userProfile?.email ||
    "Usuario";

  const email = userProfile?.email || "";
  const photoUrl = buildAbsolutePhotoUrl(userProfile, photoTs);

  return (
    <aside
      ref={sidebarRef}
      className={`rc-sidebar ${isCollapsed ? "collapsed" : ""}`}
    >
      <div className="rc-sidebar-header">
        <div className="rc-sidebar-title">{isCollapsed ? "RC" : "Menu"}</div>
      </div>

      <nav className="rc-sidebar-nav" aria-label="Navegacion">
        {items.map(({ key, label, Icon, title }) => {
          const active = activePanel === key;

          return (
            <button
              key={key}
              className={`rc-side-item ${active ? "active" : ""}`}
              onClick={() => handleClick(key)}
              title={title}
              type="button"
            >
              <span className="rc-side-ico" aria-hidden="true">
                <Icon size={18} />
              </span>

              <span className="rc-side-label">{label}</span>

              {isCollapsed && <span className="rc-side-tooltip">{label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="rc-sidebar-spacer" />

      <div className="rc-sidebar-footer">
        <button
          type="button"
          className="rc-sidebar-account-btn"
          onClick={onOpenAccount}
          title="Mi perfil"
        >
          <SidebarAvatar name={name} src={photoUrl} />
          <div className="rc-sidebar-account-meta">
            <div className="rc-sidebar-account-name">{name}</div>
            <div className="rc-sidebar-account-email">{email}</div>
          </div>
          <UserCircle2 size={18} />
        </button>

        <button
          className="rc-side-item danger"
          onClick={onLogout}
          title="Cerrar sesion"
          type="button"
        >
          <span className="rc-side-ico" aria-hidden="true">
            <Power size={18} />
          </span>
          <span className="rc-side-label">Salir</span>
          {isCollapsed && <span className="rc-side-tooltip">Salir</span>}
        </button>
      </div>
    </aside>
  );
}