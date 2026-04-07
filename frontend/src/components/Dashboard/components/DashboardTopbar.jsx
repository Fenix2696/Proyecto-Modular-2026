import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, LogOut, ChevronDown, Plus, Menu, X } from "lucide-react";
import PlacesSearch from "../PlacesSearch";

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
    <div className="rc-avatar rc-avatar--sm">
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
  menuButtonRef,
  onToggleSidebar,
  destinationInput,
  setDestinationInput,
  onDestinationSelect,
  onDestinationEnter,
  onClearDestination,
  onOpenReport,
  userProfile,
  photoTs,
  onOpenAccount,
  onLogout,
}) {
  const email = userProfile?.email || "Usuario";
  const nameForAvatar =
    userProfile?.name ||
    userProfile?.full_name ||
    userProfile?.username ||
    email;

  const photoUrl = useMemo(
    () => buildAbsolutePhotoUrl(userProfile, photoTs),
    [userProfile, photoTs]
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const handleClearSearch = () => {
    setDestinationInput?.("");
    onClearDestination?.();
  };

  return (
    <header className="rc-topbar rc-topbar--sticky">
      <div className="rc-topbar-left">
        <button
          ref={menuButtonRef}
          className="rc-icon-btn menu-button"
          onClick={onToggleSidebar}
          type="button"
        >
          <Menu size={18} />
        </button>

        <div className="rc-brand rc-brand--desktop">
          <div className="rc-logo">
            <div className="rc-logo-dot" />
          </div>
          <div className="rc-brand-title">Radar Ciudadano</div>
        </div>
      </div>

      <div className="rc-topbar-center">
        <div className="rc-search rc-search--places">
          <div className="rc-search-icon">
            <Search />
          </div>

          <div className="rc-search-field">
            <PlacesSearch
              value={destinationInput}
              onChange={setDestinationInput}
              onSelect={onDestinationSelect}
              onEnter={onDestinationEnter}
              dropdownVariant="topbar"
              enableRecentSearches={true}
            />
          </div>

          {!!destinationInput && (
            <button
              type="button"
              className="rc-search-clear-btn"
              onClick={handleClearSearch}
              title="Limpiar"
            >
              <X size={14} />
            </button>
          )}


          <button
            className="rc-search-enterbtn"
            type="button"
            onClick={() => onDestinationEnter?.(destinationInput)}
          >
            Enter
          </button>
        </div>
      </div>

      <div className="rc-topbar-right">
        <button
          className="rc-pill-btn rc-pill-btn--report"
          onClick={onOpenReport}
          type="button"
        >
          <Plus />
          <span className="rc-report-label">Reportar</span>
        </button>

        <div className="rc-account-menu rc-account-menu--desktop" ref={accountMenuRef}>
          <button
            className="rc-account-pill"
            onClick={() => setMenuOpen((v) => !v)}
            type="button"
          >
            <Avatar name={nameForAvatar} src={photoUrl} />

            <div className="rc-account-meta">
              <div className="rc-account-email">{email}</div>
              <div className="rc-account-sub">
                {(userProfile?.role || "user").toUpperCase()}
              </div>
            </div>

            <ChevronDown />
          </button>

          {menuOpen && (
            <div className="rc-menu-pop">
              <button
                className="rc-menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenAccount?.();
                }}
                type="button"
              >
                Mi perfil
              </button>

              <button
                className="rc-menu-item danger"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout?.();
                }}
                type="button"
              >
                <LogOut size={18} />
                Cerrar sesion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
