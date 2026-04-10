import { useEffect, useMemo, useRef, useState } from "react";

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
  const [ready, setReady] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);

  const setInputValue = (nextValue) => {
    onValueChange?.(nextValue);
    onChange?.(nextValue);
  };

  const loadRecentSearches = () => {
    if (!enableRecentSearches) return [];
    try {
      const raw = localStorage.getItem(recentStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  };

  const saveRecentSearches = (items) => {
    if (!enableRecentSearches) return;
    try {
      localStorage.setItem(recentStorageKey, JSON.stringify(items));
    } catch {}
  };

  const pushRecentSearch = (text) => {
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
  };

  const removeRecentSearch = (text) => {
    const next = recentSearches.filter((item) => item !== text);
    setRecentSearches(next);
    saveRecentSearches(next);
  };

  useEffect(() => {
    if (!enableRecentSearches) return;
    setRecentSearches(loadRecentSearches());
  }, [enableRecentSearches]);

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
      fields: ["formatted_address", "geometry", "name"],
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

    const onPlaceChanged = () => {
      const place = ac.getPlace();
      const address = place?.formatted_address || place?.name || input.value || "";

      justSelectedRef.current = true;
      setTimeout(() => {
        justSelectedRef.current = false;
      }, 450);

      setInputValue(address);
      pushRecentSearch(address);
      setShowRecent(false);

      const loc = place?.geometry?.location;
      const lat = loc?.lat?.();
      const lng = loc?.lng?.();

      if (onSelect && typeof lat === "number" && typeof lng === "number") {
        onSelect({ lat, lng, address, place });
      }

      try {
        input.blur();
      } catch {}
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
      } catch {}
      acRef.current = null;
    };
  }, [
    ready,
    biasGuadalajara,
    onSelect,
    dropdownVariant,
    enableRecentSearches,
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
    } catch {}
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
    } catch {}
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
              } catch {}
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
            } catch {}
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
