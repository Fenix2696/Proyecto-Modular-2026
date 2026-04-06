const multer = require("multer");
const pool = require("../config/database");

const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
]);

function getFileExtension(name) {
  const value = String(name || "").toLowerCase();
  const idx = value.lastIndexOf(".");
  if (idx < 0) return "";
  return value.slice(idx);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mime = String(file?.mimetype || "").toLowerCase();
    const ext = getFileExtension(file?.originalname);

    if (mime.startsWith("image/")) return cb(null, true);
    if (!mime && ALLOWED_EXTENSIONS.has(ext)) return cb(null, true);

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
        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ success: false, message: "La imagen excede el maximo de 12MB" });
        }
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
