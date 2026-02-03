import { useEffect, useRef, useState } from "react";

/**
 * PlacesSearch (NEW)
 * Usa google.maps.places.PlaceAutocompleteElement
 * - NO carga scripts (evita doble carga)
 * - Emite onSelect({lat,lng,address,place})
 * - Controlado: value + onValueChange
 */
export default function PlacesSearch({
  onSelect,
  placeholder = "Buscar direccion o lugar...",
  value = "",
  onValueChange,
  inputClassName = "rc-input",
  showHelp = true,
}) {
  const hostRef = useRef(null);
  const elRef = useRef(null);
  const [ready, setReady] = useState(false);

  // 1) Espera a que exista window.google (script cargado por IncidentMapGoogle)
  useEffect(() => {
    const t = setInterval(() => {
      const ok =
        typeof window !== "undefined" &&
        window.google &&
        window.google.maps &&
        window.google.maps.importLibrary &&
        window.google.maps.places &&
        window.google.maps.places.PlaceAutocompleteElement;

      if (ok) {
        clearInterval(t);
        setReady(true);
      }
    }, 150);

    return () => clearInterval(t);
  }, []);

  // 2) Crea el PlaceAutocompleteElement una sola vez
  useEffect(() => {
    if (!ready) return;
    if (!hostRef.current) return;
    if (elRef.current) return;

    (async () => {
      // carga libreria places (ya está en libraries, pero esto asegura el componente)
      await window.google.maps.importLibrary("places");

      const el = new window.google.maps.places.PlaceAutocompleteElement({});
      el.placeholder = placeholder;

      // styling básico (y además metemos una clase)
      el.className = `gmp-autocomplete ${inputClassName || ""}`;

      // Listener nuevo (gmp-select) :contentReference[oaicite:1]{index=1}
      el.addEventListener("gmp-select", async ({ placePrediction }) => {
        try {
          const place = placePrediction.toPlace();
          await place.fetchFields({
            fields: ["displayName", "formattedAddress", "location"],
          });

          const address =
            place.formattedAddress || place.displayName || "";

          const lat = place.location?.lat?.();
          const lng = place.location?.lng?.();

          if (onValueChange) onValueChange(address);

          if (onSelect && typeof lat === "number" && typeof lng === "number") {
            onSelect({ lat, lng, address, place });
          }
        } catch (e) {
          console.error("Error PlaceAutocompleteElement:", e);
        }
      });

      hostRef.current.appendChild(el);
      elRef.current = el;

      // set initial value si hay
      if (value) {
        // algunos browsers permiten set directo al value
        // si no, igual se verá el placeholder y el usuario escribe
        try {
          el.value = value;
        } catch (_) {}
      }
    })();

    return () => {
      // cleanup
      if (elRef.current && hostRef.current) {
        try {
          hostRef.current.removeChild(elRef.current);
        } catch (_) {}
      }
      elRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // 3) Si value cambia desde afuera, intentamos reflejarlo
  useEffect(() => {
    if (!elRef.current) return;
    try {
      elRef.current.value = value || "";
    } catch (_) {}
  }, [value]);

  // Fallback mientras no está listo (input normal)
  if (!ready) {
    return (
      <div style={{ width: "100%" }}>
        <input
          className={inputClassName}
          value={value}
          onChange={(e) => onValueChange && onValueChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
        {showHelp ? (
          <div className="rc-help">Cargando sugerencias...</div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <div ref={hostRef} style={{ width: "100%" }} />
      {showHelp ? (
        <div className="rc-help">Selecciona una sugerencia para guardar lat/lng.</div>
      ) : null}
    </div>
  );
}
