import { useEffect } from "react";

export default function HeatmapControls({ open, setOpen, heatmapOn, setHeatmapOn }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="rc-heat-mini" onClick={(e) => e.stopPropagation()}>
      <div className="rc-heat-mini-left">
        <div className="rc-heat-mini-title">Zonas calientes</div>
        <div className="rc-heat-mini-sub">Heatmap automatico (todos los incidentes)</div>
      </div>

      <label className="rc-switch" title={heatmapOn ? "Apagar" : "Encender"}>
        <input
          type="checkbox"
          checked={heatmapOn}
          onChange={(e) => setHeatmapOn(e.target.checked)}
        />
        <span />
      </label>
    </div>
  );
}
