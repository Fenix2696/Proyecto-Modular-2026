import React from "react";
import { ArrowUpDown, CarFront, Bike, PersonStanding, BusFront, TramFront, AlertTriangle, Route, MapPin } from "lucide-react";
import PlacesSearch from "../PlacesSearch";

const MODES = [
  { key: "DRIVING", label: "Carro", Icon: CarFront },
  { key: "MOTO", label: "Moto", Icon: CarFront },
  { key: "TRANSIT", label: "Transporte", Icon: BusFront },
  { key: "RAIL", label: "Tren", Icon: TramFront },
  { key: "BICYCLING", label: "Bici", Icon: Bike },
  { key: "WALKING", label: "A pie", Icon: PersonStanding },
];

function fmtDuration(sec) {
  if (!Number.isFinite(sec)) return "";
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h} h ${rm} min`;
}

function fmtKm(meters) {
  if (!Number.isFinite(meters)) return "";
  const km = meters / 1000;
  return `${km.toFixed(1).replace(".", ",")} km`;
}

export default function DirectionsPanel({
  originLabel = "Tu ubicacion",

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

  modeKey,
  setModeKey,

  routesInfo = [],
  selectedRouteIndex = 0,
  setSelectedRouteIndex,

  incidentsForSelectedRoute = [],
}) {
  return (
    <div className="rc-dir-panel">
      <div className="rc-dir-box">
        <div className="rc-dir-panel-title">
          <Route size={18} />
          <span>Direcciones</span>
        </div>

        <div className="rc-dir-inputs">
          <div className="rc-dir-lefticons" aria-hidden="true">
            <div className="rc-dir-dot" />
            <div className="rc-dir-line" />
            <MapPin size={18} className="rc-dir-pin" />
          </div>

          <div className="rc-dir-fields">
            {/* ORIGEN */}
            {originIsMyLocation ? (
              <input className="rc-dir-field" value={originLabel} readOnly />
            ) : (
              <PlacesSearch
                value={originValue}
                onChange={setOriginValue}
                onSelect={onOriginSelect}
                onEnter={onOriginEnter}
                dropdownVariant="panel"
                enableRecentSearches={false}
              />
            )}

            {/* DESTINO */}
            {destIsMyLocation ? (
              <input className="rc-dir-field" value={originLabel} readOnly />
            ) : (
              <PlacesSearch
                value={destValue}
                onChange={setDestValue}
                onSelect={onDestSelect}
                onEnter={onDestEnter}
                dropdownVariant="panel"
                enableRecentSearches={false}
              />
            )}
          </div>

          <button className="rc-dir-swap" type="button" onClick={onSwap} title="Intercambiar origen/destino">
            <ArrowUpDown size={18} />
          </button>
        </div>

        <div className="rc-dir-modes" role="tablist" aria-label="Modo de viaje">
          {MODES.map(({ key, label, Icon }) => {
            const active = key === modeKey;
            return (
              <button
                key={key}
                type="button"
                className={`rc-dir-mode ${active ? "active" : ""}`}
                onClick={() => setModeKey(key)}
                role="tab"
                aria-selected={active}
                title={label}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rc-dir-section">
        <div className="rc-dir-subtitle">
          <span>Rutas</span>
        </div>

        <div className="rc-dir-routes">
          {routesInfo.length === 0 ? (
            <div className="rc-dir-empty">Define origen y destino para calcular ruta.</div>
          ) : (
            routesInfo.map((r, idx) => {
              const active = idx === selectedRouteIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  className={`rc-dir-route ${active ? "active" : ""}`}
                  onClick={() => setSelectedRouteIndex(idx)}
                >
                  <div className="rc-dir-route-top">
                    <div className="rc-dir-route-main">
                      <span className="rc-dir-time">{fmtDuration(r.durationSec)}</span>
                      <span className="rc-dir-dist">{fmtKm(r.distanceMeters)}</span>
                    </div>
                    <div className="rc-dir-risk">
                      <AlertTriangle size={16} />
                      <span>{r.incidentsCount} incidentes</span>
                    </div>
                  </div>
                  <div className="rc-dir-route-sub">
                    <span>{r.summary ? r.summary : "Ruta alternativa"}</span>
                    {r.note ? <span className="rc-dir-note">{r.note}</span> : <span />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="rc-dir-section">
        <div className="rc-dir-subtitle">
          <span>Incidentes en la ruta</span>
          <span className="rc-dir-pill rc-dir-pill--soft">{incidentsForSelectedRoute.length}</span>
        </div>

        {incidentsForSelectedRoute.length === 0 ? (
          <div className="rc-dir-empty">No se detectaron incidentes cerca de esta ruta.</div>
        ) : (
          <div className="rc-dir-incidents">
            {incidentsForSelectedRoute.map((it) => (
              <div key={it.id} className="rc-dir-incident">
                <div className="rc-dir-incident-top">
                  <span className={`rc-dir-badge t-${it.type}`}>{it.type}</span>
                  <span className="rc-dir-near">{Math.round(it.distanceToRouteM)} m</span>
                </div>
                <div className="rc-dir-incident-desc">{it.description || "Incidente"}</div>
                {it.address ? <div className="rc-dir-incident-addr">{it.address}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
