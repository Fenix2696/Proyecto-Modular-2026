import React, { useMemo } from "react";
import {
  X,
  CarFront,
  Bike,
  PersonStanding,
  BusFront,
  TramFront,
  ArrowUpDown,
  AlertTriangle,
  Route,
  MapPin,
} from "lucide-react";
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

export default function DirectionsDrawer({
  open,
  onClose,

  // inputs
  originLabel = "Tu ubicacion",
  destinationValue,
  setDestinationValue,
  onDestinationSelect,
  onSwap,

  // mode
  modeKey,
  setModeKey,

  // results
  routesInfo = [],
  selectedRouteIndex = 0,
  setSelectedRouteIndex,

  // incidents list for selected route
  incidentsForSelectedRoute = [],
}) {
  const modeMeta = useMemo(() => {
    const m = MODES.find((x) => x.key === modeKey);
    return m || MODES[0];
  }, [modeKey]);

  if (!open) return null;

  return (
    <div className="rc-dir-overlay" role="dialog" aria-label="Direcciones">
      <div className="rc-dir-drawer">
        <div className="rc-dir-head">
          <div className="rc-dir-title">
            <Route size={18} />
            <span>Direcciones</span>
          </div>
          <button className="rc-dir-close" onClick={onClose} type="button" title="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Inputs */}
        <div className="rc-dir-box">
          <div className="rc-dir-inputs">
            <div className="rc-dir-lefticons" aria-hidden="true">
              <div className="rc-dir-dot" />
              <div className="rc-dir-line" />
              <MapPin size={18} className="rc-dir-pin" />
            </div>

            <div className="rc-dir-fields">
              <input className="rc-dir-field" value={originLabel} readOnly />
              <div className="rc-dir-dest">
                <PlacesSearch
                  value={destinationValue}
                  onValueChange={setDestinationValue}
                  onSelect={onDestinationSelect}
                  placeholder="A donde vas?"
                  inputClassName="rc-dir-field rc-dir-field--dest"
                  showHelp={false}
                />
              </div>
            </div>

            <button
              className="rc-dir-swap"
              type="button"
              onClick={onSwap}
              title="Intercambiar origen/destino"
              aria-label="Intercambiar"
            >
              <ArrowUpDown size={18} />
            </button>
          </div>

          {/* Mode tabs */}
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

        {/* Routes */}
        <div className="rc-dir-section">
          <div className="rc-dir-subtitle">
            <span>Rutas</span>
            <span className="rc-dir-pill">
              {modeMeta?.label}
            </span>
          </div>

          <div className="rc-dir-routes">
            {routesInfo.length === 0 ? (
              <div className="rc-dir-empty">Selecciona un destino para calcular rutas.</div>
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
                      {r.summary ? <span>{r.summary}</span> : <span>Ruta alternativa</span>}
                      {r.note ? <span className="rc-dir-note">{r.note}</span> : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Incidents list */}
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
                  {modeKey === "TRANSIT" || modeKey === "RAIL" ? (
                    <div className="rc-dir-warn">
                      Toma precauciones en la zona. Ruta de transporte pasa cerca de reportes.
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rc-dir-foot">
          <div className="rc-dir-foot-left">
            <span className="rc-dir-muted">
              Tip: La “mejor” ruta se elige por tiempo (con trafico) + menos accidentes cerca.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
