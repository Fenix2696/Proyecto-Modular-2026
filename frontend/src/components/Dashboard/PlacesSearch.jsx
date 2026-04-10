import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * PlacesSearch
 * - google.maps.places.Autocomplete sobre un <input>
 * - onSelect({lat,lng,address,place})
 * - onEnter(text) al presionar ENTER
 * - historial reciente opcional
 */
export default function PlacesSearch({
  onSelect,
  onEnter,
  placeholder = "Buscar direccion o lugar...",
  value = "",
  onChange,
  onValueChange,
  inputClassName = "rc-input",
  showHelp = false,
  biasGuadalajara = true,
  dropdownVariant = "default", // "default" | "topbar" | "panel"
  enableRecentSearches = false,
  recentStorageKey = "rc_recent_searches",
  maxRecentSearches = 6,
}) {
  const inputRef = useRef(null);
  const acRef = useRef(null);
  const justSelectedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const onEnterRef = useRef(onEnter);
  const setInputValueRef = useRef(null);
  const pushRecentSearchRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);

  const setInputValue = useCallback((nextValue) => {
    onValueChange?.(nextValue);
    onChange?.(nextValue);
  }, [onValueChange, onChange]);

  const loadRecentSearches = useCallback(() => {
    if (!enableRecentSearches) return [];
    try {
      const raw = localStorage.getItem(recentStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }, [enableRecentSearches, recentStorageKey]);

  const saveRecentSearches = useCallback((items) => {
    if (!enableRecentSearches) return;
    try {
      localStorage.setItem(recentStorageKey, JSON.stringify(items));
    } catch { /* no-op */ }
  }, [enableRecentSearches, recentStorageKey]);

  const pushRecentSearch = useCallback((text) => {
    if (!enableRecentSearches) return;
    const clean = String(text || "").trim();
    if (!clean) return;

    setRecentSearches((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const next = [
        clean,
        ...base.filter((item) => item.toLowerCase() !== clean.toLowerCase()),
      ].slice(0, maxRecentSearches);
      saveRecentSearches(next);
      return next;
    });
  }, [enableRecentSearches, maxRecentSearches, saveRecentSearches]);

  useEffect(() => {
    onSelectRef.current = onSelect;
    onEnterRef.current = onEnter;
    setInputValueRef.current = setInputValue;
    pushRecentSearchRef.current = pushRecentSearch;
  }, [onSelect, onEnter, setInputValue, pushRecentSearch]);

  const removeRecentSearch = (text) => {
    const next = recentSearches.filter((item) => item !== text);
    setRecentSearches(next);
    saveRecentSearches(next);
  };

  useEffect(() => {
    if (!enableRecentSearches) return;
    setRecentSearches(loadRecentSearches());
  }, [enableRecentSearches, loadRecentSearches]);

  useEffect(() => {
    const t = setInterval(() => {
      const ok =
        typeof window !== "undefined" &&
        window.google &&
        window.google.maps &&
        window.google.maps.places;

      if (ok) {
        clearInterval(t);
        setReady(true);
      }
    }, 120);

    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!inputRef.current) return;
    if (acRef.current) return;

    const input = inputRef.current;

    const LegacyAutocomplete = window.google?.maps?.places?.Autocomplete;
    if (typeof LegacyAutocomplete !== "function") return;

    const ac = new LegacyAutocomplete(input, {
      fields: ["formatted_address", "geometry", "name", "place_id"],
      componentRestrictions: { country: "mx" },
    });

    if (biasGuadalajara && window.google.maps.LatLngBounds) {
      const sw = new window.google.maps.LatLng(20.55, -103.50);
      const ne = new window.google.maps.LatLng(20.78, -103.20);
      const bounds = new window.google.maps.LatLngBounds(sw, ne);
      ac.setBounds(bounds);
      ac.setOptions({ strictBounds: false });
    }

    const applyPacVariantClass = () => {
      const pacs = Array.from(document.querySelectorAll(".pac-container"));
      if (!pacs.length) return;

      const lastPac = pacs[pacs.length - 1];

      // limpiar clases anteriores
      lastPac.classList.remove("pac-topbar", "pac-panel", "pac-default");

      if (dropdownVariant === "topbar") {
        lastPac.classList.add("pac-topbar");


        const rect = inputRef.current?.getBoundingClientRect();
        if (rect) {
          lastPac.style.width = `${rect.width}px`;
          lastPac.style.left = `${rect.left}px`;
        }

      } else if (dropdownVariant === "panel") {
        lastPac.classList.add("pac-panel");

        // 🔥 AJUSTE DINAMICO PANEL (MAS CHICO)
        const rect = inputRef.current?.getBoundingClientRect();
        if (rect) {
          lastPac.style.width = `${rect.width}px`;
          lastPac.style.left = `${rect.left}px`;
          lastPac.style.maxWidth = `${rect.width}px`;
        }

      } else {
        lastPac.classList.add("pac-default");
      }
    };

    const resolvePlaceLocation = async (place, fallbackAddress) => {
      const loc = place?.geometry?.location;
      const lat = loc?.lat?.();
      const lng = loc?.lng?.();

      if (typeof lat === "number" && typeof lng === "number") {
        return { lat, lng };
      }

      const Geocoder = window.google?.maps?.Geocoder;
      if (typeof Geocoder !== "function") return null;

      const geocoder = new Geocoder();

      if (place?.place_id) {
        try {
          const byPlaceId = await new Promise((resolve, reject) => {
            geocoder.geocode({ placeId: place.place_id }, (results, status) => {
              if (status === "OK" && Array.isArray(results) && results.length) {
                resolve(results[0]);
              } else {
                reject(new Error(status || "GEOCODER_PLACE_ID_ERROR"));
              }
            });
          });

          const pLoc = byPlaceId?.geometry?.location;
          const pLat = pLoc?.lat?.();
          const pLng = pLoc?.lng?.();
          if (typeof pLat === "number" && typeof pLng === "number") {
            return { lat: pLat, lng: pLng };
          }
        } catch { /* no-op */ }
      }

      const text = String(fallbackAddress || "").trim();
      if (!text) return null;

      try {
        const byAddress = await new Promise((resolve, reject) => {
          geocoder.geocode(
            { address: text, region: "mx" },
            (results, status) => {
              if (status === "OK" && Array.isArray(results) && results.length) {
                resolve(results[0]);
              } else {
                reject(new Error(status || "GEOCODER_ADDRESS_ERROR"));
              }
            }
          );
        });

        const aLoc = byAddress?.geometry?.location;
        const aLat = aLoc?.lat?.();
        const aLng = aLoc?.lng?.();
        if (typeof aLat === "number" && typeof aLng === "number") {
          return { lat: aLat, lng: aLng };
        }
      } catch { /* no-op */ }

      return null;
    };

    const onPlaceChanged = async () => {
      const place = ac.getPlace();
      const address = place?.formatted_address || place?.name || input.value || "";

      justSelectedRef.current = true;
      setTimeout(() => {
        justSelectedRef.current = false;
      }, 450);

      setInputValueRef.current?.(address);
      pushRecentSearchRef.current?.(address);
      setShowRecent(false);

      const resolvedLocation = await resolvePlaceLocation(place, address);

      if (onSelectRef.current && resolvedLocation) {
        onSelectRef.current({
          lat: resolvedLocation.lat,
          lng: resolvedLocation.lng,
          address,
          place,
        });
      } else if (address) {
        // Fallback: algunas respuestas de Autocomplete llegan sin geometry
        // en el primer click/tap. Forzamos flujo por texto para no pedir
        // una segunda seleccion al usuario.
        onEnterRef.current?.(address);
      }

      try {
        input.blur();
      } catch { /* no-op */ }
    };

    const handleInputFocus = () => {
      setTimeout(applyPacVariantClass, 50);
    };
    const handleInputInput = () => {
      setTimeout(applyPacVariantClass, 50);
    };

    input.addEventListener("focus", handleInputFocus);
    input.addEventListener("input", handleInputInput);

    const placeChangedListener = ac.addListener("place_changed", onPlaceChanged);
    acRef.current = ac;

    return () => {
      input.removeEventListener("focus", handleInputFocus);
      input.removeEventListener("input", handleInputInput);
      try {
        placeChangedListener?.remove?.();
      } catch { /* no-op */ }
      acRef.current = null;
    };
  }, [
    ready,
    biasGuadalajara,
    dropdownVariant,
  ]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    if (typeof value === "string" && input.value !== value) {
      input.value = value;
    }
  }, [value]);

  const shouldShowRecent = useMemo(() => {
    if (!enableRecentSearches) return false;
    const current = String(value || "").trim();
    return showRecent && !current && recentSearches.length > 0;
  }, [enableRecentSearches, showRecent, value, recentSearches]);

  const handleRecentClick = (text) => {
    setInputValue(text);
    pushRecentSearch(text);
    setShowRecent(false);
    onEnter?.(text);

    try {
      inputRef.current?.blur();
    } catch { /* no-op */ }
  };

  const hasInputValue = String(value || "").trim().length > 0;

  const handleClearInput = () => {
    setInputValue("");
    setShowRecent(enableRecentSearches && recentSearches.length > 0);

    try {
      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.focus();
      }
    } catch { /* no-op */ }
  };

  return (
    <div
      className={`rc-places-wrap rc-places-wrap--${dropdownVariant}`}
      style={{ width: "100%", position: "relative" }}
    >
      <div className="rc-places-input-wrap">
        <input
          ref={inputRef}
          className={`${inputClassName} ${hasInputValue ? "has-clear" : ""}`}
          defaultValue={value}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            if (enableRecentSearches) {
              setRecentSearches(loadRecentSearches());
              setShowRecent(true);
            }
          }}
          onBlur={() => {
            setTimeout(() => setShowRecent(false), 180);
          }}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (enableRecentSearches) {
              setShowRecent(!e.target.value.trim());
            }
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;

            if (justSelectedRef.current) {
              e.preventDefault();
              e.stopPropagation();
              try {
                e.currentTarget.blur();
              } catch { /* no-op */ }
              return;
            }

            e.preventDefault();
            e.stopPropagation();

            const q = (e.currentTarget.value || "").trim();
            if (q) {
              pushRecentSearch(q);
              onEnter?.(q);
            }

            setShowRecent(false);

            try {
              e.currentTarget.blur();
            } catch { /* no-op */ }
          }}
        />

        {hasInputValue && (
          <button
            type="button"
            className="rc-places-clear"
            aria-label="Limpiar direccion"
            title="Limpiar"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClearInput}
          >
            ✕
          </button>
        )}
      </div>

      {shouldShowRecent && (
        <div className="rc-recent-searches">
          <div className="rc-recent-searches-head">Busquedas recientes</div>

          <div className="rc-recent-searches-list">
            {recentSearches.map((item) => (
              <button
                key={item}
                type="button"
                className="rc-recent-search-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleRecentClick(item)}
              >
                <span className="rc-recent-search-text">{item}</span>

                <span
                  className="rc-recent-search-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRecentSearch(item);
                  }}
                >
                  ✕
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showHelp ? (
        <div className="rc-help">Escribe y selecciona una sugerencia.</div>
      ) : null}
    </div>
  );
}
