import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import zxcvbn from "zxcvbn";
import { resetPassword } from "../../services/auth";
import "./Login.css";

function validarPassword(password) {
  return {
    longitud: password.length >= 8,
    mayuscula: /[A-Z]/.test(password),
    minuscula: /[a-z]/.test(password),
    numero: /[0-9]/.test(password),
    simbolo: /[^A-Za-z0-9]/.test(password),
    sinEspacios: !/\s/.test(password),
  };
}

function getStrengthLabel(score) {
  switch (score) {
    case 0:
      return "Muy debil";
    case 1:
      return "Debil";
    case 2:
      return "Aceptable";
    case 3:
      return "Buena";
    case 4:
      return "Muy segura";
    default:
      return "Muy debil";
  }
}

function getStrengthClass(score) {
  switch (score) {
    case 0:
      return "strength-0";
    case 1:
      return "strength-1";
    case 2:
      return "strength-2";
    case 3:
      return "strength-3";
    case 4:
      return "strength-4";
    default:
      return "strength-0";
  }
}

function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const token = params.get("token") || "";

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");

  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  const reglasPassword = useMemo(() => validarPassword(p1), [p1]);
  const passwordStrength = useMemo(() => zxcvbn(p1 || ""), [p1]);
  const passwordScore = passwordStrength.score;

  const passwordValida =
    Object.values(reglasPassword).every(Boolean) && passwordScore >= 2;

  const passwordsCoinciden = p2.length > 0 && p1 === p2;

  const canSubmit = useMemo(() => {
    return (
      !!token &&
      !!p1 &&
      !!p2 &&
      passwordValida &&
      passwordsCoinciden &&
      !loading &&
      !ok
    );
  }, [token, p1, p2, passwordValida, passwordsCoinciden, loading, ok]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!token) {
      setErr("Token faltante. Abre el enlace completo del correo.");
      return;
    }

    if (!passwordValida) {
      setErr("La contrasena no cumple con los requisitos de seguridad.");
      return;
    }

    if (!passwordsCoinciden) {
      setErr("La confirmacion no coincide.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, p1);
      setOk(true);

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
            <p className="radar-main-subtitle">Define una nueva contrasena</p>
          </div>
        </div>

        <div className="radar-form-section">
          <div className="form-box-radar">
            <div className="form-header-radar">
              <h2>Nueva contrasena</h2>
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
                Contrasena actualizada. Redirigiendo...
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form-radar">
              <div className="input-group-radar">
                <label htmlFor="p1">Nueva contrasena</label>
                <input
                  id="p1"
                  type="password"
                  className="input-radar"
                  value={p1}
                  onChange={(e) => setP1(e.target.value)}
                  disabled={loading || ok}
                  placeholder="Tu nueva contrasena"
                  autoComplete="new-password"
                />

                {p1 && (
                  <div className="password-strength-box" style={{ marginTop: 10 }}>
                    <div className="password-strength-top">
                      <span>Seguridad</span>
                      <span className={`strength-text ${getStrengthClass(passwordScore)}`}>
                        {getStrengthLabel(passwordScore)}
                      </span>
                    </div>

                    <div className="strength-bar-track">
                      <div
                        className={`strength-bar-fill ${getStrengthClass(passwordScore)}`}
                        style={{ width: `${((passwordScore + 1) / 5) * 100}%` }}
                      />
                    </div>

                    <ul className="password-rules">
                      <li className={reglasPassword.longitud ? "ok" : ""}>
                        Minimo 8 caracteres
                      </li>
                      <li className={reglasPassword.mayuscula ? "ok" : ""}>
                        Una mayuscula
                      </li>
                      <li className={reglasPassword.minuscula ? "ok" : ""}>
                        Una minuscula
                      </li>
                      <li className={reglasPassword.numero ? "ok" : ""}>
                        Un numero
                      </li>
                      <li className={reglasPassword.simbolo ? "ok" : ""}>
                        Un simbolo
                      </li>
                      <li className={reglasPassword.sinEspacios ? "ok" : ""}>
                        Sin espacios
                      </li>
                    </ul>
                  </div>
                )}
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
                  placeholder="Repite tu nueva contrasena"
                  autoComplete="new-password"
                />

                {p2.length > 0 && (
                  <span className={`error-msg ${passwordsCoinciden ? "" : ""}`}>
                    {passwordsCoinciden
                      ? "Las contrasenas coinciden"
                      : "La confirmacion no coincide"}
                  </span>
                )}
              </div>

              <button
                type="submit"
                className={`btn-login-radar ${ok ? "success" : ""}`}
                disabled={!canSubmit}
              >
                {loading ? "Actualizando..." : ok ? "✓ Listo" : "Actualizar contrasena"}
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