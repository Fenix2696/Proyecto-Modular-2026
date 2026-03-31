import { useEffect } from "react";


//  Import real (Vite empaqueta y sí carga)
import mapAuto from "../../../assets/images/map-types/map-auto.png";
import mapSatellite from "../../../assets/images/map-types/map-satellite.png";
import mapDark from "../../../assets/images/map-types/map-dark.png";

const MAP_TYPES = [
  { id: "auto", label: "Auto", image: mapAuto },
  { id: "satellite", label: "Satellite", image: mapSatellite },
  { id: "dark", label: "Dark", image: mapDark },
];

export default function MapTypeSelector({ activeType, onSelect, onClose }) {
  //  Cerrar con ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="maptype-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="maptype-modal" onClick={(e) => e.stopPropagation()}>
        <div className="maptype-header">
          <h3>Tipo de mapa</h3>
          <button className="maptype-close" onClick={onClose} type="button" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="maptype-grid">
          {MAP_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              className={`maptype-card ${activeType === type.id ? "active" : ""}`}
              onClick={() => onSelect(type.id)}
            >
              <img src={type.image} alt={type.label} />
              <span>{type.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
