import React, { useCallback, useEffect, useMemo, useState } from "react";

import FiltersPanel from "../panels/FiltersPanel";
import DirectionsPanel from "../panels/DirectionsPanel";
import { TYPE_LABEL, TYPE_ICON } from "../utils/incidentTypes";
import { syncAIReports } from "../../../services/aiReports";

function safeTimeAgo(getTimeAgo, value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return getTimeAgo(date);
}

function getNewsTimestamp(item) {
  const candidates = [
    item?.published_at,
    item?.publishedAt,
    item?.date,
    item?.created_at,
    item?.createdAt,
    item?.updated_at,
    item?.updatedAt,
  ];

  for (const value of candidates) {
    if (!value) continue;
    const date = value instanceof Date ? value : new Date(value);
    const time = date.getTime();
    if (!Number.isNaN(time)) return time;
  }

  return 0;
}

function categoryMeta(category) {
  const c = String(category || "").toLowerCase();

  switch (c) {
    case "asalto":
      return { label: "Asalto", emoji: "🚨", color: "#ff6b6b" };
    case "robo":
      return { label: "Robo", emoji: "🔓", color: "#f59e0b" };
    case "cristalazo":
      return { label: "Cristalazo", emoji: "🪟", color: "#fb7185" };
    case "choque":
      return { label: "Choque", emoji: "🚗", color: "#60a5fa" };
    case "violencia":
      return { label: "Violencia", emoji: "⚠️", color: "#ef4444" };
    case "emergencia":
      return { label: "Emergencia", emoji: "🚒", color: "#10b981" };
    case "delito":
      return { label: "Delito", emoji: "🚔", color: "#a78bfa" };
    case "vandalismo":
      return { label: "Vandalismo", emoji: "🏚️", color: "#94a3b8" };
    default:
      return { label: category || "Otro", emoji: "📍", color: "#64748b" };
  }
}

function sourceMeta(sourceName) {
  const s = String(sourceName || "").toLowerCase();

  if (s.includes("guardia nocturna")) {
    return { label: "Guardia Nocturna", color: "#22c55e" };
  }


  return { label: sourceName || "Fuente", color: "#64748b" };
}

function mapAiCategoryToType(category) {
  const c = String(category || "").toLowerCase();

  if (c === "asalto" || c === "robo") return "robbery";
  if (c === "choque") return "accident";
  if (c === "emergencia" || c === "violencia") return "emergency";
  if (c === "cristalazo" || c === "delito") return "theft";
  if (c === "vandalismo") return "vandalism";

  return "theft";
}

