const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const pool = require("../config/databaseS");
const transporter = require("../config/mailer");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role || "user",
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Todos los campos son obligatorios",
      });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "El usuario ya existe",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, 'user')
      RETURNING id, name, email, role, photo_url
      `,
      [name, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: "Usuario registrado correctamente",
      token,
      user,
    });
  } catch (error) {
    console.error("register error:", error);
    return res.status(500).json({
      success: false,
      message: "Error al registrar usuario",
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email y contrasena son obligatorios",
      });
    }

    const result = await pool.query(
      `
      SELECT id, name, email, password, role, photo_url
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Credenciales invalidas",
      });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password || "");

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Credenciales invalidas",
      });
    }

    const token = signToken(user);

    return res.json({
      success: true,
      message: "Login exitoso",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        photo_url: user.photo_url || null,
      },
    });
  } catch (error) {
    console.error("login error:", error);
    return res.status(500).json({
      success: false,
      message: "Error al iniciar sesion",
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "El email es obligatorio",
      });
    }

    const result = await pool.query(
      "SELECT id, name, email FROM users WHERE email = $1 LIMIT 1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: "Si el correo existe, se envio un enlace de recuperacion",
      });
    }

    const user = result.rows[0];
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = new Date(Date.now() + 1000 * 60 * 30);

    await pool.query(
      `
      UPDATE users
      SET reset_token = $1, reset_token_expires = $2
      WHERE id = $3
      `,
      [resetToken, resetTokenExpires, user.id]
    );

    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5173";
    const resetLink = `${appBaseUrl}/reset-password?token=${resetToken}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Recuperacion de contrasena - Radar Ciudadano",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Recuperacion de contrasena</h2>
          <p>Hola ${user.name || "usuario"},</p>
          <p>Recibimos una solicitud para restablecer tu contrasena.</p>
          <p>
            <a href="${resetLink}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;">
              Restablecer contrasena
            </a>
          </p>
          <p>Este enlace expirara en 30 minutos.</p>
          <p>Si no solicitaste esto, ignora este correo.</p>
        </div>
      `,
    });

    return res.json({
      success: true,
      message: "Si el correo existe, se envio un enlace de recuperacion",
    });
  } catch (error) {
    console.error("forgotPassword error:", error);
    return res.status(500).json({
      success: false,
      message: "Error al procesar la recuperacion",
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Token y nueva contrasena son obligatorios",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "La contrasena debe tener al menos 6 caracteres",
      });
    }

    const result = await pool.query(
      `
      SELECT id
      FROM users
      WHERE reset_token = $1
        AND reset_token_expires > NOW()
      LIMIT 1
      `,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Token invalido o expirado",
      });
    }

    const user = result.rows[0];
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `
      UPDATE users
      SET password = $1,
          reset_token = NULL,
          reset_token_expires = NULL
      WHERE id = $2
      `,
      [hashedPassword, user.id]
    );

    return res.json({
      success: true,
      message: "Contrasena actualizada correctamente",
    });
  } catch (error) {
    console.error("resetPassword error:", error);
    return res.status(500).json({
      success: false,
      message: "Error al restablecer la contrasena",
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT id, name, email, role, photo_url
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }

    return res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error("getProfile error:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener perfil",
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, photo_url } = req.body;

    const result = await pool.query(
      `
      UPDATE users
      SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        photo_url = COALESCE($3, photo_url)
      WHERE id = $4
      RETURNING id, name, email, role, photo_url
      `,
      [name, email, photo_url, userId]
    );

    return res.json({
      success: true,
      message: "Perfil actualizado correctamente",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    return res.status(500).json({
      success: false,
      message: "Error al actualizar perfil",
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Debes enviar la contrasena actual y la nueva",
      });
    }

    const result = await pool.query(
      "SELECT id, password FROM users WHERE id = $1 LIMIT 1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(currentPassword, user.password || "");

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "La contrasena actual es incorrecta",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE users SET password = $1 WHERE id = $2",
      [hashedPassword, userId]
    );

    return res.json({
      success: true,
      message: "Contrasena actualizada correctamente",
    });
  } catch (error) {
    console.error("changePassword error:", error);
    return res.status(500).json({
      success: false,
      message: "Error al cambiar contrasena",
    });
  }
};

exports.oauthGoogle = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Falta idToken",
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        success: false,
        message: "GOOGLE_CLIENT_ID no configurado en backend",
      });
    }

    console.log("GOOGLE_CLIENT_ID backend:", process.env.GOOGLE_CLIENT_ID);

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    console.log("Google payload:", payload);

    if (!payload) {
      return res.status(401).json({
        success: false,
        message: "Payload de Google invalido",
      });
    }

    const email = payload.email;
    const name =
      payload.name ||
      payload.given_name ||
      (email ? email.split("@")[0] : "Usuario Google");
    const photo = payload.picture || null;

    if (!email) {
      return res.status(401).json({
        success: false,
        message: "Google no regreso email",
      });
    }

    const existingUser = await pool.query(
      `
      SELECT id, name, email, role, photo_url
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email]
    );

    let user;

    if (existingUser.rows.length > 0) {
      const updatedUser = await pool.query(
        `
        UPDATE users
        SET
          name = COALESCE($1, name),
          photo_url = COALESCE($2, photo_url)
        WHERE email = $3
        RETURNING id, name, email, role, photo_url
        `,
        [name, photo, email]
      );

      user = updatedUser.rows[0];
    } else {
      const createdUser = await pool.query(
        `
        INSERT INTO users (name, email, password, role, photo_url)
        VALUES ($1, $2, '', 'user', $3)
        RETURNING id, name, email, role, photo_url
        `,
        [name, email, photo]
      );

      user = createdUser.rows[0];
    }

    const token = signToken(user);

    return res.json({
      success: true,
      message: "Login con Google exitoso",
      token,
      user,
    });
  } catch (error) {
    console.error("oauthGoogle error completo:", error);

    return res.status(401).json({
      success: false,
      message: "Google token invalido",
      debug: error?.message || "Sin detalle",
    });
  }
};