import React, { useEffect, useMemo, useRef, useState } from "react";
import { TYPE_LABEL } from "../utils/incidentTypes";

const TIME_OPTIONS = [
  { value: "1h", label: "Ultima hora" },
  { value: "2d", label: "Ultimos 2 dias" },
  { value: "5d", label: "Ultimos 5 dias" },
  { value: "7d", label: "Ultimos 7 dias" },
];

export default function FiltersPanel({ filters, setFilters, onResetFilters }) {
  const typeKeys = useMemo(() => Object.keys(TYPE_LABEL), []);
  const [openTime, setOpenTime] = useState(false);
  const wrapRef = useRef(null);

  const timeLabel =
    TIME_OPTIONS.find((o) => o.value === filters.timeRange)?.label || "Ultima hora";

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpenTime(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpenTime(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  function setTime(value) {
    setFilters((f) => ({ ...f, timeRange: value }));
    setOpenTime(false);
  }

  return (
    <div className="rc-filters">
      {/* ✅ is-front cuando esta abierto para que el menu quede encima de Tipos */}
      <div className={`rc-filters-section ${openTime ? "is-front" : ""}`}>
        <div className="rc-filters-label">Rango de tiempo</div>

        <div className={`rc-dd ${openTime ? "is-open" : ""}`} ref={wrapRef}>
          <button
            type="button"
            className={`rc-dd-trigger ${openTime ? "is-open" : ""}`}
            onClick={() => setOpenTime((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={openTime ? "true" : "false"}
          >
            <span className="rc-dd-value">{timeLabel}</span>
            <span className="rc-dd-chev" aria-hidden="true">
              ▾
            </span>
          </button>

          {openTime && (
            <div className="rc-dd-menu" role="listbox" aria-label="Rango de tiempo">
              {TIME_OPTIONS.map((o) => {
                const active = o.value === filters.timeRange;
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={`rc-dd-item ${active ? "is-active" : ""}`}
                    onClick={() => setTime(o.value)}
                    role="option"
                    aria-selected={active ? "true" : "false"}
                  >
                    <span className="rc-dd-item-label">{o.label}</span>
                    {active ? <span className="rc-dd-check">✓</span> : <span className="rc-dd-check" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rc-filters-section">
        <div className="rc-filters-label">Tipos</div>

        <div className="rc-filters-list" role="group" aria-label="Tipos de reporte">
          {typeKeys.map((t) => (
            <label key={t} className="rc-filters-item">
              <input
                className="rc-filters-check"
                type="checkbox"
                checked={!!filters[t]}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, [t]: e.target.checked }))
                }
              />
              <span className="rc-filters-text">{TYPE_LABEL[t]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rc-filters-footer">
        <button className="rc-filters-reset" onClick={onResetFilters} type="button">
          Reiniciar filtros
        </button>
      </div>
    </div>
  );
}
