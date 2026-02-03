import React, { useMemo } from "react";
import PlacesSearch from "../PlacesSearch";

import FiltersPanel from "../panels/FiltersPanel";
import { TYPE_LABEL, TYPE_ICON } from "../utils/incidentTypes";

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text, query) {
  if (!text) return null;

  const q = (query || "").trim();
  if (!q) return text;

  const safe = escapeRegExp(q);
  const re = new RegExp(`(${safe})`, "ig");
  const parts = String(text).split(re);

  return parts.map((p, idx) => {
    const isMatch = p.toLowerCase() === q.toLowerCase();
    return isMatch ? (
      <mark key={idx} className="rc-hl">
        {p}
      </mark>
    ) : (
      <span key={idx}>{p}</span>
    );
  });
}

export default function DashboardPanel({
  activePanel,
  setActivePanel,

  // Search
  searchQuery,
  setSearchQuery,
  highlightQuery, // ✅ NUEVO (debounced)
  onPlaceSelect,
  filteredIncidents,
  onFocusIncident,
  getTimeAgo,

  // Filters
  filters,
  setFilters,
  onResetFilters,

  // Stats
  stats,
}) {
  if (activePanel === "none") return null;

  const topType = useMemo(() => {
    const entries = Object.keys(TYPE_LABEL).map((k) => [k, stats[k] || 0]);
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0]?.[0] || "robbery";
  }, [stats]);

  return (
    <section className="rc-panel">
      <div className="rc-panel-header">
        <div className="rc-panel-title">
          {activePanel === "search" && "Búsqueda"}
          {activePanel === "filters" && "Filtros"}
          {activePanel === "stats" && "Estadísticas"}
        </div>
        <button className="rc-icon-btn" onClick={() => setActivePanel("none")} title="Cerrar" type="button">
          ✕
        </button>
      </div>

      <div className="rc-panel-body">
        {/* SEARCH */}
        {activePanel === "search" && (
          <>
            <div className="rc-field">
              <label>Buscar en el mapa (Google Places)</label>
              <PlacesSearch onSelect={({ lat, lng, address }) => onPlaceSelect({ lat, lng, address })} />
            </div>

            <div className="rc-field">
              <label>Buscar en reportes</label>
              <input
                className="rc-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ej: asalto, choque, avenida..."
              />
              <div className="rc-help">
                Resultados: <b>{filteredIncidents.length}</b>
              </div>
            </div>

            <div className="rc-list">
              {filteredIncidents.slice(0, 25).map((i) => (
                <button key={i.id} className="rc-card" onClick={() => onFocusIncident(i)} type="button">
                  <div className="rc-card-row">
                    <div className="rc-badge" />
                    <div className="rc-card-title">
                      {highlightText(i.title || TYPE_LABEL[i.type] || "Incidente", highlightQuery)}
                    </div>
                  </div>

                  <div className="rc-card-desc">
                    {highlightText(i.description || "", highlightQuery)}
                  </div>

                  <div className="rc-card-meta">
                    <span>⏰ {getTimeAgo(i.timestamp)}</span>
                    <span>
                      📍 {Number(i.lat).toFixed(4)}, {Number(i.lng).toFixed(4)}
                    </span>
                  </div>

                  {i.address ? (
                    <div className="rc-help" style={{ marginTop: 8 }}>
                      📌 {highlightText(i.address, highlightQuery)}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </>
        )}

        {/* FILTERS (nuevo componente + nuevo css) */}
        {activePanel === "filters" && (
          <FiltersPanel filters={filters} setFilters={setFilters} onResetFilters={onResetFilters} />
        )}

        {/* STATS PRO */}
        {activePanel === "stats" && (
          <>
            <div className="rc-stats-hero">
              <div className="rc-stats-hero-left">
                <div className="rc-stats-hero-title">Resumen</div>
                <div className="rc-stats-hero-sub">
                  Tipo más frecuente: <b>{TYPE_LABEL[topType]}</b> {TYPE_ICON[topType]}
                </div>
              </div>

              <div className="rc-stats-hero-right">
                <div className="rc-stats-total">{stats.total}</div>
                <div className="rc-stats-total-label">Reportes visibles</div>
              </div>
            </div>

            <div className="rc-stats-grid">
              {Object.keys(TYPE_LABEL).map((t) => {
                const value = stats[t] || 0;
                const pct = stats.total > 0 ? Math.round((value / stats.total) * 100) : 0;

                return (
                  <div key={t} className="rc-stat-card">
                    <div className="rc-stat-card-top">
                      <div className="rc-stat-card-icon">{TYPE_ICON[t]}</div>
                      <div className="rc-stat-card-meta">
                        <div className="rc-stat-card-label">{TYPE_LABEL[t]}</div>
                        <div className="rc-stat-card-sub">{pct}% del total</div>
                      </div>
                      <div className="rc-stat-card-value">{value}</div>
                    </div>

                    <div className="rc-stat-bar">
                      <div className="rc-stat-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <button className="rc-secondary-btn" onClick={() => setActivePanel("filters")} type="button">
              Ajustar filtros →
            </button>
          </>
        )}
      </div>
    </section>
  );
}
