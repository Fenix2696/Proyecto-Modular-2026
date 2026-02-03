import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Search, UserRound, LogOut, ChevronDown, Plus } from "lucide-react";
import PlacesSearch from "../PlacesSearch";

function getBackendOrigin() {
  // VITE_API_URL esperado: "http://localhost:5000/api"
  const apiBase = (import.meta?.env?.VITE_API_URL || "").trim();
  if (!apiBase) return "";
  try {
    return new URL(apiBase).origin; // "http://localhost:5000"
  } catch {
    // fallback por si viene raro
    return apiBase.replace(/\/+$/, "").replace(/\/api$/i, "");
  }
}

function resolvePhotoUrl(src) {
  const u = (src || "").trim();
  if (!u) return "";

  // absoluta / data
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("data:image/")) return u;

  const origin = getBackendOrigin();

  // si viene "/api/users/1/photo" => "http://localhost:5000/api/users/1/photo"
  if (origin && u.startsWith("/")) return `${origin}${u}`;

  // fallback
  if (origin) return `${origin}/${u}`;
  return u;
}

function Avatar({ name, src }) {
  const [imgOk, setImgOk] = useState(true);

  const finalSrc = useMemo(() => resolvePhotoUrl(src), [src]);

  useEffect(() => {
    setImgOk(true);
  }, [finalSrc]);

  const initials = useMemo(() => {
    const base = (name || "U").trim();
    const parts = base.split(/[\s.@_+-]+/).filter(Boolean);
    const a = parts[0]?.[0] || "U";
    const b = parts[1]?.[0] || "";
    return (a + b).toUpperCase();
  }, [name]);

  return (
    <div className="rc-avatar rc-avatar--sm">
      {finalSrc && imgOk ? (
        <img
          key={finalSrc} // fuerza remount cuando cambia
          src={finalSrc}
          alt="Foto"
          onError={() => setImgOk(false)}
        />
      ) : (
        <span className="rc-avatar-fallback">{initials}</span>
      )}
      <span className="rc-status-dot" title="Activo" />
    </div>
  );
}

export default function DashboardTopbar({
  onToggleSidebar,
  searchInput,
  setSearchInput,

  // Direcciones (autocomplete)
  onPlaceSelect,

  // busqueda de incidentes por texto (Enter)
  onSearchIncidents,

  onOpenReport,

  userDisplay,
  userPhotoUrl,

  onOpenAccount,
  onLogout,
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const lastPlaceSelectAtRef = useRef(0);

  useEffect(() => {
    const onDoc = (e) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const runSearch = useCallback(() => {
    const q = (searchInput || "").trim();
    if (!q) return;
    if (typeof onSearchIncidents === "function") onSearchIncidents(q);
  }, [searchInput, onSearchIncidents]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key !== "Enter") return;

      const delta = Date.now() - (lastPlaceSelectAtRef.current || 0);
      if (delta < 400) return;

      e.preventDefault();
      runSearch();
    },
    [runSearch]
  );

  return (
    <header className="rc-topbar rc-topbar--sticky">
      <div className="rc-topbar-left">
        <button className="rc-icon-btn" onClick={onToggleSidebar} title="Menu" type="button">
          ☰
        </button>

        <div className="rc-brand rc-brand--clean" title="Radar Ciudadano">
          <div className="rc-logo" aria-hidden="true">
            <RadarLogo />
          </div>
          <div className="rc-brand-text">
            <div className="rc-brand-title">Radar Ciudadano</div>
          </div>
        </div>
      </div>

      <div className="rc-topbar-center">
        <div className="rc-search rc-search--places" role="search">
          <span className="rc-search-icon" aria-hidden="true">
            <Search size={18} />
          </span>

          <div className="rc-search-field" onKeyDown={handleKeyDown}>
            <PlacesSearch
              value={searchInput}
              onValueChange={setSearchInput}
              onSelect={(place) => {
                lastPlaceSelectAtRef.current = Date.now();
                onPlaceSelect?.(place);
              }}
              placeholder="Buscar reportes o direcciones..."
              inputClassName="rc-search-input rc-search-input--places"
              showHelp={false}
            />
          </div>

          <button type="button" className="rc-search-enterbtn" onClick={runSearch} title="Buscar incidentes (Enter)">
            Enter
          </button>
        </div>
      </div>

      <div className="rc-topbar-right">
        <button className="rc-pill-btn rc-pill-btn--report" onClick={onOpenReport} type="button" title="Crear reporte">
          <span className="rc-pill-ico" aria-hidden="true">
            <Plus size={18} />
          </span>
          <span className="rc-hide-sm">Reportar</span>
        </button>

        <div className="rc-account-menu" ref={menuRef}>
          <button
            className={`rc-account-pill ${open ? "open" : ""}`}
            type="button"
            onClick={() => setOpen((v) => !v)}
            title="Cuenta"
          >
            <Avatar name={userDisplay} src={userPhotoUrl} />

            <div className="rc-account-meta rc-hide-sm">
              <div className="rc-account-email">{userDisplay || "Usuario"}</div>
              <div className="rc-account-sub">
                <span className="rc-sub-dot" aria-hidden="true" />
                Activo
              </div>
            </div>

            <span className="rc-caret" aria-hidden="true">
              <ChevronDown size={16} />
            </span>
          </button>

          {open && (
            <div className="rc-menu-pop" role="menu" aria-label="Menu cuenta">
              <button
                className="rc-menu-item"
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onOpenAccount?.();
                }}
              >
                <span className="rc-mi-ico" aria-hidden="true">
                  <UserRound size={18} />
                </span>
                <div className="rc-mi-text">
                  <div className="rc-mi-title">Perfil</div>
                  <div className="rc-mi-sub">Editar datos y foto</div>
                </div>
              </button>

              <div className="rc-menu-sep" />

              <button
                className="rc-menu-item danger"
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onLogout?.();
                }}
              >
                <span className="rc-mi-ico danger" aria-hidden="true">
                  <LogOut size={18} />
                </span>
                <div className="rc-mi-text">
                  <div className="rc-mi-title">Salir</div>
                  <div className="rc-mi-sub">Cerrar sesion</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function RadarLogo() {
  return (
    <svg width="34" height="34" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="g" x1="12" y1="10" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#667eea" />
          <stop offset="1" stopColor="#764ba2" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="48" height="48" rx="16" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" />
      <circle cx="32" cy="32" r="16" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
      <circle cx="32" cy="32" r="10" stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
      <path d="M32 32 L32 14 A18 18 0 0 1 50 32 Z" fill="url(#g)" opacity="0.55" />
      <circle cx="44" cy="24" r="3.8" fill="url(#g)" />
      <circle cx="32" cy="32" r="2.8" fill="rgba(255,255,255,0.92)" />
    </svg>
  );
}
