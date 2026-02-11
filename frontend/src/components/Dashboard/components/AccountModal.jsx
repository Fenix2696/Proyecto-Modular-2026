import { useEffect, useMemo, useRef, useState } from "react";
import { getMe, updateMe, uploadMyPhoto, changeMyPassword } from "../../../services/user";
import { UserRound, Lock, ImagePlus, Trash2, KeyRound, X } from "lucide-react";

/* ======================================================
   Toast
====================================================== */
function Toast({ toast, onClose }) {
  if (!toast) return null;

  const cls = `rc-toast ${toast.type === "success" ? "ok" : "err"}`;

  return (
    <div className={cls} role="status" aria-live="polite">
      <div className="rc-toast-title">{toast.title}</div>
      {toast.message && <div className="rc-toast-msg">{toast.message}</div>}
      <button className="rc-toast-close" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}

export default function AccountModal({ open, onClose, user, userPhotoUrl, onUpdated }) {
  const initial = useMemo(() => {
    const u = user || {};
    return {
      username: u.username || "",
      name: u.name || u.full_name || "",
      email: u.email || "",
      phone: u.phone || "",
      role: u.role || "user",
    };
  }, [user]);

  const [tab, setTab] = useState("profile");
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [localPreview, setLocalPreview] = useState("");
  const fileRef = useRef(null);
  const pendingFileRef = useRef(null);

  const [pw, setPw] = useState({
    currentPassword: "",
    newPassword: "",
    confirm: "",
  });

  // ✅ base backend
  const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "");
  const apiHost = apiBase.replace(/\/api$/i, ""); // http://localhost:5000

  const normalizePhotoUrl = (raw) => {
    const v = (raw || "").trim();
    if (!v) return "";

    // ya absoluto
    if (/^https?:\/\//i.test(v)) return v;

    // viene como /api/...
    if (v.startsWith("/api/")) return `${apiHost}${v}`;

    // viene como /uploads/... o /users/...
    if (v.startsWith("/")) return `${apiBase}${v}`;

    // relativo sin slash
    return `${apiBase}/${v}`;
  };

  useEffect(() => {
    if (!open) return;

    let alive = true;

    (async () => {
      setForm(initial);
      setTab("profile");
      setToast(null);
      setSaving(false);
      pendingFileRef.current = null;

      setLocalPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });

      setPw({ currentPassword: "", newPassword: "", confirm: "" });

      const u = user || {};
      const missing = !u.username && !u.name && !u.full_name && !u.phone;

      if (missing) {
        try {
          const res = await getMe();
          if (!alive) return;

          if (res?.success && res.user) {
            const fresh = res.user;
            setForm({
              username: fresh.username || "",
              name: fresh.name || fresh.full_name || "",
              email: fresh.email || "",
              phone: fresh.phone || "",
              role: fresh.role || "user",
            });
          }
        } catch (e) {
          console.error("getMe error:", e);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, initial, user]);

  useEffect(() => {
    return () => {
      try {
        if (localPreview) URL.revokeObjectURL(localPreview);
      } catch {}
    };
  }, [localPreview]);

  if (!open) return null;

  const onChange = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const handlePickImage = () => fileRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setToast({ type: "error", title: "Archivo invalido", message: "Selecciona una imagen." });
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setToast({ type: "error", title: "Imagen muy pesada", message: "Maximo 8MB." });
      return;
    }

    pendingFileRef.current = file;

    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });

    e.target.value = "";
  };

  const saveProfile = async () => {
    setSaving(true);
    setToast(null);

    try {
      const r1 = await updateMe({
        username: form.username,
        name: form.name,
        phone: form.phone,
      });

      const ok1 = r1?.success === true || r1?.ok === true || r1?.status === "ok" || r1?.user;

      if (!ok1) {
        setToast({
          type: "error",
          title: "No se pudo guardar",
          message: r1?.message || "Error al actualizar perfil",
        });
        return;
      }

      if (pendingFileRef.current) {
        const r2 = await uploadMyPhoto(pendingFileRef.current);

        const ok2 = r2?.success === true || r2?.ok === true || r2?.status === "ok" || r2?.photo_url;

        if (!ok2) {
          setToast({
            type: "error",
            title: "Foto no subida",
            message: r2?.message || "Error al subir la foto",
          });
          return;
        }

        pendingFileRef.current = null;
      }

      setToast({
        type: "success",
        title: "Perfil actualizado",
        message: "Guardado correctamente.",
      });

      await onUpdated?.();
    } catch (err) {
      console.error(err);
      setToast({
        type: "error",
        title: "Error",
        message: "No se pudo guardar el perfil",
      });
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    setSaving(true);
    setToast(null);

    try {
      if (!pw.currentPassword || !pw.newPassword || !pw.confirm) {
        setToast({ type: "error", title: "Faltan campos", message: "Completa todos los campos." });
        return;
      }

      if (pw.newPassword !== pw.confirm) {
        setToast({ type: "error", title: "No coincide", message: "La confirmacion no coincide." });
        return;
      }

      const r = await changeMyPassword({
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword,
      });

      if (!r?.success) {
        setToast({ type: "error", title: "Error", message: r?.message || "No se pudo cambiar." });
        return;
      }

      setToast({ type: "success", title: "Password actualizado", message: "Listo." });
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (e) {
      console.error(e);
      setToast({ type: "error", title: "Error", message: "No se pudo cambiar." });
    } finally {
      setSaving(false);
    }
  };

  // ✅ prioridad: preview local > prop (ya absoluto) > user.photo_url
  const basePhoto = userPhotoUrl || user?.photo_url || "";
  const effectivePhoto = localPreview || normalizePhotoUrl(basePhoto);

  return (
    <div className="rc-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="rc-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="rc-modal-header">
          <div className="rc-modal-title">Perfil</div>
          <div className={`rc-role-badge ${form.role === "admin" ? "admin" : "user"}`}>
            {form.role.toUpperCase()}
          </div>
          <button className="rc-icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="rc-tabs">
          <button className={`rc-tab ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>
            <UserRound size={18} /> Perfil
          </button>
          <button className={`rc-tab ${tab === "security" ? "active" : ""}`} onClick={() => setTab("security")}>
            <Lock size={18} /> Seguridad
          </button>
        </div>

        {tab === "profile" && (
          <div className="rc-account">
            <div className="rc-account-left">
              <div className="rc-avatar-preview">
                {effectivePhoto ? (
                  <img
                    src={effectivePhoto}
                    alt="Foto"
                    onError={() => console.error("Account photo error:", effectivePhoto)}
                  />
                ) : (
                  <div className="rc-avatar-fallback">U</div>
                )}
              </div>

              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFileChange} />

              <div className="rc-account-photo-actions">
                <button className="rc-secondary-btn" onClick={handlePickImage} disabled={saving}>
                  <ImagePlus size={18} /> Subir foto
                </button>
                <button
                  className="rc-secondary-btn"
                  onClick={() => {
                    pendingFileRef.current = null;
                    setLocalPreview("");
                  }}
                  disabled={saving}
                >
                  <Trash2 size={18} /> Quitar
                </button>
              </div>

              <div className="rc-account-hint"></div>
            </div>

            <div className="rc-account-right">
              <div className="rc-field">
                <label>Nombre de usuario</label>
                <input className="rc-input" value={form.username} onChange={onChange("username")} />
              </div>

              <div className="rc-field">
                <label>Nombre completo</label>
                <input className="rc-input" value={form.name} onChange={onChange("name")} />
              </div>

              <div className="rc-field">
                <label>Correo</label>
                <input className="rc-input" value={form.email} disabled />
              </div>

              <div className="rc-field">
                <label>Telefono</label>
                <input className="rc-input" value={form.phone} onChange={onChange("phone")} />
              </div>

              <div className="rc-modal-actions">
                <button className="rc-secondary-btn" onClick={onClose} disabled={saving}>
                  Cancelar
                </button>
                <button className="rc-pill-btn" onClick={saveProfile} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "security" && (
          <div className="rc-security">
            <div className="rc-field">
              <label>Password actual</label>
              <input
                type="password"
                className="rc-input"
                value={pw.currentPassword}
                onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))}
              />
            </div>

            <div className="rc-field">
              <label>Password nuevo</label>
              <input
                type="password"
                className="rc-input"
                value={pw.newPassword}
                onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))}
              />
            </div>

            <div className="rc-field">
              <label>Confirmar password</label>
              <input
                type="password"
                className="rc-input"
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              />
            </div>

            <div className="rc-modal-actions">
              <button className="rc-secondary-btn" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button className="rc-pill-btn" onClick={savePassword} disabled={saving}>
                <KeyRound size={18} /> {saving ? "Guardando..." : "Cambiar password"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
