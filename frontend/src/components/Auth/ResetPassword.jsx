import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../../services/auth";
import "./Login.css";

function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const token = params.get("token") || "";

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");

  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  const canSubmit = useMemo(() => {
    return token && p1 && p2 && p1.length >= 6 && p1 === p2 && !loading && !ok;
  }, [token, p1, p2, loading, ok]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!token) {
      setErr("Token faltante. Abre el enlace completo del correo.");
      return;
    }

    if (String(p1).length < 6) {
      setErr("Minimo 6 caracteres.");
      return;
    }

    if (p1 !== p2) {
      setErr("La confirmacion no coincide.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, p1);
      setOk(true);

      // redirige a login despues de un momento
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 900);
    } catch (e2) {
      setErr(e2?.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="radar-login-container">
      <div className="radar-split">
        <div className="radar-hero-section">
          <div className="radar-hero-content">
            <h1 className="radar-main-title">Radar Ciudadano</h1>
            <p className="radar-main-subtitle">Define un nuevo password</p>
          </div>
        </div>

        <div className="radar-form-section">
          <div className="form-box-radar">
            <div className="form-header-radar">
              <h2>Nuevo password</h2>
              <p>{token ? "Token detectado" : "Token no detectado"}</p>
            </div>

            {err && (
              <div className="alert-error">
                <span>!</span>
                {err}
              </div>
            )}

            {ok && (
              <div className="alert-success">
                <span>✓</span>
                Password actualizado. Redirigiendo...
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form-radar">
              <div className="input-group-radar">
                <label htmlFor="p1">Nuevo password</label>
                <input
                  id="p1"
                  type="password"
                  className="input-radar"
                  value={p1}
                  onChange={(e) => setP1(e.target.value)}
                  disabled={loading || ok}
                  placeholder="minimo 6 caracteres"
                  autoComplete="new-password"
                />
              </div>

              <div className="input-group-radar">
                <label htmlFor="p2">Confirmar</label>
                <input
                  id="p2"
                  type="password"
                  className="input-radar"
                  value={p2}
                  onChange={(e) => setP2(e.target.value)}
                  disabled={loading || ok}
                  placeholder="repite"
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className={`btn-login-radar ${ok ? "success" : ""}`} disabled={!canSubmit}>
                {loading ? "Actualizando..." : ok ? "✓ Listo" : "Actualizar password"}
              </button>
            </form>

            <div className="register-link-radar">
              <Link to="/login">Volver a login</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
