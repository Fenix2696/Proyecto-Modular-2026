import React, { useEffect, useMemo, useState } from "react";
import { Search, LogOut, ChevronDown, Plus, Menu } from "lucide-react";
import PlacesSearch from "../PlacesSearch";
 // ajusta si tu ruta difiere

function buildAbsolutePhotoUrl(user, photoTs) {
  const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "");
  const apiHost = apiBase.replace(/\/api$/i, "");

  const u = user || {};
  const id = u.id || u.user_id || u.userId;
  const raw = (u.photo_url || u.photo || u.avatar || "").trim();

  if (raw) {
    if (/^https?:\/\//i.test(raw)) return `${raw}${raw.includes("?") ? "&" : "?"}ts=${photoTs}`;
    if (raw.startsWith("/api/")) return `${apiHost}${raw}?ts=${photoTs}`;
    if (raw.startsWith("/")) return `${apiBase}${raw}?ts=${photoTs}`;
    return `${apiBase}/${raw}?ts=${photoTs}`;
  }

  if (id) return `${apiBase}/users/${id}/photo?ts=${photoTs}`;
  return "";
}

function Avatar({ name, src }) {
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => setImgOk(true), [src]);

  const initials = useMemo(() => {
    const base = (name || "U").trim();
    const parts = base.split(/[\s.@_+-]+/).filter(Boolean);
    const a = parts[0]?.[0] || "U";
    const b = parts[1]?.[0] || "";
    return (a + b).toUpperCase();
  }, [name]);

  return (
    <div className="rc-avatar rc-avatar--sm" aria-label="Avatar">
      {src && imgOk ? (
        <img src={src} alt="Foto" onError={() => setImgOk(false)} />
      ) : (
        <span className="rc-avatar-fallback">{initials}</span>
      )}
      <span className="rc-status-dot" />
    </div>
  );
}

export default function DashboardTopbar({
  onToggleSidebar,

  // search / directions
  destinationInput,
  setDestinationInput,
  onDestinationSelect,
  onDestinationEnter,

  onOpenReport,

  // user
  userProfile,
  photoTs,
  onOpenAccount,
  onLogout,
}) {
  const email = userProfile?.email || "Usuario";
  const nameForAvatar = userProfile?.name || userProfile?.full_name || userProfile?.username || email;

  // ✅ url absoluta para topbar
  const photoUrl = useMemo(() => buildAbsolutePhotoUrl(userProfile, photoTs), [userProfile, photoTs]);

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="rc-topbar rc-topbar--sticky">
      {/* LEFT */}
      <div className="rc-topbar-left">
        <button className="rc-icon-btn" onClick={onToggleSidebar} aria-label="Menu">
          <Menu size={18} />
        </button>

        <div className="rc-brand">
          <div className="rc-logo" aria-hidden="true">
            {/* pon tu logo si tienes */}
            <div className="rc-logo-dot" />
          </div>
          <div className="rc-brand-title">Radar Ciudadano</div>
        </div>
      </div>

      {/* CENTER */}
      <div className="rc-topbar-center">
        <div className="rc-search rc-search--places">
          <div className="rc-search-icon" aria-hidden="true">
            <Search />
          </div>

          <div className="rc-search-field">
            <PlacesSearch
              value={destinationInput}
              onChange={setDestinationInput}
              onSelect={onDestinationSelect}
              onEnter={onDestinationEnter}
            />
          </div>

          <button className="rc-search-enterbtn" onClick={() => onDestinationEnter?.(destinationInput)}>
            Enter
          </button>
        </div>
      </div>

      {/* RIGHT */}
      <div className="rc-topbar-right">
        <button className="rc-pill-btn rc-pill-btn--report" onClick={onOpenReport}>
          <span className="rc-pill-ico">
            <Plus />
          </span>
          <span className="rc-hide-sm">Reportar</span>
        </button>

        <div className="rc-account-menu">
          <button
            className="rc-account-pill"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Avatar name={nameForAvatar} src={photoUrl} />
            <div className="rc-account-meta rc-hide-sm">
              <div className="rc-account-email">{email}</div>
              <div className="rc-account-sub">{(userProfile?.role || "user").toUpperCase()}</div>
            </div>
            <span className="rc-caret" aria-hidden="true">
              <ChevronDown />
            </span>
          </button>

          {menuOpen && (
            <div className="rc-menu-pop" role="menu">
              <button className="rc-menu-item" onClick={() => { setMenuOpen(false); onOpenAccount?.(); }}>
                <span className="rc-mi-title">Mi perfil</span>
              </button>

              <div className="rc-menu-sep" />

              <button className="rc-menu-item danger" onClick={() => { setMenuOpen(false); onLogout?.(); }}>
                <LogOut size={18} />
                <div>
                  <div className="rc-mi-title">Cerrar sesion</div>
                  <div className="rc-mi-sub">Salir de tu cuenta</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
