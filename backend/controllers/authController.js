const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

const pool = require("../config/database");
const transporter = require("../config/mailer");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function generarToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function normalizarUsuario(user) {
  return {
    id: user.id,
    name: user.name || "",
    email: user.email,
    role: user.role || "user",
    username: user.username || "",
    phone: user.phone || "",
    full_name: user.full_name || "",
    has_photo: !!user.photo_data,
    photo_path: user.photo_path || null,
  };
}

function validarPasswordSegura(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password) &&
    !/\s/.test(password)
  );
}

exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.query;

    if (!username || !String(username).trim()) {
      return res.json({ success: true, exists: false });
    }

    const usernameLimpio = String(username).trim().toLowerCase();

    const result = await pool.query(
      `SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [usernameLimpio]
    );

    return res.json({
      success: true,
      exists: result.rows.length > 0,
    });
  } catch (error) {
    console.error("Error checkUsername:", error);
    return res.status(500).json({
      success: false,
      exists: false,
      message: "Error al verificar nombre de usuario",
      error: error.message,
    });
  }
};

exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      username = null,
      phone = null,
      full_name = null,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Nombre, correo y contrasena son obligatorios",
      });
    }

    if (!validarPasswordSegura(password)) {
      return res.status(400).json({
        success: false,
        message: "La contrasena no cumple con los requisitos de seguridad",
      });
    }

    const emailLimpio = String(email).trim().toLowerCase();
    const usernameLimpio = username ? String(username).trim().toLowerCase() : null;

    const existeCorreo = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [emailLimpio]
    );

    if (existeCorreo.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "El correo ya esta registrado",
      });
    }

    if (usernameLimpio) {
      const existeUsername = await pool.query(
        `SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
        [usernameLimpio]
      );

      if (existeUsername.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "El nombre de usuario ya esta en uso",
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users (
        name,
        email,
        password,
        role,
        username,
        phone,
        full_name,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, 'user', $4, $5, $6, true, NOW(), NOW())
      RETURNING id, name, email, role, username, phone, full_name, photo_path, photo_data
      `,
      [name, emailLimpio, hashedPassword, usernameLimpio, phone, full_name]
    );

    const user = result.rows[0];
    const token = generarToken({
      id: user.id,
      email: user.email,
      role: user.role || "user",
    });

    return res.status(201).json({
      success: true,
      message: "Usuario registrado correctamente",
      token,
      user: normalizarUsuario(user),
    });
  } catch (error) {
    console.error("Error en register:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno al registrar usuario",
      error: error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { identifier, email, password } = req.body;

    const loginValue = String(identifier || email || "").trim();

    if (!loginValue || !password) {
      return res.status(400).json({
        success: false,
        message: "Correo o nombre de usuario y contrasena son obligatorios",
      });
    }

    const loginValueLower = loginValue.toLowerCase();

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        password,
        role,
        username,
        phone,
        full_name,
        photo_path,
        photo_data,
        is_active
      FROM users
      WHERE LOWER(email) = LOWER($1)
         OR LOWER(username) = LOWER($1)
      LIMIT 1
      `,
      [loginValueLower]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Credenciales invalidas",
      });
    }

    const user = result.rows[0];

    if (user.is_active === false) {
      return res.status(403).json({
        success: false,
        message: "Tu cuenta esta desactivada",
      });
    }

    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: "Esta cuenta no tiene contrasena local. Usa Google o recupera tu contrasena.",
      });
    }

    const passwordValida = await bcrypt.compare(password, user.password);

    if (!passwordValida) {
      return res.status(401).json({
        success: false,
        message: "Credenciales invalidas",
      });
    }

    const token = generarToken({
      id: user.id,
      email: user.email,
      role: user.role || "user",
    });

    return res.json({
      success: true,
      message: "Inicio de sesion exitoso",
      token,
      user: normalizarUsuario(user),
    });
  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno al iniciar sesion",
      error: error.message,
    });
  }
};

