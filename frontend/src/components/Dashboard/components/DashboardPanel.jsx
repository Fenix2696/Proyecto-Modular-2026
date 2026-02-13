import React, { useMemo } from "react";
import PlacesSearch from "../PlacesSearch";

import FiltersPanel from "../panels/FiltersPanel";
import DirectionsPanel from "../panels/DirectionsPanel";
import { TYPE_LABEL, TYPE_ICON } from "../utils/incidentTypes";

import mapAuto from "../../../assets/images/map-types/map-auto.png";
import mapSatellite from "../../../assets/images/map-types/map-satellite.png";
import mapDark from "../../../assets/images/map-types/map-dark.png";

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

  return parts.map((p, idx) =>
    re.test(p) ? (
      <mark
        key={idx}
        style={{
          background: "rgba(102,126,234,0.30)",
          color: "inherit",
          padding: "0 2px",
          borderRadius: 6,
        }}
      >
        {p}
      </mark>
    ) : (
      <span key={idx}>{p}</span>
    )
  );
}

export default function DashboardPanel({
  activePanel,
  setActivePanel,

  // Search
  searchQuery,
  setSearchQuery,
  highlightQuery,
  onPlaceSelect,
  filteredIncidents,
  onFocusIncident,
  getTimeAgo,

  // Filters
  filters,
  setFilters,
  onResetFilters,

  // Layers
  mapMode,
  setMapMode,

  // Stats
  stats,

  // Directions (YA venian desde Dashboard.jsx, solo faltaba usarlas)
  originLabel,
  originIsMyLocation,
  originValue,
  setOriginValue,
  onOriginSelect,
  onOriginEnter,

  destIsMyLocation,
  destValue,
  setDestValue,
  onDestSelect,
  onDestEnter,

  onSwap,

  directionsModeKey,
  setDirectionsModeKey,

  directionsRoutesInfo,
  directionsSelectedRouteIndex,
  setDirectionsSelectedRouteIndex,

  directionsIncidentsForSelectedRoute,
}) {
  if (activePanel === "none") return null;

  const topType = useMemo(() => {
    const entries = Object.keys(TYPE_LABEL).map((k) => [k, stats?.[k] || 0]);
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0]?.[0] || "robbery";
  }, [stats]);

  return (
    <section className="rc-panel">
      <div className="rc-panel-header">
        <div className="rc-panel-title">
          {activePanel === "search" && "Busqueda"}
          {activePanel === "filters" && "Filtros"}
          {activePanel === "stats" && "Estadisticas"}
          {activePanel === "layers" && "Capas"}
          {activePanel === "directions" && "Direcciones"}
        </div>

        <button
          className="rc-icon-btn"
          onClick={() => setActivePanel("none")}
          title="Cerrar"
          type="button"
        >
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

                  <div className="rc-card-desc">{highlightText(i.description || "", highlightQuery)}</div>

                  <div className="rc-card-meta">
                    <span>{TYPE_LABEL[i.type] || i.type}</span>
                    <span>•</span>
                    <span>{getTimeAgo(i.created_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* DIRECTIONS (ESTO ERA LO QUE FALTABA) */}
        {activePanel === "directions" && (
          <DirectionsPanel
            originLabel={originLabel}
            originIsMyLocation={originIsMyLocation}
            originValue={originValue}
            setOriginValue={setOriginValue}
            onOriginSelect={onOriginSelect}
            onOriginEnter={onOriginEnter}
            destIsMyLocation={destIsMyLocation}
            destValue={destValue}
            setDestValue={setDestValue}
            onDestSelect={onDestSelect}
            onDestEnter={onDestEnter}
            onSwap={onSwap}
            modeKey={directionsModeKey}
            setModeKey={setDirectionsModeKey}
            routesInfo={directionsRoutesInfo}
            selectedRouteIndex={directionsSelectedRouteIndex}
            setSelectedRouteIndex={setDirectionsSelectedRouteIndex}
            incidentsForSelectedRoute={directionsIncidentsForSelectedRoute}
          />
        )}

        {/* FILTERS */}
        {activePanel === "filters" && (
          <FiltersPanel filters={filters} setFilters={setFilters} onReset={onResetFilters} />
        )}

        {/* LAYERS */}
        {activePanel === "layers" && (
          <>
            <div className="rc-field">
              <label>Estilo del mapa</label>

              <div className="rc-mapmode-grid">
                <button type="button" className={`rc-mapmode-card ${mapMode === "auto" ? "active" : ""}`} onClick={() => setMapMode("auto")}>
                  <img src={mapAuto} alt="Auto" />
                  <span>Auto</span>
                </button>

                <button type="button" className={`rc-mapmode-card ${mapMode === "satellite" ? "active" : ""}`} onClick={() => setMapMode("satellite")}>
                  <img src={mapSatellite} alt="Satellite" />
                  <span>Satelite</span>
                </button>

                <button type="button" className={`rc-mapmode-card ${mapMode === "dark" ? "active" : ""}`} onClick={() => setMapMode("dark")}>
                  <img src={mapDark} alt="Dark" />
                  <span>Dark</span>
                </button>
              </div>

              <div className="rc-help">Se guarda automaticamente en tu navegador.</div>
            </div>

            <div className="rc-layer-hints">
              <div className="rc-layer-hint">
                <b>Heatmap</b>
                <span>Usa el boton 🔥 dentro del mapa para activar/desactivar.</span>
              </div>
              <div className="rc-layer-hint">
                <b>Mas capas</b>
                <span>Proximo: trafico, zonas y filtros por densidad.</span>
              </div>
            </div>
          </>
        )}

        {/* STATS */}
        {activePanel === "stats" && (
          <>
            <div className="rc-stats-hero">
              <div className="rc-stats-hero-left">
                <div className="rc-stats-hero-title">Resumen</div>
                <div className="rc-stats-hero-sub">Tipo con mas reportes: {TYPE_LABEL[topType]}</div>
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
