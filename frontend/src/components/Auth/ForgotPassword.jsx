import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../../services/auth";
import "./Login.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    const clean = String(email || "").trim();

    if (!clean) {
      setErr("Email requerido");
      return;
    }
    if (!validateEmail(clean)) {
      setErr("Email invalido");
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPassword(clean);

      // El backend responde mensaje generico por seguridad
      setMsg(res?.message || "Si el correo existe, se envio un link de recuperacion");
    } catch (e2) {
      setErr(e2?.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="radar-login-container">
      <div className="radar-split">
        {/* Lado izquierdo (hero) */}
        <div className="radar-hero-section">
          <div className="radar-hero-content">
            <h1 className="radar-main-title">Radar Ciudadano</h1>
            <p className="radar-main-subtitle">Recupera acceso a tu cuenta</p>
          </div>
        </div>

        {/* Lado derecho (form) */}
        <div className="radar-form-section">
          <div className="form-box-radar">
            <div className="form-header-radar">
              <h2>Recuperar password</h2>
              <p>Te enviaremos un enlace al correo</p>
            </div>

            {err && (
              <div className="alert-error">
                <span>!</span>
                {err}
              </div>
            )}

            {msg && (
              <div className="alert-success">
                <span>✓</span>
                {msg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form-radar">
              <div className="input-group-radar">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  className={`input-radar ${err ? "input-error" : ""}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  placeholder="tu@email.com"
                  autoComplete="email"
                />
              </div>

              <button type="submit" className="btn-login-radar" disabled={loading}>
                {loading ? "Enviando..." : "Enviar enlace"}
              </button>
            </form>

            <div className="register-link-radar">
              <Link to="/login">Volver a login</Link>
              {"  "} | {"  "}
              <Link to="/register">Crear cuenta</Link>
            </div>

            <div className="register-link-radar" style={{ margingintop: 8 }}>
              Tip: En modo dev, el backend imprime el link en la consola o lo regresa como resetLink.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