exports.oauthGoogle = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "No se recibio el token de Google",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return res.status(401).json({
        success: false,
        message: "Google token invalido",
      });
    }

    const email = String(payload.email).trim().toLowerCase();
    const nombreGoogle = payload.name || payload.given_name || "Usuario Google";

    let result = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        role,
        username,
        phone,
        full_name,
        photo_path,
        photo_data,
        is_active
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email]
    );

    let user = result.rows[0];

    if (!user) {
      const inserted = await pool.query(
        `
        INSERT INTO users (
          name,
          email,
          password,
          role,
          username,
          phone,
          full_name,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1, $2, NULL, 'user', NULL, NULL, $3, true, NOW(), NOW())
        RETURNING
          id,
          name,
          email,
          role,
          username,
          phone,
          full_name,
          photo_path,
          photo_data,
          is_active
        `,
        [nombreGoogle, email, nombreGoogle]
      );

      user = inserted.rows[0];
    }

    if (user.is_active === false) {
      return res.status(403).json({
        success: false,
        message: "Tu cuenta esta desactivada",
      });
    }

    const token = generarToken({
      id: user.id,
      email: user.email,
      role: user.role || "user",
    });

    return res.json({
      success: true,
      message: "Inicio de sesion con Google exitoso",
      token,
      user: normalizarUsuario(user),
    });
  } catch (error) {
    console.error("Error en oauthGoogle:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno al autenticar con Google",
      error: error.message,
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "El correo es obligatorio",
      });
    }

    const emailLimpio = String(email).trim().toLowerCase();

    const result = await pool.query(
      `SELECT id, name, email FROM users WHERE email = $1 LIMIT 1`,
      [emailLimpio]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: "Si el correo existe, se enviaron instrucciones de recuperacion",
      });
    }

    const user = result.rows[0];
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await pool.query(
      `
      UPDATE users
      SET reset_password_token = $1,
          reset_password_expires = $2,
          updated_at = NOW()
      WHERE id = $3
      `,
      [token, expiresAt, user.id]
    );

    const frontendBase = (
      process.env.FRONTEND_URL || "http://localhost:5173"
    ).replace(/\/+$/, "");
    const resetLink = `${frontendBase}/reset-password?token=${token}`;

    const { data, error } = await transporter.emails.send({
      from: process.env.EMAIL_FROM || "Radar Ciudadano <onboarding@resend.dev>",
      to: [user.email],
      subject: "Recuperacion de contrasena - Radar Ciudadano",
      html: `
        <div style="font-family: Arial, sans-serif; background:#f8fafc; padding:24px;">
          <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:18px; overflow:hidden; border:1px solid #e2e8f0;">
            <div style="padding:24px; background:linear-gradient(90deg,#7390ff,#5e36db); color:#ffffff;">
              <h2 style="margin:0;">Radar Ciudadano</h2>
              <p style="margin:8px 0 0;">Recuperacion de contrasena</p>
            </div>
            <div style="padding:24px; color:#334155;">
              <p>Hola ${user.name || "usuario"},</p>
              <p>Recibimos una solicitud para restablecer tu contrasena.</p>
              <p>
                <a href="${resetLink}" style="display:inline-block; padding:12px 18px; background:#5e36db; color:#ffffff; text-decoration:none; border-radius:12px; font-weight:700;">
                  Restablecer contrasena
                </a>
              </p>
              <p>Este enlace expirara en 30 minutos.</p>
              <p>Si tu no solicitaste este cambio, ignora este mensaje.</p>
            </div>
          </div>
        </div>
      `,
    });

    if (error) {
      throw new Error(error.message || "No se pudo enviar el correo");
    }

    return res.json({
      success: true,
      message: "Si el correo existe, se enviaron instrucciones de recuperacion",
    });
  } catch (error) {
    console.error("Error en forgotPassword:", error);
    return res.status(500).json({
      success: false,
      message: "Error al procesar recuperacion de contrasena",
      error: error.message,
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Token y contrasena son obligatorios",
      });
    }

    if (!validarPasswordSegura(password)) {
      return res.status(400).json({
        success: false,
        message: "La contrasena no cumple con los requisitos de seguridad",
      });
    }

    const result = await pool.query(
      `
      SELECT id
      FROM users
      WHERE reset_password_token = $1
        AND reset_password_expires IS NOT NULL
        AND reset_password_expires > NOW()
      LIMIT 1
      `,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "El enlace de recuperacion es invalido o ya expiro",
      });
    }

    const userId = result.rows[0].id;
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `
      UPDATE users
      SET password = $1,
          reset_password_token = NULL,
          reset_password_expires = NULL,
          updated_at = NOW()
      WHERE id = $2
      `,
      [hashedPassword, userId]
    );

    return res.json({
      success: true,
      message: "Contrasena actualizada correctamente",
    });
  } catch (error) {
    console.error("Error en resetPassword:", error);
    return res.status(500).json({
      success: false,
      message: "Error al restablecer contrasena",
      error: error.message,
    });
  }
};

exports.me = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        role,
        username,
        phone,
        full_name,
        photo_path,
        photo_data,
        is_active
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }

    const user = result.rows[0];

    if (user.is_active === false) {
      return res.status(403).json({
        success: false,
        message: "Tu cuenta esta desactivada",
      });
    }

    return res.json({
      success: true,
      user: normalizarUsuario(user),
    });
  } catch (error) {
    console.error("Error en me:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno al obtener usuario",
      error: error.message,
    });
  }
};