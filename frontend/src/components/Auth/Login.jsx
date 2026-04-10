import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";
import { loginUser, loginWithGoogle } from "../../services/auth";

import geoIcon from "../../assets/feature-icons/geolocalizacion.png";
import alertIcon from "../../assets/feature-icons/alertas.png";
import communityIcon from "../../assets/feature-icons/comunidad.png";

function Login() {
  const navigate = useNavigate();
  const googleBtnRef = useRef(null);
  const rememberMeRef = useRef(false);

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

  useEffect(() => {
    rememberMeRef.current = rememberMe;
  }, [rememberMe]);

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

  const goToDashboard = useCallback(() => {
    setLeaving(true);
    setTimeout(() => {
      navigate("/", { replace: true });
    }, 280);
  }, [navigate]);

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

    if (!clientId) return;

    let cancelled = false;
    let interval = null;
    let timeoutId = null;

    const isInAppBrowser = () => {
      const ua = String(navigator.userAgent || "").toLowerCase();
      return /fban|fbav|instagram|line\/|gsa\//.test(ua);
    };

    const loginGoogleConRetry = async (idToken) => {
      try {
        return await loginWithGoogle(idToken);
      } catch (error) {
        const msg = String(error?.message || "").toLowerCase();
        const transient =
          msg.includes("timeout") ||
          msg.includes("network") ||
          msg.includes("fetch") ||
          msg.includes("500");
        if (!transient) throw error;
        await new Promise((r) => setTimeout(r, 350));
        return loginWithGoogle(idToken);
      }
    };

    const initGoogleButton = () => {
      if (cancelled) return false;
      if (!window.google?.accounts?.id || !googleBtnRef.current) return false;

      googleBtnRef.current.innerHTML = "";

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp) => {
          if (cancelled) return;

          try {
            const idToken = resp?.credential;

            if (!idToken) {
              throw new Error("No se recibio credential de Google");
            }

            setLoading(true);
            setErrors({});

            const response = await loginGoogleConRetry(idToken);

            if (!response?.token) {
              throw new Error("No se recibio token de autenticacion");
            }

            localStorage.setItem("token", response.token);
            localStorage.setItem("user", JSON.stringify(response.user || {}));

            if (rememberMeRef.current) {
              localStorage.setItem("rememberMe", "true");
            } else {
              localStorage.removeItem("rememberMe");
            }

            setLoginSuccess(true);
            setLoading(false);

            setTimeout(() => {
              if (!cancelled) {
                goToDashboard();
              }
            }, 420);
          } catch (error) {
            setErrors({
              general: error.message || "Error al iniciar sesion con Google",
            });
            setLoading(false);
          }
        },
        error_callback: () => {
          setErrors({
            general:
              "Google no pudo completar el login. Revisa dominios autorizados y el Client ID.",
          });
          setLoading(false);
        },
        itp_support: true,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: googleBtnRef.current.offsetWidth || 360,
        logo_alignment: "left",
      });

      if (isInAppBrowser()) {
        setErrors({
          general:
            "Si Google falla dentro de apps (Instagram/Facebook), abre el enlace en Chrome o Safari.",
        });
      }

      return true;
    };

    if (initGoogleButton()) return;

    interval = setInterval(() => {
      if (initGoogleButton()) {
        clearInterval(interval);
      }
    }, 250);

    timeoutId = setTimeout(() => {
      if (interval) clearInterval(interval);
    }, 10000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [goToDashboard]);

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
                  <svg
                    className="logo-shield"
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient
                        id="shieldGradient"
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
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
                  <img
                    className="feature-illustration"
                    src={geoIcon}
                    alt="Geolocalizacion"
                  />
                </div>
                <h3 className="feature-title">Geolocalizacion</h3>
                <p className="feature-description">
                  Marca incidentes con precision
                </p>
              </div>

              <div className="feature-card-radar">
                <div className="feature-icon-3d">
                  <img
                    className="feature-illustration"
                    src={alertIcon}
                    alt="Alertas en tiempo real"
                  />
                </div>
                <h3 className="feature-title">Alertas en Tiempo Real</h3>
                <p className="feature-description">
                  Recibe notificaciones inmediatas
                </p>
              </div>

              <div className="feature-card-radar">
                <div className="feature-icon-3d">
                  <img
                    className="feature-illustration"
                    src={communityIcon}
                    alt="Comunidad activa"
                  />
                </div>
                <h3 className="feature-title">Comunidad Activa</h3>
                <p className="feature-description">
                  Colabora con tus vecinos
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="radar-form-section">
          <div className="form-box-radar">
            <div className="form-header-radar">
              <h2>Iniciar Sesion</h2>
              <p>Accede a tu cuenta para reportar incidentes</p>
            </div>

            {errors.general && (
              <div className="alert-error">
                <span>⚠️</span>
                {errors.general}
              </div>
            )}

            {loginSuccess && (
              <div className="alert-success">
                <span>✓</span>
                ¡Login exitoso! Redirigiendo...
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form-radar">
              <div className="input-group-radar">
                <label htmlFor="identifier">Correo o nombre de usuario</label>
                <input
                  type="text"
                  id="identifier"
                  name="identifier"
                  className={`input-radar ${
                    errors.identifier ? "input-error" : ""
                  }`}
                  placeholder="tu correo o usuario"
                  value={formData.identifier}
                  onChange={handleChange}
                  disabled={loading}
                  autoComplete="username"
                />
                {errors.identifier && (
                  <span className="error-msg">{errors.identifier}</span>
                )}
              </div>

              <div className="input-group-radar">
                <label htmlFor="password">Contrasena</label>
                <div className="input-with-icon">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    className={`input-radar ${
                      errors.password ? "input-error" : ""
                    }`}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword
                        ? "Ocultar contrasena"
                        : "Mostrar contrasena"
                    }
                  >
                    {showPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
                {errors.password && (
                  <span className="error-msg">{errors.password}</span>
                )}
              </div>

              <div className="form-options-radar">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Recuerdame</span>
                </label>

                <Link to="/forgot-password" className="link-forgot">
                  ¿Olvidaste tu contrasena?
                </Link>
              </div>

              <button
                type="submit"
                className={`btn-login-radar ${loginSuccess ? "success" : ""}`}
                disabled={loading || loginSuccess}
              >
                {loading
                  ? "Iniciando sesion..."
                  : loginSuccess
                  ? "✓ Exito"
                  : "Iniciar Sesion"}
              </button>
            </form>

            <div className="divider-radar">o continua con</div>

            <div className="social-buttons-radar">
              <div className="btn-social google-host">
                <div
                  id="googleBtn"
                  ref={googleBtnRef}
                  className="google-btn-slot"
                ></div>
              </div>

              <button
                type="button"
                className="btn-social apple"
                onClick={() => handleSocialLogin("Apple")}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="social-svg"
                  aria-hidden="true"
                >
                  <path d="M17.05 20.28c-.98.95-2.05.80-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.20.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.80 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.40 1.80-3.12 1.87-2.38 5.98.48 7.13-.57 1.50-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.50-3.74 4.25z" />
                </svg>
                Continuar con Apple
              </button>
            </div>

            <div className="register-link-radar">
              ¿No tienes cuenta? <Link to="/register">Registrate</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;
