import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Login.css';
import { loginUser, loginWithGoogle } from '../../services/auth';

// ✅ Nuevos iconos (asegúrate de ponerlos en: src/assets/feature-icons/)
import geoIcon from '../../assets/feature-icons/geolocalizacion.png';
import alertIcon from '../../assets/feature-icons/alertas.png';
import communityIcon from '../../assets/feature-icons/comunidad.png';

function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    if (errors[name] || errors.general) {
      setErrors({});
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Limpiar errores previos
    setErrors({});

    // Validaciones del frontend
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = 'El email es requerido';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Iniciar proceso de login
    setLoading(true);

    try {
      // Llamar a la API real
      const response = await loginUser(formData.email, formData.password);

      // ✅ Guardar token SIEMPRE (para PrivateRoute y API protegida)
      if (response?.token) {
        localStorage.setItem('token', response.token);
      } else {
        throw new Error('No se recibió token de autenticación');
      }

      // ✅ Guardar user SIEMPRE (para mostrar datos en dashboard)
      if (response?.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
      } else {
        localStorage.setItem('user', JSON.stringify({ email: formData.email }));
      }

      // ✅ rememberMe solo como preferencia
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('rememberMe');
      }

      // Login exitoso
      setLoginSuccess(true);

      // Redirigir al dashboard/mapa
      setTimeout(() => {
        navigate('/map', { replace: true });
      }, 800);

    } catch (error) {
      setErrors({
        general: error.message || 'Error al iniciar sesión. Verifica tus credenciales.'
      });
      setLoading(false);
    }
  };

  // ✅ Render del boton oficial de Google dentro de tu contenedor (sin romper diseño)
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) return; // si falta env, no hacemos nada
    if (!window.google?.accounts?.id) return; // si aun no carga GSI, no hacemos nada

    const btn = document.getElementById('googleBtn');
    if (!btn) return;

    // Evita duplicarlo si React re-renderiza
    btn.innerHTML = '';

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (resp) => {
        try {
          const idToken = resp?.credential;
          if (!idToken) throw new Error('No se recibio credential de Google');

          setLoading(true);
          setErrors({});

          const r = await loginWithGoogle(idToken);

          // Guarda token/user como en login normal
          localStorage.setItem('token', r.token);
          localStorage.setItem('user', JSON.stringify(r.user));

          // Respeta rememberMe
          if (rememberMe) localStorage.setItem('rememberMe', 'true');
          else localStorage.removeItem('rememberMe');

          setLoginSuccess(true);
          setTimeout(() => {
            navigate('/map', { replace: true });
          }, 800);

        } catch (e2) {
          setErrors({ general: e2.message || 'Error con Google' });
          setLoading(false);
        }
      },
    });

    // Renderiza el boton oficial dentro de tu bloque con estilos consistentes
    window.google.accounts.id.renderButton(btn, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: btn.offsetWidth || 360,
      logo_alignment: 'left'
    });

  }, [navigate, rememberMe]);

  const handleSocialLogin = async (provider) => {
    // Apple: por ahora placeholder (gratis no hay login real con Apple)
    alert(`Login con ${provider} - Funcionalidad por implementar`);
  };

  return (
    <div className="radar-login-container">
      <div className="radar-split">
        {/* HERO - LADO IZQUIERDO */}
        <div className="radar-hero-section">
          <div className="radar-hero-content">

            {/* Logo con círculo doble */}
            <div className="radar-logo-wrapper">
              <div className="logo-circle-outer">
                <div className="logo-circle-inner">
                  <svg className="logo-shield" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#60A5FA" />
                        <stop offset="100%" stopColor="#3B82F6" />
                      </linearGradient>
                    </defs>
                    <path d="M50 20 L80 30 L80 50 C80 65 65 75 50 78 C35 75 20 65 20 50 L20 30 Z"
                          fill="url(#shieldGradient)"
                          stroke="#ffffff"
                          strokeWidth="2.5"/>
                    <path d="M35 50 L44 42 L48 54 L56 36 L65 50"
                          stroke="#ffffff"
                          strokeWidth="4"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="wave-animation"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Título y Subtítulo */}
            <h1 className="radar-main-title">Radar Ciudadano</h1>
            <p className="radar-main-subtitle">Reporta y consulta incidentes en tiempo real en tu comunidad</p>

            {/* Mapa con Círculos Radar */}
            <div className="radar-map-box">

              {/* Marcador 1 - Alerta (Arriba Izquierda) */}
              <div className="radar-point" style={{top: '22%', left: '28%'}}>
                <div className="radar-waves">
                  <div className="wave-ring ring-1"></div>
                  <div className="wave-ring ring-2"></div>
                  <div className="wave-ring ring-3"></div>
                </div>
                <div className="point-marker">
                  <span className="marker-emoji">🚨</span>
                </div>
              </div>

              {/* Marcador 2 - Auto (Arriba Derecha) */}
              <div className="radar-point" style={{top: '32%', right: '22%'}}>
                <div className="radar-waves">
                  <div className="wave-ring ring-1"></div>
                  <div className="wave-ring ring-2"></div>
                  <div className="wave-ring ring-3"></div>
                </div>
                <div className="point-marker">
                  <span className="marker-emoji">🚗</span>
                </div>
              </div>

              {/* Marcador 3 - Advertencia (Centro) */}
              <div className="radar-point" style={{top: '48%', left: '42%'}}>
                <div className="radar-waves">
                  <div className="wave-ring ring-1"></div>
                  <div className="wave-ring ring-2"></div>
                  <div className="wave-ring ring-3"></div>
                </div>
                <div className="point-marker">
                  <span className="marker-emoji">⚠️</span>
                </div>
              </div>

              {/* Marcador 4 - Ubicación (Abajo Izquierda) */}
              <div className="radar-point" style={{bottom: '28%', left: '18%'}}>
                <div className="radar-waves">
                  <div className="wave-ring ring-1"></div>
                  <div className="wave-ring ring-2"></div>
                  <div className="wave-ring ring-3"></div>
                </div>
                <div className="point-marker">
                  <span className="marker-emoji">📍</span>
                </div>
              </div>

            </div>

            {/* ✅ Features Cards con nuevas ilustraciones (sin romper el diseño) */}
            <div className="radar-features-grid">

              <div className="feature-card-radar">
                <div className="feature-icon-3d">
                  <img className="feature-illustration" src={geoIcon} alt="Geolocalizacion" />
                </div>
                <h3 className="feature-title">Geolocalización</h3>
                <p className="feature-description">Marca incidentes con precisión</p>
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
        </div>

        {/* FORMULARIO - LADO DERECHO */}
        <div className="radar-form-section">
          <div className="form-box-radar">

            <div className="form-header-radar">
              <h2>Iniciar Sesión</h2>
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
                <label htmlFor="email">Email</label>
                <input
                  type="text"
                  id="email"
                  name="email"
                  className={`input-radar ${errors.email ? 'input-error' : ''}`}
                  placeholder="tu@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading}
                  autoComplete="email"
                />
                {errors.email && <span className="error-msg">{errors.email}</span>}
              </div>

              <div className="input-group-radar">
                <label htmlFor="password">Contraseña</label>
                <div className="input-with-icon">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    className={`input-radar ${errors.password ? 'input-error' : ''}`}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {errors.password && <span className="error-msg">{errors.password}</span>}
              </div>

              <div className="form-options-radar">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Recuérdame</span>
                </label>

                <Link to="/forgot-password" className="link-forgot">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <button
                type="submit"
                className={`btn-login-radar ${loginSuccess ? 'success' : ''}`}
                disabled={loading || loginSuccess}
              >
                {loading ? 'Iniciando sesión...' : loginSuccess ? '✓ Éxito' : 'Iniciar Sesión'}
              </button>
            </form>

            <div className="divider-radar">o continúa con</div>

            <div className="social-buttons-radar">
              {/* ✅ Google real (renderButton en useEffect) */}
              <div className="btn-social google" style={{ padding: 0 }}>
                <div id="googleBtn" style={{ width: '100%' }}></div>
              </div>

              <button
                type="button"
                className="btn-social apple"
                onClick={() => handleSocialLogin('Apple')}
              >
                <svg viewBox="0 0 24 24" className="social-svg">
                  <path d="M17.05 20.28c-.98.95-2.05.80-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.20.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.80 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.40 1.80-3.12 1.87-2.38 5.98.48 7.13-.57 1.50-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.50-3.74 4.25z"/>
                </svg>
                Continuar con Apple
              </button>
            </div>

            <div className="register-link-radar">
              ¿No tienes cuenta? <Link to="/register">Regístrate</Link>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default Login;
