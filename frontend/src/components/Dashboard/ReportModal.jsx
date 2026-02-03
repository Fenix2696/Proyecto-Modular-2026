import { useEffect, useMemo, useState } from "react";
import "../../styles/report-modal.css";
import PlacesSearch from "./PlacesSearch";

const TYPES = [
  { key: "robbery", label: "Asalto/Robo", emoji: "🚨" },
  { key: "accident", label: "Accidente", emoji: "🚗" },
  { key: "emergency", label: "Emergencia", emoji: "⚠️" },
  { key: "theft", label: "Hurto", emoji: "🔒" },
  { key: "vandalism", label: "Vandalismo", emoji: "🏚️" },
];

export default function ReportModal({ onClose, onSubmit, currentPosition }) {
  const [step, setStep] = useState(1);

  const [type, setType] = useState("robbery");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [address, setAddress] = useState("");
  const [lat, setLat] = useState(currentPosition?.[0] ?? 20.6597);
  const [lng, setLng] = useState(currentPosition?.[1] ?? -103.3496);

  const canNext = useMemo(() => {
    if (step === 1) return !!type;
    if (step === 2) return title.trim().length >= 3;
    if (step === 3) return Number.isFinite(lat) && Number.isFinite(lng);
    return false;
  }, [step, type, title, lat, lng]);

  useEffect(() => {
    if (Array.isArray(currentPosition) && currentPosition.length === 2) {
      setLat(Number(currentPosition[0]));
      setLng(Number(currentPosition[1]));
    }
  }, [currentPosition]);

  const goNext = () => {
    if (!canNext) return;
    setStep((s) => Math.min(3, s + 1));
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  // 🔥 evita que Enter haga submit y "se salte" ubicacion
  const onFormKeyDown = (e) => {
    if (e.key !== "Enter") return;
    if (e.target && e.target.tagName === "TEXTAREA") return;

    e.preventDefault();

    if (step !== 3 && canNext) goNext();
  };

  const handlePlaceSelect = ({ lat: la, lng: ln, address: addr }) => {
    if (typeof la === "number" && typeof ln === "number") {
      setLat(la);
      setLng(ln);
    }
    if (addr) setAddress(addr);
  };

  const handleFinalSubmit = () => {
    if (!canNext) return;

    onSubmit({
      type,
      title: title.trim(),
      description: description.trim(),
      address: address.trim(),
      lat,
      lng,
    });
  };

  const overlayMouseDown = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="rm-overlay" onMouseDown={overlayMouseDown}>
      <div className="rm-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="rm-header">
          <div className="rm-title">
            <span className="rm-pin">📍</span>
            Reportar Incidente
          </div>
          <button className="rm-close" type="button" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="rm-steps">
          <div className={`rm-step ${step === 1 ? "active" : step > 1 ? "done" : ""}`}>
            <div className="rm-step-dot">1</div>
            <div className="rm-step-label">Tipo</div>
          </div>

          <div className="rm-step-line" />

          <div className={`rm-step ${step === 2 ? "active" : step > 2 ? "done" : ""}`}>
            <div className="rm-step-dot">2</div>
            <div className="rm-step-label">Detalles</div>
          </div>

          <div className="rm-step-line" />

          <div className={`rm-step ${step === 3 ? "active" : ""}`}>
            <div className="rm-step-dot">3</div>
            <div className="rm-step-label">Ubicacion</div>
          </div>
        </div>

        <form className="rm-body" onKeyDown={onFormKeyDown} onSubmit={(e) => e.preventDefault()}>
          {step === 1 && (
            <>
              <h3 className="rm-h3">Selecciona el tipo de incidente</h3>

              <div className="rm-grid">
                {TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`rm-type ${type === t.key ? "active" : ""}`}
                    onClick={() => setType(t.key)}
                  >
                    <div className="rm-emoji">{t.emoji}</div>
                    <div className="rm-type-label">{t.label}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h3 className="rm-h3">Detalles</h3>

              <div className="rm-field">
                <label>Titulo</label>
                <input
                  className="rm-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Asalto cerca de..."
                  autoFocus
                />
              </div>

              <div className="rm-field">
                <label>Descripcion</label>
                <textarea
                  className="rm-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Agrega detalles (opcional)"
                  rows={4}
                />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="rm-h3">Ubicacion</h3>

              <div className="rm-field">
                <label>Buscar direccion</label>

                <PlacesSearch
                  value={address}
                  onValueChange={setAddress}
                  onSelect={handlePlaceSelect}
                  placeholder="Escribe una direccion o lugar..."
                  inputClassName="rm-input"
                  showHelp={false}
                />

                <div className="rm-small">
                  Selecciona una sugerencia para guardar lat/lng.
                </div>
              </div>

              <div className="rm-coords">
                <div className="rm-coord">
                  <div className="rm-coord-label">Lat</div>
                  <div className="rm-coord-value">{Number(lat).toFixed(6)}</div>
                </div>
                <div className="rm-coord">
                  <div className="rm-coord-label">Lng</div>
                  <div className="rm-coord-value">{Number(lng).toFixed(6)}</div>
                </div>
              </div>
            </>
          )}

          <div className="rm-footer">
            <button className="rm-btn rm-btn-ghost" type="button" onClick={step === 1 ? onClose : goBack}>
              {step === 1 ? "Cancelar" : "Atras"}
            </button>

            {step < 3 ? (
              <button className="rm-btn rm-btn-primary" type="button" onClick={goNext} disabled={!canNext}>
                Siguiente →
              </button>
            ) : (
              <button className="rm-btn rm-btn-primary" type="button" onClick={handleFinalSubmit} disabled={!canNext}>
                Reportar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
