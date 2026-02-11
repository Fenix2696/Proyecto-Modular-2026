import React from "react";
import PlacesSearch from "../PlacesSearch";
import FiltersPanel from "../panels/FiltersPanel";
import DirectionsPanel from "../panels/DirectionsPanel";

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

  // Stats
  stats,

  // ✅ Directions (swap real)
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

  return (
    <section className="rc-panel">
      <div className="rc-panel-header">
        <div className="rc-panel-title">
          {activePanel === "search" && "Búsqueda"}
          {activePanel === "filters" && "Filtros"}
          {activePanel === "stats" && "Estadísticas"}
          {activePanel === "directions" && "Direcciones"}
        </div>

        <button className="rc-icon-btn" onClick={() => setActivePanel("none")} title="Cerrar" type="button">
          ✕
        </button>
      </div>

      <div className="rc-panel-body">
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

        {activePanel === "filters" && <FiltersPanel filters={filters} setFilters={setFilters} onResetFilters={onResetFilters} />}

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
                  <div className="rc-card-title">{i.title || "Incidente"}</div>
                  <div className="rc-card-desc">{i.description || ""}</div>
                  <div className="rc-card-meta">
                    <span>⏰ {getTimeAgo(i.timestamp)}</span>
                    <span>
                      📍 {Number(i.lat).toFixed(4)}, {Number(i.lng).toFixed(4)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {activePanel === "stats" && (
          <div className="rc-help">
            Total visibles: <b>{stats.total}</b>
          </div>
        )}
      </div>
    </section>
  );
}
