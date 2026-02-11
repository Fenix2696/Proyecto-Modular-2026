import { useEffect, useRef, useState } from "react";

/**
 * PlacesSearch
 * - google.maps.places.Autocomplete sobre un <input>
 * - onSelect({lat,lng,address,place})
 * - value + onValueChange controlado
 * - onEnter(text) al presionar ENTER
 *
 * Fixes UX:
 * - Evita doble accion (select + enter) con justSelectedRef
 * - Cierra sugerencias al presionar Enter (blur)
 */
export default function PlacesSearch({
  onSelect,
  onEnter,
  placeholder = "Buscar direccion o lugar...",
  value = "",
  onValueChange,
  inputClassName = "rc-input",
  showHelp = false,
  biasGuadalajara = true,
}) {
  const inputRef = useRef(null);
  const acRef = useRef(null);
  const justSelectedRef = useRef(false);
  const [ready, setReady] = useState(false);

  // Espera a que exista google.maps + places
  useEffect(() => {
    const t = setInterval(() => {
      const ok =
        typeof window !== "undefined" &&
        window.google &&
        window.google.maps &&
        window.google.maps.places &&
        window.google.maps.places.Autocomplete;

      if (ok) {
        clearInterval(t);
        setReady(true);
      }
    }, 120);

    return () => clearInterval(t);
  }, []);

  // Crea Autocomplete una sola vez
  useEffect(() => {
    if (!ready) return;
    if (!inputRef.current) return;
    if (acRef.current) return;

    const input = inputRef.current;

    const ac = new window.google.maps.places.Autocomplete(input, {
      fields: ["formatted_address", "geometry", "name"],
      componentRestrictions: { country: "mx" },
    });

    // Bias Guadalajara
    if (biasGuadalajara && window.google.maps.LatLngBounds) {
      const sw = new window.google.maps.LatLng(20.55, -103.50);
      const ne = new window.google.maps.LatLng(20.78, -103.20);
      const bounds = new window.google.maps.LatLngBounds(sw, ne);
      ac.setBounds(bounds);
      ac.setOptions({ strictBounds: false });
    }

    const onPlaceChanged = () => {
      const place = ac.getPlace();
      const address = place?.formatted_address || place?.name || input.value || "";

      // Marcamos que acabamos de seleccionar para no disparar onEnter al soltar Enter
      justSelectedRef.current = true;
      setTimeout(() => {
        justSelectedRef.current = false;
      }, 450);

      onValueChange?.(address);

      const loc = place?.geometry?.location;
      const lat = loc?.lat?.();
      const lng = loc?.lng?.();

      if (onSelect && typeof lat === "number" && typeof lng === "number") {
        onSelect({ lat, lng, address, place });
      }

      // Cierra el dropdown de sugerencias
      try {
        input.blur();
      } catch (_) {}
    };

    ac.addListener("place_changed", onPlaceChanged);
    acRef.current = ac;

    return () => {
      acRef.current = null;
    };
  }, [ready, biasGuadalajara, onSelect, onValueChange]);

  // Refleja value externo al input
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    if (typeof value === "string" && input.value !== value) {
      input.value = value;
    }
  }, [value]);

  return (
    <div style={{ width: "100%" }}>
      <input
        ref={inputRef}
        className={inputClassName}
        defaultValue={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onValueChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;

          // Si vienes de una seleccion de Autocomplete, no dispares onEnter
          if (justSelectedRef.current) {
            e.preventDefault();
            e.stopPropagation();
            try {
              e.currentTarget.blur();
            } catch (_) {}
            return;
          }

          e.preventDefault();
          e.stopPropagation();

          const q = (e.currentTarget.value || "").trim();
          if (q) onEnter?.(q);

          // Cierra sugerencias
          try {
            e.currentTarget.blur();
          } catch (_) {}
        }}
      />

      {showHelp ? <div className="rc-help">Escribe y selecciona una sugerencia.</div> : null}
    </div>
  );
}
