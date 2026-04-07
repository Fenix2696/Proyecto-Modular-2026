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
  const externalPhoto =
    typeof user.photo_path === "string" && /^https?:\/\//i.test(user.photo_path)
      ? user.photo_path
      : null;
  const photoUrl = user.photo_data
    ? `/api/users/${user.id}/photo`
    : externalPhoto || null;

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
    photo_url: photoUrl,
    avatar: photoUrl,
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

function normalizarFotoGoogle(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;

  const withProtocol = raw.startsWith("//") ? `https:${raw}` : raw;
  if (!/^https?:\/\//i.test(withProtocol)) return null;

  // Evita errores por columnas cortas o valores inesperados
  if (withProtocol.length > 900) return null;

  return withProtocol;
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
    const fotoGoogle = normalizarFotoGoogle(payload.picture);

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
          photo_path,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1, $2, NULL, 'user', NULL, NULL, $3, $4, true, NOW(), NOW())
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
        [nombreGoogle, email, nombreGoogle, fotoGoogle]
      );

      user = inserted.rows[0];
    } else {
      const synced = await pool.query(
        `
        UPDATE users
        SET
          name = CASE
            WHEN (name IS NULL OR BTRIM(name) = '') THEN $1
            ELSE name
          END,
          full_name = CASE
            WHEN (full_name IS NULL OR BTRIM(full_name) = '') THEN $2
            ELSE full_name
          END,
          updated_at = NOW()
        WHERE id = $3
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
        [nombreGoogle, nombreGoogle, user.id]
      );

      if (synced.rows.length > 0) {
        user = synced.rows[0];
      }
    }

    if (
      fotoGoogle &&
      !user.photo_data &&
      (!user.photo_path || String(user.photo_path).trim() === "")
    ) {
      try {
        const photoSync = await pool.query(
          `
          UPDATE users
          SET photo_path = $1,
              updated_at = NOW()
          WHERE id = $2
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
          [fotoGoogle, user.id]
        );

        if (photoSync.rows.length > 0) {
          user = photoSync.rows[0];
        }
      } catch (photoError) {
        console.warn("No se pudo guardar photo_path de Google:", photoError.message);
      }
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

    const userNormalizado = normalizarUsuario({
      ...user,
      photo_path: user.photo_path || fotoGoogle || null,
    });

    return res.json({
      success: true,
      message: "Inicio de sesion con Google exitoso",
      token,
      user: userNormalizado,
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

exports.updateMe = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "No autorizado" });
    }

    const { username, name, phone } = req.body || {};
    const usernameLimpio = username ? String(username).trim().toLowerCase() : null;
    const nombreLimpio = name ? String(name).trim() : null;
    const phoneLimpio = phone ? String(phone).replace(/\D/g, "").slice(0, 10) : null;

    if (phoneLimpio && phoneLimpio.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "El telefono debe tener 10 digitos",
      });
    }

    if (usernameLimpio) {
      const dup = await pool.query(
        `
        SELECT id
        FROM users
        WHERE LOWER(username) = LOWER($1)
          AND id <> $2
        LIMIT 1
        `,
        [usernameLimpio, userId]
      );

      if (dup.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "El nombre de usuario ya esta en uso",
        });
      }
    }

    const updated = await pool.query(
      `
      UPDATE users
      SET
        username = COALESCE($1, username),
        name = COALESCE($2, name),
        full_name = COALESCE($3, full_name),
        phone = COALESCE($4, phone),
        updated_at = NOW()
      WHERE id = $5
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
      [usernameLimpio, nombreLimpio, nombreLimpio, phoneLimpio, userId]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    return res.json({
      success: true,
      message: "Perfil actualizado",
      user: normalizarUsuario(updated.rows[0]),
    });
  } catch (error) {
    console.error("Error en updateMe:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno al actualizar perfil",
      error: error.message,
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "No autorizado" });
    }

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Password actual y nuevo password son obligatorios",
      });
    }

    if (!validarPasswordSegura(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "La contrasena nueva no cumple con los requisitos de seguridad",
      });
    }

    const result = await pool.query(
      `SELECT id, password FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    const user = result.rows[0];
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "Tu cuenta no tiene password local. Usa recuperacion para crear una.",
      });
    }

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      return res.status(401).json({
        success: false,
        message: "El password actual es incorrecto",
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `
      UPDATE users
      SET password = $1,
          updated_at = NOW()
      WHERE id = $2
      `,
      [hashed, userId]
    );

    return res.json({
      success: true,
      message: "Password actualizado",
    });
  } catch (error) {
    console.error("Error en changePassword:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno al cambiar password",
      error: error.message,
    });
  }
};