export default function DashboardPanel({
  activePanel,
  setActivePanel,

  filters,
  setFilters,
  onResetFilters,

  stats,

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

  hasDirectionsRoute = false,
  isNavigationActive = false,
  navigationCurrentStep = null,
  onStopNavigation,
  onClearDirections,
  getTimeAgo,
  onStartRouteAndFocusMap,

  aiReports = [],
  onReloadAIReports,
}) {
  const [loadingAI, setLoadingAI] = useState(false);
  const [syncingAI, setSyncingAI] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiMessage, setAiMessage] = useState("");

  const loadAIReports = useCallback(async (limit = 50) => {
    try {
      setLoadingAI(true);
      setAiError("");

      if (typeof onReloadAIReports === "function") {
        await onReloadAIReports(limit);
      }
    } catch (error) {
      console.error("Error cargando noticias IA:", error);
      setAiError("No se pudieron cargar las noticias de IA.");
    } finally {
      setLoadingAI(false);
    }
  }, [onReloadAIReports]);

  const handleSyncAI = async (force = false) => {
    try {
      setSyncingAI(true);
      setAiError("");
      setAiMessage("");

      const response = await syncAIReports(force);

      if (response?.usedCache) {
        setAiMessage(
          `Usando cache local. Reportes activos: ${response?.cachedCount ?? 0}. ${response?.reason || ""}`.trim()
        );
      } else {
        setAiMessage(
          [
            `Sync completado.`,
            `Insertados: ${response?.inserted ?? 0}`,
            `Actualizados: ${response?.updated ?? 0}`,
            `Geocodificados: ${response?.geocoded ?? 0}`,
            `Fallback: ${response?.fallbackLocated ?? 0}`,
            `Sin coords: ${response?.withoutCoords ?? 0}`,
          ].join(" ")
        );
      }

      await loadAIReports(50);
    } catch (error) {
      console.error("Error sincronizando noticias IA:", error);
      setAiError("No se pudieron sincronizar las noticias.");
    } finally {
      setSyncingAI(false);
    }
  };

  useEffect(() => {
    if (activePanel !== "news" && activePanel !== "stats") return;
    loadAIReports(50);
  }, [activePanel, loadAIReports]);

  const sortedAIReports = useMemo(() => {
    return [...aiReports].sort((a, b) => getNewsTimestamp(b) - getNewsTimestamp(a));
  }, [aiReports]);

  const aiStats = useMemo(() => {
    const base = {
      total: 0,
      robbery: 0,
      accident: 0,
      emergency: 0,
      theft: 0,
      vandalism: 0,
    };

    for (const report of aiReports) {
      const type = mapAiCategoryToType(report?.category);
      base.total += 1;
      base[type] = (base[type] || 0) + 1;
    }

    return base;
  }, [aiReports]);

  const mergedStats = useMemo(() => {
    const safeStats = stats || {};
    return {
      total: Number(safeStats.total || 0) + aiStats.total,
      robbery: Number(safeStats.robbery || 0) + aiStats.robbery,
      accident: Number(safeStats.accident || 0) + aiStats.accident,
      emergency: Number(safeStats.emergency || 0) + aiStats.emergency,
      theft: Number(safeStats.theft || 0) + aiStats.theft,
      vandalism: Number(safeStats.vandalism || 0) + aiStats.vandalism,
    };
  }, [stats, aiStats]);

  const topType = useMemo(() => {
    const entries = Object.keys(TYPE_LABEL).map((k) => [k, mergedStats?.[k] || 0]);
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0]?.[0] || "robbery";
  }, [mergedStats]);

  if (activePanel === "none") return null;

  return (
    <section className="rc-panel">
      <div className="rc-panel-header">
        <div className="rc-panel-title">
          {activePanel === "news" && "Noticias IA"}
          {activePanel === "filters" && "Filtros"}
          {activePanel === "stats" && "Estadisticas"}
          {activePanel === "directions" && "Direcciones"}
        </div>

        <button
          className="rc-icon-btn"
          onClick={() => setActivePanel("none")}
          title="Volver"
          type="button"
        >
          ←
        </button>
      </div>

      <div className="rc-panel-body">
        {activePanel === "news" && (
          <>
            <div className="rc-field">
              <label>Noticias y reportes automaticos</label>
              <div className="rc-help">
                Reportes obtenidos desde fuentes externas y clasificados automaticamente.
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button
                  className="rc-secondary-btn"
                  type="button"
                  onClick={() => handleSyncAI(false)}
                  disabled={syncingAI}
                >
                  {syncingAI ? "Sincronizando..." : "Actualizar noticias"}
                </button>
              </div>
            </div>

            {aiMessage && (
              <div
                className="rc-help"
                style={{
                  color: "#93c5fd",
                  background: "rgba(59,130,246,0.10)",
                  padding: "10px 12px",
                  borderRadius: 12,
                  marginBottom: 12,
                }}
              >
                {aiMessage}
              </div>
            )}

            {aiError && (
              <div
                className="rc-help"
                style={{
                  color: "#ff6b6b",
                  background: "rgba(239,68,68,0.10)",
                  padding: "10px 12px",
                  borderRadius: 12,
                  marginBottom: 12,
                }}
              >
                {aiError}
              </div>
            )}

            {loadingAI ? (
              <div className="rc-help">Cargando noticias...</div>
            ) : sortedAIReports.length === 0 ? (
              <div className="rc-help">No hay reportes automaticos disponibles.</div>
            ) : (
              <div className="rc-list">
                {sortedAIReports.map((n) => {
                  const timeAgo = safeTimeAgo(
                    getTimeAgo,
                    n.published_at ||
                      n.publishedAt ||
                      n.date ||
                      n.created_at ||
                      n.createdAt ||
                      n.updated_at ||
                      n.updatedAt
                  );
                  const cat = categoryMeta(n.category);
                  const src = sourceMeta(n.source_name);

                  return (
                    <div
                      key={n.id}
                      className="rc-card"
                      style={{
                        borderLeft: `4px solid ${cat.color}`,
                      }}
                    >
                      <div className="rc-card-row" style={{ alignItems: "flex-start" }}>
                        <div
                          className="rc-badge"
                          style={{
                            background: cat.color,
                            width: 12,
                            height: 12,
                            minWidth: 12,
                            borderRadius: 999,
                            marginTop: 6,
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div className="rc-card-title">{n.title}</div>

                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                              marginTop: 8,
                              marginBottom: 6,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                padding: "4px 8px",
                                borderRadius: 999,
                                background: `${cat.color}22`,
                                color: cat.color,
                                fontWeight: 700,
                              }}
                            >
                              {cat.emoji} {cat.label}
                            </span>

                            <span
                              style={{
                                fontSize: 12,
                                padding: "4px 8px",
                                borderRadius: 999,
                                background: `${src.color}22`,
                                color: src.color,
                                fontWeight: 700,
                              }}
                            >
                              {src.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rc-card-desc">
                        {n.summary || n.body || "Sin resumen disponible"}
                      </div>

                      <div className="rc-card-meta">
                        <span>{cat.label}</span>

                        {n.city && (
                          <>
                            <span>•</span>
                            <span>{n.city}</span>
                          </>
                        )}

                        {timeAgo && (
                          <>
                            <span>•</span>
                            <span>{timeAgo}</span>
                          </>
                        )}
                      </div>

                      {n.source_url && (
                        <a
                          href={n.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 12,
                            color: "#667eea",
                            textDecoration: "none",
                            marginTop: 8,
                            display: "inline-block",
                          }}
                        >
                          Ver noticia →
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activePanel === "directions" && (
          <>
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

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginTop: 14,
                marginBottom: 12,
              }}
            >
              {!isNavigationActive ? (
                <button
                  type="button"
                  className="rc-primary-btn"
                  onClick={() => onStartRouteAndFocusMap?.()}
                  disabled={!hasDirectionsRoute}
                  style={{
                    width: "100%",
                    minHeight: 46,
                    padding: "12px 14px",
                    borderRadius: 14,
                    fontWeight: 800,
                    background: "#22c55e",
                    border: "1px solid #22c55e",
                    color: "#ffffff",
                    boxShadow: hasDirectionsRoute
                      ? "0 8px 20px rgba(22,163,74,0.35)"
                      : "none",
                    opacity: hasDirectionsRoute ? 1 : 0.55,
                    cursor: hasDirectionsRoute ? "pointer" : "not-allowed",
                  }}
                  title={hasDirectionsRoute ? "Iniciar ruta" : "Primero calcula una ruta"}
                >
                  Iniciar ruta
                </button>
              ) : (
                <button
                  type="button"
                  className="rc-primary-btn"
                  onClick={() => onStopNavigation?.()}
                  style={{
                    width: "100%",
                    minHeight: 46,
                    padding: "12px 14px",
                    borderRadius: 14,
                    fontWeight: 800,
                    background: "#22c55e",
                    border: "1px solid #22c55e",
                    color: "#ffffff",
                    boxShadow: "0 8px 20px rgba(220,38,38,0.35)",
                  }}
                >
                  Detener ruta
                </button>
              )}

              <button
                type="button"
                className="rc-secondary-btn"
                onClick={() => onClearDirections?.()}
                disabled={!hasDirectionsRoute && !isNavigationActive}
                style={{
                  width: "100%",
                  minHeight: 46,
                  padding: "12px 14px",
                  borderRadius: 14,
                  fontWeight: 800,
                  background: "#ef4444",
                  border: "1px solid #ef4444",
                  color: "#ffffff",
                  boxShadow:
                    hasDirectionsRoute || isNavigationActive
                      ? "0 8px 20px rgba(234,88,12,0.35)"
                      : "none",
                  opacity: hasDirectionsRoute || isNavigationActive ? 1 : 0.55,
                  cursor:
                    hasDirectionsRoute || isNavigationActive ? "pointer" : "not-allowed",
                }}
              >
                Limpiar ruta
              </button>
            </div>

            {navigationCurrentStep && (
              <div
                style={{
                  marginTop: 6,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    opacity: 0.72,
                    marginBottom: 6,
                    textTransform: "uppercase",
                  }}
                >
                  {isNavigationActive ? "Navegacion activa" : "Siguiente instruccion"}
                </div>

                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    lineHeight: 1.2,
                    color: "#f8fafc",
                    marginBottom: 8,
                  }}
                >
                  {navigationCurrentStep.plainInstruction || "Sigue la ruta"}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    fontSize: 12,
                    opacity: 0.8,
                  }}
                >
                  {navigationCurrentStep.distanceText && (
                    <span>{navigationCurrentStep.distanceText}</span>
                  )}
                  {navigationCurrentStep.durationText && (
                    <span>• {navigationCurrentStep.durationText}</span>
                  )}
                  {Number.isFinite(navigationCurrentStep.stepNumber) &&
                    Number.isFinite(navigationCurrentStep.totalSteps) && (
                      <span>
                        • Paso {navigationCurrentStep.stepNumber} de{" "}
                        {navigationCurrentStep.totalSteps}
                      </span>
                    )}
                </div>
              </div>
            )}
          </>
        )}

        {activePanel === "filters" && (
          <FiltersPanel
            filters={filters}
            setFilters={setFilters}
            onReset={onResetFilters}
          />
        )}

        {activePanel === "stats" && (
          <>
            <div className="rc-stats-hero">
              <div className="rc-stats-hero-left">
                <div className="rc-stats-hero-title">Resumen</div>
                <div className="rc-stats-hero-sub">
                  Tipo con mas reportes: {TYPE_LABEL[topType]}
                </div>
              </div>

              <div className="rc-stats-hero-right">
                <div className="rc-stats-total">{mergedStats.total}</div>
                <div className="rc-stats-total-label">Reportes visibles (usuarios + IA)</div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <div className="rc-stat-card">
                <div className="rc-stat-card-top">
                  <div className="rc-stat-card-meta">
                    <div className="rc-stat-card-label">Usuarios</div>
                    <div className="rc-stat-card-sub">Reportes enviados por usuarios</div>
                  </div>
                  <div className="rc-stat-card-value">{Number(stats?.total || 0)}</div>
                </div>
              </div>

              <div className="rc-stat-card">
                <div className="rc-stat-card-top">
                  <div className="rc-stat-card-meta">
                    <div className="rc-stat-card-label">IA</div>
                    <div className="rc-stat-card-sub">Noticias y reportes automaticos</div>
                  </div>
                  <div className="rc-stat-card-value">{aiStats.total}</div>
                </div>
              </div>
            </div>

            <div className="rc-stats-grid">
              {Object.keys(TYPE_LABEL).map((t) => {
                const value = mergedStats[t] || 0;
                const pct = mergedStats.total > 0 ? Math.round((value / mergedStats.total) * 100) : 0;

                return (
                  <div key={t} className="rc-stat-card">
                    <div className="rc-stat-card-top">
                      <div className="rc-stat-card-icon">{TYPE_ICON[t]}</div>
                      <div className="rc-stat-card-meta">
                        <div className="rc-stat-card-label">{TYPE_LABEL[t]}</div>
                        <div className="rc-stat-card-sub">{pct}% del total combinado</div>
                      </div>
                      <div className="rc-stat-card-value">{value}</div>
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap",
                        fontSize: 12,
                        opacity: 0.8,
                      }}
                    >
                      <span>Usuarios: {Number(stats?.[t] || 0)}</span>
                      <span>IA: {Number(aiStats?.[t] || 0)}</span>
                    </div>

                    <div className="rc-stat-bar">
                      <div className="rc-stat-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rc-help" style={{ marginTop: 10 }}>
              Estas estadisticas combinan reportes creados por usuarios y reportes generados por IA.
            </div>
          </>
        )}
      </div>
    </section>
  );
}
