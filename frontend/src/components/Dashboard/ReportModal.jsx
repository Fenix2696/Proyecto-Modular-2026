import { useEffect, useMemo, useRef, useState } from "react";
import "../../styles/report-modal.css";

const MAX_IMAGE_SIZE_BYTES = 1200 * 1024; // ~1.2MB para reducir fallas en mobile/serverless
const MAX_IMAGE_DIMENSION = 1280;

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

  const [lat, setLat] = useState(currentPosition?.[0] ?? 20.6597);
  const [lng, setLng] = useState(currentPosition?.[1] ?? -103.3496);
  const [locationMethod, setLocationMethod] = useState("current");
  const [isLocating, setIsLocating] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState("");
  const [locationPickedFromMap, setLocationPickedFromMap] = useState(false);
  const mapPickerContainerRef = useRef(null);
  const mapPickerInstanceRef = useRef(null);
  const mapCenterListenerRef = useRef(null);
  const latestCoordsRef = useRef({
    lat: currentPosition?.[0] ?? 20.6597,
    lng: currentPosition?.[1] ?? -103.3496,
  });

  // 🔥 NUEVO — Imagen
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const canNext = useMemo(() => {
    if (step === 1) return !!type;
    if (step === 2) return title.trim().length >= 3;
    if (step === 3) {
      const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
      if (!hasCoordinates) return false;
      if (locationMethod === "map") return locationPickedFromMap;
      return true;
    }
    return false;
  }, [step, type, title, lat, lng, locationMethod, locationPickedFromMap]);

  useEffect(() => {
    if (Array.isArray(currentPosition) && currentPosition.length === 2) {
      setLat(Number(currentPosition[0]));
      setLng(Number(currentPosition[1]));
    }
  }, [currentPosition]);

  useEffect(() => {
    latestCoordsRef.current = { lat, lng };
  }, [lat, lng]);

  const goNext = () => {
    if (!canNext) return;
    setStep((s) => Math.min(3, s + 1));
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const onFormKeyDown = (e) => {
    if (e.key !== "Enter") return;
    if (e.target && e.target.tagName === "TEXTAREA") return;

    e.preventDefault();

    if (step !== 3 && canNext) goNext();
  };

  useEffect(() => {
    if (step !== 3 || locationMethod !== "map") return undefined;

    let cancelled = false;
    let mapContainer = mapPickerContainerRef.current;

    const setupMap = () => {
      if (cancelled) return;
      mapContainer = mapPickerContainerRef.current;
      if (!mapContainer) return;

      const mapsApi = window.google?.maps;
      if (!mapsApi?.Map) {
        setLocationFeedback("Mapa no disponible. Puedes usar tu ubicacion actual o buscar direccion.");
        return;
      }

      if (!mapPickerInstanceRef.current) {
        mapPickerInstanceRef.current = new mapsApi.Map(mapContainer, {
          center: {
            lat: Number(latestCoordsRef.current.lat),
            lng: Number(latestCoordsRef.current.lng),
          },
          zoom: 17,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
      } else {
        mapPickerInstanceRef.current.panTo({
          lat: Number(latestCoordsRef.current.lat),
          lng: Number(latestCoordsRef.current.lng),
        });
      }

      mapCenterListenerRef.current?.remove?.();

      mapCenterListenerRef.current = mapPickerInstanceRef.current.addListener("center_changed", () => {
        const center = mapPickerInstanceRef.current?.getCenter?.();
        const la = center?.lat?.();
        const ln = center?.lng?.();
        if (typeof la === "number" && typeof ln === "number") {
          setLat(la);
          setLng(ln);
          setLocationPickedFromMap(false);
        }
      });

    };

    const t = setTimeout(setupMap, 0);

    return () => {
      cancelled = true;
      clearTimeout(t);
      mapCenterListenerRef.current?.remove?.();
    };
  }, [step, locationMethod]);

  useEffect(() => {
    if (locationMethod === "map") {
      setLocationPickedFromMap(false);
    }
  }, [locationMethod]);

  const handleUseCurrentLocation = () => {
    const knownLat = Number(currentPosition?.[0]);
    const knownLng = Number(currentPosition?.[1]);

    if (Number.isFinite(knownLat) && Number.isFinite(knownLng)) {
      setLat(knownLat);
      setLng(knownLng);
      setLocationMethod("current");
      setLocationPickedFromMap(false);
      setLocationFeedback("Ubicacion actual tomada desde tu sesion.");
      return;
    }

    if (!navigator.geolocation) {
      setLocationFeedback("Tu navegador no permite geolocalizacion en este dispositivo.");
      return;
    }

    setIsLocating(true);
    setLocationFeedback("Obteniendo tu ubicacion...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = Number(pos?.coords?.latitude);
        const ln = Number(pos?.coords?.longitude);
        if (Number.isFinite(la) && Number.isFinite(ln)) {
          setLat(la);
          setLng(ln);
          setLocationMethod("current");
          setLocationPickedFromMap(false);
          setLocationFeedback("Ubicacion actual cargada.");
        } else {
          setLocationFeedback("No se pudo leer tu ubicacion.");
        }
        setIsLocating(false);
      },
      () => {
        setLocationFeedback("No pudimos acceder a tu ubicacion. Revisa permisos del navegador.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 🔥 NUEVO — Manejo imagen
  const compressImageIfNeeded = async (file) => {
    if (!file) return file;

    const mime = String(file.type || "").toLowerCase();
    const shouldNormalizeToJpeg =
      file.size > MAX_IMAGE_SIZE_BYTES || mime.includes("heic") || mime.includes("heif") || mime.includes("avif");

    if (!shouldNormalizeToJpeg) return file;

    const readAsDataUrl = (blob) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

    const dataUrl = await readAsDataUrl(file);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });

    const ratio = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(img.width || 1, img.height || 1)
    );
    const targetWidth = Math.max(1, Math.round(img.width * ratio));
    const targetHeight = Math.max(1, Math.round(img.height * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    let quality = 0.88;
    let compressedBlob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );

    while (compressedBlob && compressedBlob.size > MAX_IMAGE_SIZE_BYTES && quality > 0.45) {
      quality -= 0.1;
      compressedBlob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality)
      );
    }

    if (!compressedBlob) return file;

    // Si sigue muy pesada intentamos una segunda pasada mas agresiva
    if (compressedBlob.size > MAX_IMAGE_SIZE_BYTES) {
      const reducedScale = Math.min(1, 1024 / Math.max(targetWidth || 1, targetHeight || 1));
      if (reducedScale < 1) {
        const secondCanvas = document.createElement("canvas");
        secondCanvas.width = Math.max(1, Math.round(targetWidth * reducedScale));
        secondCanvas.height = Math.max(1, Math.round(targetHeight * reducedScale));
        const secondCtx = secondCanvas.getContext("2d");
        if (secondCtx) {
          secondCtx.drawImage(canvas, 0, 0, secondCanvas.width, secondCanvas.height);
          compressedBlob = await new Promise((resolve) =>
            secondCanvas.toBlob(resolve, "image/jpeg", 0.72)
          );
        }
      }
    }

    if (!compressedBlob) return file;
    if (compressedBlob.size >= file.size && !shouldNormalizeToJpeg) return file;

    const originalName = file.name.replace(/\.[^.]+$/, "");
    return new File([compressedBlob], `${originalName || "incidente"}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Solo se permiten imagenes");
      return;
    }

    try {
      setIsProcessingImage(true);
      const finalFile = await compressImageIfNeeded(file);
      if (finalFile.size > MAX_IMAGE_SIZE_BYTES) {
        alert("La imagen sigue siendo muy pesada. Intenta con otra foto o recortala antes de subirla.");
        return;
      }
      setImageFile(finalFile);
      setImagePreview(URL.createObjectURL(finalFile));
    } catch {
      alert("No se pudo procesar la imagen");
    } finally {
      setIsProcessingImage(false);
      e.target.value = "";
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleFinalSubmit = () => {
    if (!canNext) return;

    onSubmit({
      type,
      title: title.trim(),
      description: description.trim(),
      address: "",
      lat,
      lng,
      imageFile, // 🔥 Se envía al api.js
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
          <button
            className="rm-close"
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
          >
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

        <form
          className="rm-body"
          onKeyDown={onFormKeyDown}
          onSubmit={(e) => e.preventDefault()}
        >
          {/* STEP 1 */}
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

          {/* STEP 2 */}
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

              {/* 🔥 NUEVA SECCION IMAGEN — SIN ROMPER DISEÑO */}
              <div className="rm-field">
                <label>Imagen (opcional)</label>

                {!imagePreview && (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="rm-input"
                    disabled={isProcessingImage}
                  />
                )}

                {isProcessingImage && (
                  <div className="rm-small">Procesando imagen...</div>
                )}

                {imagePreview && (
                  <div className="rm-image-preview">
                    <img src={imagePreview} alt="Preview" />
                    <button
                      type="button"
                      className="rm-remove-image"
                      onClick={removeImage}
                    >
                      Quitar imagen
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <>
              <h3 className="rm-h3">Ubicacion (actual o mapa)</h3>

              <div className="rm-location-selector-block">
                <div className="rm-location-selector-title">¿Como quieres indicar la ubicacion?</div>
                <div className="rm-inline-location-actions">
                  <button
                    className={`rm-inline-location-btn ${locationMethod === "current" ? "active" : ""}`}
                    type="button"
                    disabled={isLocating}
                    onClick={handleUseCurrentLocation}
                  >
                    {isLocating ? "⏳ Obteniendo..." : "📍 Usar mi ubicacion"}
                  </button>
                  <button
                    className={`rm-inline-location-btn ${locationMethod === "map" ? "active" : ""}`}
                    type="button"
                    onClick={() => {
                      setLocationMethod("map");
                      setLocationFeedback("Mueve el mapa y confirma la ubicacion.");
                    }}
                  >
                    🗺️ Elegir en mapa
                  </button>
                </div>
              </div>

              <div className="rm-small rm-small-no-margin">
                Selecciona tu ubicacion actual o ajusta el mapa manualmente.
              </div>

              {locationMethod === "map" && (
                <div className="rm-map-picker-wrap">
                  <div ref={mapPickerContainerRef} className="rm-map-picker" />
                  <div className="rm-map-pin-fixed" aria-hidden="true">
                    📍
                  </div>
                  <div className="rm-small rm-small-no-margin">
                    Mueve el mapa y deja el pin en el punto exacto del incidente.
                  </div>
                  <button
                    className="rm-btn rm-btn-primary rm-confirm-location-btn"
                    type="button"
                    onClick={() => {
                      setLocationPickedFromMap(true);
                      setLocationFeedback("Ubicacion confirmada desde el mapa.");
                    }}
                  >
                    Confirmar ubicacion
                  </button>
                </div>
              )}

              {locationFeedback && (
                <div className="rm-small rm-location-feedback">{locationFeedback}</div>
              )}
              {locationMethod === "map" && !locationPickedFromMap && (
                <div className="rm-small rm-map-warning">
                  Tip: presiona "Confirmar ubicacion" cuando el pin este en el punto deseado.
                </div>
              )}
            </>
          )}

          <div className="rm-footer">
            <button
              className="rm-btn rm-btn-ghost"
              type="button"
              onClick={step === 1 ? onClose : goBack}
            >
              {step === 1 ? "Cancelar" : "Atras"}
            </button>

            {step < 3 ? (
              <button
                className="rm-btn rm-btn-primary"
                type="button"
                onClick={goNext}
                disabled={!canNext}
              >
                Siguiente →
              </button>
            ) : (
              <button
                className="rm-btn rm-btn-primary"
                type="button"
                onClick={handleFinalSubmit}
                disabled={!canNext}
              >
                Reportar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
