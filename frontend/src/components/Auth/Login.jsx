import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";
import { loginUser, loginWithGoogle } from "../../services/auth";

import geoIcon from "../../assets/feature-icons/geolocalizacion.png";
import alertIcon from "../../assets/feature-icons/alertas.png";
import communityIcon from "../../assets/feature-icons/comunidad.png";

function Login() {
  const navigate = useNavigate();
  const googleBtnRef = useRef(null);

  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name] || errors.general) {
      setErrors({});
    }
  };

  const goToDashboard = () => {
    setLeaving(true);
    setTimeout(() => {
      navigate("/", { replace: true });
    }, 280);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    const newErrors = {};

    if (!formData.identifier) {
      newErrors.identifier = "El correo o nombre de usuario es requerido";
    }

    if (!formData.password) {
      newErrors.password = "La contrasena es requerida";
    } else if (formData.password.length < 6) {
      newErrors.password = "La contrasena debe tener al menos 6 caracteres";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const response = await loginUser(formData.identifier, formData.password);

      if (!response?.token) {
        throw new Error("No se recibio token de autenticacion");
      }

      localStorage.setItem("token", response.token);

      if (response?.user) {
        localStorage.setItem("user", JSON.stringify(response.user));
      } else {
        localStorage.setItem(
          "user",
          JSON.stringify({ identifier: formData.identifier })
        );
      }

      if (rememberMe) {
        localStorage.setItem("rememberMe", "true");
      } else {
        localStorage.removeItem("rememberMe");
      }

      setLoginSuccess(true);
      setLoading(false);

      setTimeout(() => {
        goToDashboard();
      }, 420);
    } catch (error) {
      setErrors({
        general:
          error.message ||
          "Error al iniciar sesion. Verifica tus credenciales.",
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
      console.warn("Falta VITE_GOOGLE_CLIENT_ID");
      return;
    }

    const initGoogle = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) {
        return false;
      }

      googleBtnRef.current.innerHTML = "";

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp) => {
          try {
            const idToken = resp?.credential;
            if (!idToken) {
              throw new Error("No se recibio credential de Google");
            }

            setLoading(true);
            setErrors({});

            const response = await loginWithGoogle(idToken);

            if (!response?.token) {
              throw new Error("No se recibio token de autenticacion");
            }

            localStorage.setItem("token", response.token);
            localStorage.setItem("user", JSON.stringify(response.user || {}));

            if (rememberMe) {
              localStorage.setItem("rememberMe", "true");
            } else {
              localStorage.removeItem("rememberMe");
            }

            setLoginSuccess(true);
            setLoading(false);

            setTimeout(() => {
              goToDashboard();
            }, 420);
          } catch (error) {
            setErrors({
              general: error.message || "Error al iniciar sesion con Google",
            });
            setLoading(false);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: 360,
        logo_alignment: "left",
      });

      return true;
    };

    if (initGoogle()) return;

    const interval = setInterval(() => {
      if (initGoogle()) {
        clearInterval(interval);
      }
    }, 250);

    setTimeout(() => clearInterval(interval), 10000);

    return () => clearInterval(interval);
  }, [rememberMe, navigate]);

  const handleSocialLogin = (provider) => {
    alert(`Login con ${provider} - Funcionalidad por implementar`);
  };

  return (
    <div className={`radar-login-container ${leaving ? "is-leaving" : ""}`}>
      <div className="radar-split">
        <section className="radar-hero-section">
          <div className="radar-hero-content">
            <div className="radar-logo-wrapper">
              <div className="logo-circle-outer">
                <div className="logo-circle-inner">
                  <svg className="logo-shield" viewBox="0 0 100 100" aria-hidden="true">
                    <defs>
                      <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#60A5FA" />
                        <stop offset="100%" stopColor="#3B82F6" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M50 20 L80 30 L80 50 C80 65 65 75 50 78 C35 75 20 65 20 50 L20 30 Z"
                      fill="url(#shieldGradient)"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M35 50 L44 42 L48 54 L56 36 L65 50"
                      stroke="#ffffff"
                      strokeWidth="4"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="wave-animation"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <h1 className="radar-main-title">Radar Ciudadano</h1>
            <p className="radar-main-subtitle">
              Accede a tu cuenta para reportar incidentes
            </p>

            <div className="radar-map-box">
              <div className="radar-point point-1">
                <div className="point-marker">
                  <span className="marker-emoji">🚨</span>
                </div>
              </div>

              <div className="radar-point point-2">
                <div className="point-marker">
                  <span className="marker-emoji">🚗</span>
                </div>
              </div>

              <div className="radar-point point-3">
                <div className="point-marker">
                  <span className="marker-emoji">⚠️</span>
                </div>
              </div>

              <div className="radar-point point-4">
                <div className="point-marker">
                  <span className="marker-emoji">📍</span>
                </div>
              </div>

              <div className="radar-waves">
                <div className="wave-ring ring-1"></div>
                <div className="wave-ring ring-2"></div>
                <div className="wave-ring ring-3"></div>
              </div>
            </div>

            <div className="radar-features-grid">
              <div className="feature-card-radar">
                <div className="feature-icon-3d">
                  <img className="feature-illustration" src={geoIcon} alt="Geolocalizacion" />
                </div>
                <h3 className="feature-title">Geolocalizacion</h3>
                <p className="feature-description">Marca incidentes con precision</p>
              </div>

              <div className="feature-card-radar">
                <div className="feature-icon-3d">
                  <img className="feature-illustration" src={alertIcon} alt="Alertas en tiempo real" />
                </div>
                <h3 className="feature-title">Alertas en Tiempo Real</h3>
                <p className="feature-description">Recibe notificaciones inmediatas</p>
              </div>

              <div className="feature-card-radar">
                <div className="feature-icon-3d">
                  <img className="feature-illustration" src={communityIcon} alt="Comunidad activa" />
                </div>
                <h3 className="feature-title">Comunidad Activa</h3>
                <p className="feature-description">Colabora con tus vecinos</p>
              </div>
            </div>
          </div>
        </section>

        <section className="radar-form-section">
          <div className="form-box-radar">
            <div className="form-header-radar">
              <h2>Iniciar sesion</h2>
              <p>Ingresa con tu cuenta para continuar</p>
            </div>

            {errors.general && (
              <div className="alert-error">
                <span>!</span>
                {errors.general}
              </div>
            )}

            {loginSuccess && (
              <div className="alert-success">
                <span>✓</span>
                Inicio de sesion exitoso
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form-radar">
              <div className="input-group-radar">
                <label htmlFor="identifier">Correo o nombre de usuario</label>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  className={`input-radar ${errors.identifier ? "input-error" : ""}`}
                  value={formData.identifier}
                  onChange={handleChange}
                  placeholder="Correo o nombre de usuario"
                  autoComplete="username"
                  disabled={loading}
                />
                {errors.identifier && <span className="error-msg">{errors.identifier}</span>}
              </div>

              <div className="input-group-radar">
                <label htmlFor="password">Contrasena</label>
                <div className="password-input-wrapper">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    className={`input-radar ${errors.password ? "input-error" : ""}`}
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Tu contrasena"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={loading}
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                {errors.password && <span className="error-msg">{errors.password}</span>}
              </div>

              <div className="login-options-radar">
                <label className="remember-me-radar">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={loading}
                  />
                  <span>Recordarme</span>
                </label>

                <Link className="forgot-link-radar" to="/forgot-password">
                  Olvidaste tu contrasena
                </Link>
              </div>

              <button type="submit" className="btn-login-radar" disabled={loading}>
                {loading ? "Ingresando..." : "Iniciar sesion"}
              </button>
            </form>

            <div className="divider-radar">
              <span>o continua con</span>
            </div>

            <div className="social-login-radar">
              <div
                id="googleBtn"
                ref={googleBtnRef}
                className="google-login-mount"
                style={{ width: "100%" }}
              />
            </div>

            <div className="register-link-radar">
              <span>No tienes cuenta? </span>
              <Link to="/register">Crear cuenta</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;