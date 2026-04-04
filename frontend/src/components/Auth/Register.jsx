import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import zxcvbn from "zxcvbn";
import "./Login.css";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

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

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    username: "",
    phone: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameExists, setUsernameExists] = useState(false);
  const [usernameChecked, setUsernameChecked] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const usernameCheckTimeout = useRef(null);

  const reglasPassword = useMemo(() => validarPassword(form.password), [form.password]);
  const passwordStrength = useMemo(() => zxcvbn(form.password || ""), [form.password]);
  const passwordScore = passwordStrength.score;

  const passwordValida =
    Object.values(reglasPassword).every(Boolean) && passwordScore >= 2;

  const passwordsCoinciden =
    form.confirmPassword.length > 0 && form.password === form.confirmPassword;

  const telefonoValido = /^\d{10}$/.test(form.phone.trim());

  useEffect(() => {
    return () => {
      if (usernameCheckTimeout.current) {
        clearTimeout(usernameCheckTimeout.current);
      }
    };
  }, []);

  const checkUsername = async (username) => {
    const usernameLimpio = String(username || "").trim();

    if (!usernameLimpio) {
      setCheckingUsername(false);
      setUsernameExists(false);
      setUsernameChecked(false);
      return;
    }

    try {
      setCheckingUsername(true);

      const response = await fetch(
        `${API_URL}/auth/check-username?username=${encodeURIComponent(usernameLimpio)}`
      );

      const data = await response.json().catch(() => ({}));

      setUsernameExists(!!data?.exists);
      setUsernameChecked(true);
    } catch (err) {
      console.error("Error verificando username:", err);
      setUsernameExists(false);
      setUsernameChecked(false);
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "phone") {
      const soloNumeros = value.replace(/\D/g, "").slice(0, 10);
      setForm((prev) => ({ ...prev, [name]: soloNumeros }));
      return;
    }

    if (name === "username") {
      setForm((prev) => ({ ...prev, [name]: value }));

      setUsernameChecked(false);
      setUsernameExists(false);

      if (usernameCheckTimeout.current) {
        clearTimeout(usernameCheckTimeout.current);
      }

      usernameCheckTimeout.current = setTimeout(() => {
        checkUsername(value);
      }, 450);

      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const email = form.email.trim();
    const password = form.password;
    const confirmPassword = form.confirmPassword;
    const name = form.name.trim();
    const username = form.username.trim();
    const phone = form.phone.trim();

    if (!email || !password || !confirmPassword || !name || !username || !phone) {
      setError("Completa todos los campos.");
      return;
    }

    if (!telefonoValido) {
      setError("El telefono debe tener 10 digitos.");
      return;
    }

    if (!passwordValida) {
      setError("La contraseña no cumple con los requisitos de seguridad.");
      return;
    }

    if (!passwordsCoinciden) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (checkingUsername) {
      setError("Espera a que termine la verificacion del nombre de usuario.");
      return;
    }

    if (usernameExists) {
      setError("El nombre de usuario ya esta en uso.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          name,
          username,
          phone,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success === false) {
        setError(data?.message || "No se pudo crear la cuenta.");
        return;
      }

      setSuccess("Cuenta creada correctamente. Ahora puedes iniciar sesion.");

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1200);
    } catch (err) {
      console.error("Error al registrar:", err);
      setError("Ocurrio un error al crear la cuenta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-overlay" />

      <div className="register-card">
        <div className="register-header">
          <h1>Radar Ciudadano</h1>
          <p>Crea tu cuenta</p>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">Nombre completo</label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              autoComplete="name"
              placeholder="Tu nombre completo"
            />
          </div>

          <div className="form-group">
            <label htmlFor="username">Nombre de usuario</label>
            <input
              id="username"
              name="username"
              type="text"
              value={form.username}
              onChange={handleChange}
              autoComplete="username"
              placeholder="Tu usuario"
            />

            {form.username.trim().length > 0 && (
              <div
                className={`confirm-password-msg ${
                  checkingUsername
                    ? ""
                    : usernameChecked && !usernameExists
                    ? "ok"
                    : usernameExists
                    ? "error"
                    : ""
                }`}
              >
                {checkingUsername && "Verificando nombre de usuario..."}
                {!checkingUsername && usernameChecked && !usernameExists && "Nombre de usuario disponible"}
                {!checkingUsername && usernameExists && "Ese nombre de usuario ya existe"}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="phone">Telefono</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={handleChange}
              autoComplete="tel"
              placeholder="3331234567"
              maxLength={10}
            />
            {form.phone.length > 0 && !telefonoValido && (
              <div className="confirm-password-msg error">
                El telefono debe tener 10 digitos
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>

            <div className="password-input-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                placeholder="Tu contraseña"
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Ocultar" : "Ver"}
              </button>
            </div>

            {form.password && (
              <div className="password-strength-box">
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

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmar</label>

            <div className="password-input-wrap">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                placeholder="Confirma tu contraseña"
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowConfirmPassword((v) => !v)}
              >
                {showConfirmPassword ? "Ocultar" : "Ver"}
              </button>
            </div>

            {form.confirmPassword.length > 0 && (
              <div className={`confirm-password-msg ${passwordsCoinciden ? "ok" : "error"}`}>
                {passwordsCoinciden
                  ? "Las contraseñas coinciden"
                  : "Las contraseñas no coinciden"}
              </div>
            )}
          </div>

          {error && <div className="register-alert error">{error}</div>}
          {success && <div className="register-alert success">{success}</div>}

          <button
            type="submit"
            className="register-submit"
            disabled={loading || checkingUsername}
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>

          <div className="register-footer">
            ¿Ya tienes cuenta? <Link to="/login">Inicia sesion</Link>
          </div>
        </form>
      </div>
    </div>
  );
}