import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../../services/auth";
import "./Login.css";

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    phone: "",
    username: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const sanitizePhoneInput = (value) => value.replace(/\D/g, "").slice(0, 10);

  const canSubmit = useMemo(() => {
    return (
      formData.email &&
      formData.password &&
      formData.confirmPassword &&
      !loading &&
      !ok
    );
  }, [formData, loading, ok]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    const finalValue = name === "phone" ? sanitizePhoneInput(value) : value;

    setFormData((s) => ({ ...s, [name]: finalValue }));
    if (Object.keys(errors).length) setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    const newErrors = {};
    if (!formData.email) newErrors.email = "Email requerido";
    else if (!validateEmail(formData.email)) newErrors.email = "Email invalido";

    if (!formData.password) newErrors.password = "Password requerido";
    else if (formData.password.length < 6)
      newErrors.password = "Minimo 6 caracteres";

    if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = "No coincide";
    }

    if (formData.phone && formData.phone.length !== 10) {
      newErrors.phone = "El telefono debe tener 10 digitos";
    }

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        email: formData.email,
        password: formData.password,
        name: formData.name || null,
        phone: formData.phone || null,
        username: formData.username || null,
      };

      const res = await registerUser(payload);

      if (res?.token) localStorage.setItem("token", res.token);
      if (res?.user) localStorage.setItem("user", JSON.stringify(res.user));

      setOk(true);
      setTimeout(() => navigate("/map", { replace: true }), 700);
    } catch (e2) {
      setErrors({ general: e2?.message || "Error al registrar" });
      setLoading(false);
    }
  };

  return (
    <div className="radar-login-container">
      <div className="radar-split">
        <div className="radar-hero-section">
          <div className="radar-hero-content">
            <h1 className="radar-main-title">Radar Ciudadano</h1>
            <p className="radar-main-subtitle">Crea tu cuenta</p>
          </div>
        </div>

        <div className="radar-form-section">
          <div className="form-box-radar">
            <div className="form-header-radar">
              <h2>Registro</h2>
              <p>Completa tus datos</p>
            </div>

            {errors.general && (
              <div className="alert-error">
                <span>!</span>
                {errors.general}
              </div>
            )}

            {ok && (
              <div className="alert-success">
                <span>✓</span>
                Cuenta creada. Entrando...
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form-radar">
              <div className="input-group-radar">
                <label>Email</label>
                <input
                  className={`input-radar ${errors.email ? "input-error" : ""}`}
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading}
                />
                {errors.email && <span className="error-msg">{errors.email}</span>}
              </div>

              <div className="input-group-radar">
                <label>Password</label>
                <input
                  type="password"
                  className={`input-radar ${errors.password ? "input-error" : ""}`}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={loading}
                />
                {errors.password && (
                  <span className="error-msg">{errors.password}</span>
                )}
              </div>

              <div className="input-group-radar">
                <label>Confirmar</label>
                <input
                  type="password"
                  className={`input-radar ${errors.confirmPassword ? "input-error" : ""}`}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={loading}
                />
                {errors.confirmPassword && (
                  <span className="error-msg">{errors.confirmPassword}</span>
                )}
              </div>

              <div className="input-group-radar">
                <label>Nombre completo</label>
                <input
                  className="input-radar"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>

              <div className="input-group-radar">
                <label>Nombre de usuario</label>
                <input
                  className="input-radar"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>

              <div className="input-group-radar">
                <label>Telefono</label>
                <input
                  className={`input-radar ${errors.phone ? "input-error" : ""}`}
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="3331234567"
                  disabled={loading}
                />
                {errors.phone && <span className="error-msg">{errors.phone}</span>}
              </div>

              <button
                type="submit"
                className={`btn-login-radar ${ok ? "success" : ""}`}
                disabled={!canSubmit}
              >
                {loading ? "Creando..." : ok ? "✓ Listo" : "Crear cuenta"}
              </button>
            </form>

            <div className="register-link-radar">
              ¿Ya tienes cuenta? <Link to="/login">Inicia sesion</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;