const multer = require("multer");
const pool = require("../config/database");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file && file.mimetype && file.mimetype.startsWith("image/")) return cb(null, true);
    return cb(new Error("Archivo no es imagen"), false);
  },
}).single("photo");

function toIntOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function uploadMyPhoto(req, res) {
  upload(req, res, async (err) => {
    try {
      if (err) {
        return res.status(400).json({ success: false, message: err.message || "Error subiendo foto" });
      }
      if (!req.user?.id) {
        return res.status(401).json({ success: false, message: "No autorizado" });
      }
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ success: false, message: "No se recibio foto (field: photo)" });
      }

      const userId = req.user.id;

      await pool.query(
        `UPDATE users
         SET photo_data = $1,
             photo_mime = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [req.file.buffer, req.file.mimetype, userId]
      );

      return res.json({
        success: true,
        message: "Foto actualizada",
        photo_url: `/api/users/${userId}/photo`,
      });
    } catch (e) {
      console.error("uploadMyPhoto error:", e);
      return res.status(500).json({ success: false, message: "Error en servidor" });
    }
  });
}

async function getUserPhoto(req, res) {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).send("Bad request");

    const result = await pool.query(
      "SELECT photo_data, photo_mime FROM users WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) return res.status(404).send("Not found");

    const row = result.rows[0];
    if (!row.photo_data) return res.status(404).send("No photo");

    res.setHeader("Content-Type", row.photo_mime || "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.send(row.photo_data);
  } catch (e) {
    console.error("getUserPhoto error:", e);
    return res.status(500).send("Server error");
  }
}

async function setUserRole(req, res) {
  try {
    const id = toIntOrNull(req.params.id);
    const { role } = req.body;

    if (!id) return res.status(400).json({ success: false, message: "Id invalido" });

    const allowed = ["admin", "user"];
    if (!allowed.includes(String(role))) {
      return res.status(400).json({ success: false, message: "Role invalido (admin/user)" });
    }

    const r = await pool.query(
      `UPDATE users
       SET role = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, email, role`,
      [role, id]
    );

    if (r.rows.length === 0) return res.status(404).json({ success: false, message: "Usuario no encontrado" });

    return res.json({ success: true, message: "Role actualizado", user: r.rows[0] });
  } catch (e) {
    console.error("setUserRole error:", e);
    return res.status(500).json({ success: false, message: "Error en servidor" });
  }
}

module.exports = {
  uploadMyPhoto,
  getUserPhoto,
  setUserRole,
};
