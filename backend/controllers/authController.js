const pool = require("../config/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");


function mapUserRow(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role || "user",
    username: row.username || null,
    name: row.full_name || row.name || null,
    phone: row.phone || null,
    has_photo: !!row.photo_data,
    photo_url: row.photo_data ? `/api/users/${row.id}/photo` : "",
  };
}

function getAppBaseUrl() {
  return process.env.APP_BASE_URL || "http://localhost:5173";
}

function buildResetLink(token) {
  return `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

async function sendResetEmail(toEmail, resetLink) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  // Si no hay SMTP configurado, modo dev: imprimimos link en consola
  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log("RESET LINK (DEV):", resetLink);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const fromEmail = process.env.SMTP_FROM || smtpUser;

  await transporter.sendMail({
    from: fromEmail,
    to: toEmail,
    subject: "Recuperacion de password - Radar Ciudadano",
    text: `Usa este enlace para cambiar tu password: ${resetLink}`,
  });
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email y password son requeridos" });
    }

    const result = await pool.query(
      `SELECT id, email, password, role, username, full_name, phone, photo_data
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    const user = result.rows[0];

    const hashedPassword = String(user.password || "").trim();
    const validPassword = await bcrypt.compare(String(password), hashedPassword);

    if (!validPassword) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role || "user" },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({
      success: true,
      message: "Login exitoso",
      token,
      user: mapUserRow(user),
    });
  } catch (error) {
    console.error("login error:", error);
    return res.status(500).json({ success: false, message: "Error en servidor" });
  }
}

async function register(req, res) {
  try {
    const { email, password, name, phone, username } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email y password son requeridos" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: "Password minimo 6 caracteres" });
    }

    const exists = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Email ya registrado" });
    }

    const hashed = await bcrypt.hash(String(password), 10);

    const result = await pool.query(
      `INSERT INTO users (email, password, full_name, phone, username, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role, username, full_name, phone, photo_data`,
      [email, hashed, name || null, phone || null, username || null, "user"]
    );

    const newUser = result.rows[0];

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role || "user" },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.status(201).json({
      success: true,
      message: "Usuario registrado",
      token,
      user: mapUserRow(newUser),
    });
  } catch (error) {
    console.error("register error:", error);
    return res.status(500).json({ success: false, message: "Error en servidor" });
  }
}

async function getProfile(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, email, role, username, full_name, phone, photo_data
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    return res.json({ success: true, user: mapUserRow(result.rows[0]) });
  } catch (error) {
    console.error("getProfile error:", error);
    return res.status(500).json({ success: false, message: "Error en servidor" });
  }
}

async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { name, phone, username } = req.body;

    const result = await pool.query(
      `UPDATE users
       SET full_name = $1,
           phone = $2,
           username = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, email, role, username, full_name, phone, photo_data`,
      [name || null, phone || null, username || null, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    return res.json({
      success: true,
      message: "Perfil actualizado",
      user: mapUserRow(result.rows[0]),
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    return res.status(500).json({ success: false, message: "Error en servidor" });
  }
}

async function changePassword(req, res) {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Faltan campos" });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: "Password nuevo minimo 6 caracteres" });
    }

    const r = await pool.query("SELECT password FROM users WHERE id = $1", [userId]);
    if (r.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    const hashed = String(r.rows[0].password || "").trim();
    const ok = await bcrypt.compare(String(currentPassword), hashed);
    if (!ok) {
      return res.status(401).json({ success: false, message: "Password actual incorrecto" });
    }

    const newHashed = await bcrypt.hash(String(newPassword), 10);

    await pool.query(
      `UPDATE users
       SET password = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newHashed, userId]
    );

    return res.json({ success: true, message: "Password actualizado" });
  } catch (error) {
    console.error("changePassword error:", error);
    return res.status(500).json({ success: false, message: "Error en servidor" });
  }
}

// =============================
// Forgot / Reset Password
// =============================
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email requerido" });
    }

    const r = await pool.query("SELECT id, email FROM users WHERE email = $1", [email]);

    // Respuesta generica para no filtrar si existe o no
    if (r.rows.length === 0) {
      return res.json({
        success: true,
        message: "Si el correo existe, se envio un link de recuperacion",
      });
    }

    const user = r.rows[0];
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await pool.query(
      `UPDATE users
       SET reset_password_token = $1,
           reset_password_expires = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [token, expires, user.id]
    );

    const link = buildResetLink(token);
    await sendResetEmail(user.email, link);

    return res.json({
      success: true,
      message: "Si el correo existe, se envio un link de recuperacion",
    });
  } catch (error) {
    console.error("forgotPassword error:", error);
    return res.status(500).json({ success: false, message: "Error en servidor" });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: "Faltan campos" });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: "Password minimo 6 caracteres" });
    }

    const r = await pool.query(
      `SELECT id, reset_password_expires
       FROM users
       WHERE reset_password_token = $1`,
      [token]
    );

    if (r.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Token invalido" });
    }

    const user = r.rows[0];
    const exp = user.reset_password_expires ? new Date(user.reset_password_expires) : null;

    if (!exp || exp.getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: "Token expirado" });
    }

    const hashed = await bcrypt.hash(String(newPassword), 10);

    await pool.query(
      `UPDATE users
       SET password = $1,
           reset_password_token = NULL,
           reset_password_expires = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [hashed, user.id]
    );

    return res.json({ success: true, message: "Password actualizado" });
  } catch (error) {
    console.error("resetPassword error:", error);
    return res.status(500).json({ success: false, message: "Error en servidor" });
  }
}
async function oauthGoogle(req, res) {
  try {
    const { idToken } = req.body;

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ success: false, message: "GOOGLE_CLIENT_ID no configurado" });
    }
    if (!idToken) {
      return res.status(400).json({ success: false, message: "idToken requerido" });
    }

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email;
    const name = payload?.name || null;

    if (!email) {
      return res.status(400).json({ success: false, message: "Google token sin email" });
    }

    // Buscar usuario por email
    let userRow;
    const exists = await pool.query(
      `SELECT id, email, role, username, full_name, phone, photo_data
       FROM users WHERE email = $1`,
      [email]
    );

    if (exists.rows.length) {
      userRow = exists.rows[0];
    } else {
      // Crear usuario nuevo con password aleatorio (no lo usara, pero cumple schema)
      const randomPass = crypto.randomBytes(16).toString("hex");
      const hashed = await bcrypt.hash(String(randomPass), 10);

      const created = await pool.query(
        `INSERT INTO users (email, password, full_name, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, role, username, full_name, phone, photo_data`,
        [email, hashed, name, "user"]
      );
      userRow = created.rows[0];
    }

    const token = jwt.sign(
      { id: userRow.id, email: userRow.email, role: userRow.role || "user" },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({
      success: true,
      message: "Login Google ok",
      token,
      user: mapUserRow(userRow),
    });
  } catch (error) {
    console.error("oauthGoogle error:", error);
    return res.status(401).json({ success: false, message: "Google token invalido" });
  }
}

module.exports = {
  login,
  register,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  oauthGoogle,
};
