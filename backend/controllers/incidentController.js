const pool = require("../config/database");
const multer = require("multer");

// =========================
// Config
// =========================
const INCIDENT_VISIBLE_HOURS = 24;

// =========================
// Multer: imagen opcional
// Field: "image"
// =========================
const uploadIncidentImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (file && file.mimetype && file.mimetype.startsWith("image/")) return cb(null, true);
    return cb(new Error("Archivo no es imagen"), false);
  },
}).single("image");

// Helpers
const toNumberOrNull = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const normalizeIncidentRow = (row) => {
  const lat = toNumberOrNull(row.lat ?? row.latitude);
  const lng = toNumberOrNull(row.lng ?? row.longitude);

  return {
    ...row,
    lat,
    lng,
  };
};

const isValidLatLng = (lat, lng) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
};

// =========================
// Marcar expirados en BD
// =========================
async function expireOldIncidents() {
  try {
    await pool.query(
      `
      UPDATE incidents
      SET
        status = 'expired',
        updated_at = CURRENT_TIMESTAMP
      WHERE created_at < NOW() - INTERVAL '${INCIDENT_VISIBLE_HOURS} hours'
        AND COALESCE(status, '') <> 'expired'
      `
    );
  } catch (error) {
    console.error("Error al expirar incidentes:", error);
  }
}

// =========================
// Obtener solo incidentes visibles
// (ultimas 24 horas y no expirados)
// =========================
async function getAllIncidents(req, res) {
  try {
    await expireOldIncidents();

    const result = await pool.query(
      `
      SELECT
        id,
        type,
        description,
        latitude,
        longitude,
        address,
        priority,
        status,
        created_at,
        updated_at,
        (incident_image_data IS NOT NULL) AS has_image
      FROM incidents
      WHERE created_at >= NOW() - INTERVAL '${INCIDENT_VISIBLE_HOURS} hours'
        AND COALESCE(status, '') <> 'expired'
      ORDER BY created_at DESC
      `
    );

    res.json({
      success: true,
      data: result.rows.map(normalizeIncidentRow),
    });
  } catch (error) {
    console.error("Error al obtener incidentes:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener incidentes",
    });
  }
}

// =========================
// Obtener incidente por id
// Solo si sigue visible
// =========================
async function getIncidentById(req, res) {
  try {
    await expireOldIncidents();

    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        id,
        type,
        description,
        latitude,
        longitude,
        address,
        priority,
        status,
        created_at,
        updated_at,
        (incident_image_data IS NOT NULL) AS has_image
      FROM incidents
      WHERE id = $1
        AND created_at >= NOW() - INTERVAL '${INCIDENT_VISIBLE_HOURS} hours'
        AND COALESCE(status, '') <> 'expired'
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Incidente no encontrado o expirado",
      });
    }

    res.json({
      success: true,
      data: normalizeIncidentRow(result.rows[0]),
    });
  } catch (error) {
    console.error("Error al obtener incidente:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener incidente",
    });
  }
}

// Middleware wrapper para no tronar si viene JSON
function uploadIncidentImageMiddleware(req, res, next) {
  const ct = String(req.headers["content-type"] || "");
  if (!ct.includes("multipart/form-data")) return next();

  uploadIncidentImage(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "Error al subir imagen",
      });
    }
    next();
  });
}

// =========================
// Crear incidente
// =========================
async function createIncident(req, res) {
  try {
    const {
      type,
      title,
      description,
      address,
      priority,
      status,

      // acepta ambos formatos:
      lat,
      lng,
      latitude,
      longitude,
    } = req.body;

    const latNum = toNumberOrNull(lat ?? latitude);
    const lngNum = toNumberOrNull(lng ?? longitude);
    const titleText = typeof title === "string" ? title.trim() : "";
    const descriptionText =
      typeof description === "string" ? description.trim() : "";
    const normalizedDescription = descriptionText || titleText;

    if (!type || !normalizedDescription) {
      return res.status(400).json({
        success: false,
        message: "type y description/title son requeridos",
      });
    }

    if (!isValidLatLng(latNum, lngNum)) {
      return res.status(400).json({
        success: false,
        message: "Latitud/Longitud invalidas",
      });
    }

    // Imagen opcional (si vino multipart)
    const imgBuf = req.file?.buffer || null;
    const imgMime = req.file?.mimetype || null;

    const result = await pool.query(
      `
      INSERT INTO incidents
        (
          type,
          description,
          latitude,
          longitude,
          address,
          priority,
          status,
          incident_image_data,
          incident_image_mime
        )
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING
        id,
        type,
        description,
        latitude,
        longitude,
        address,
        priority,
        status,
        created_at,
        updated_at,
        (incident_image_data IS NOT NULL) AS has_image
      `,
      [
        type,
        normalizedDescription,
        latNum,
        lngNum,
        address || null,
        priority || "medium",
        status || "active",
        imgBuf,
        imgMime,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Incidente creado exitosamente",
      data: normalizeIncidentRow(result.rows[0]),
    });
  } catch (error) {
    console.error("Error al crear incidente:", error);
    res.status(500).json({
      success: false,
      message: "Error al crear incidente",
    });
  }
}

// =========================
// Actualizar incidente
// Solo si sigue visible
// =========================
async function updateIncident(req, res) {
  try {
    await expireOldIncidents();

    const { id } = req.params;
    const { status, priority } = req.body;

    const result = await pool.query(
      `
      UPDATE incidents
      SET status = $1, priority = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
        AND created_at >= NOW() - INTERVAL '${INCIDENT_VISIBLE_HOURS} hours'
        AND COALESCE(status, '') <> 'expired'
      RETURNING
        id,
        type,
        description,
        latitude,
        longitude,
        address,
        priority,
        status,
        created_at,
        updated_at,
        (incident_image_data IS NOT NULL) AS has_image
      `,
      [status, priority, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Incidente no encontrado o expirado",
      });
    }

    res.json({
      success: true,
      message: "Incidente actualizado exitosamente",
      data: normalizeIncidentRow(result.rows[0]),
    });
  } catch (error) {
    console.error("Error al actualizar incidente:", error);
    res.status(500).json({
      success: false,
      message: "Error al actualizar incidente",
    });
  }
}

// =========================
// Eliminar incidente
// =========================
async function deleteIncident(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query("DELETE FROM incidents WHERE id = $1 RETURNING id", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Incidente no encontrado",
      });
    }

    res.json({
      success: true,
      message: "Incidente eliminado exitosamente",
    });
  } catch (error) {
    console.error("Error al eliminar incidente:", error);
    res.status(500).json({
      success: false,
      message: "Error al eliminar incidente",
    });
  }
}

// =========================
// Filtrar incidentes
// Solo visibles
// =========================
async function filterIncidents(req, res) {
  try {
    await expireOldIncidents();

    const { type, status, priority } = req.query;

    let query = `
      SELECT
        id,
        type,
        description,
        latitude,
        longitude,
        address,
        priority,
        status,
        created_at,
        updated_at,
        (incident_image_data IS NOT NULL) AS has_image
      FROM incidents
      WHERE created_at >= NOW() - INTERVAL '${INCIDENT_VISIBLE_HOURS} hours'
        AND COALESCE(status, '') <> 'expired'
    `;

    const params = [];
    let paramCount = 1;

    if (type) {
      query += ` AND type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    if (status) {
      query += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (priority) {
      query += ` AND priority = $${paramCount}`;
      params.push(priority);
      paramCount++;
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows.map(normalizeIncidentRow),
    });
  } catch (error) {
    console.error("Error al filtrar incidentes:", error);
    res.status(500).json({
      success: false,
      message: "Error al filtrar incidentes",
    });
  }
}

// =========================
// Obtener historial, incluyendo expirados
// =========================
async function getIncidentHistory(req, res) {
  try {
    await expireOldIncidents();

    const result = await pool.query(
      `
      SELECT
        id,
        type,
        description,
        latitude,
        longitude,
        address,
        priority,
        status,
        created_at,
        updated_at,
        (incident_image_data IS NOT NULL) AS has_image
      FROM incidents
      ORDER BY created_at DESC
      `
    );

    res.json({
      success: true,
      data: result.rows.map(normalizeIncidentRow),
    });
  } catch (error) {
    console.error("Error al obtener historial de incidentes:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener historial de incidentes",
    });
  }
}

// =========================
// Obtener imagen de incidente
// Permite verla aunque ya no este visible en mapa,
// siempre que el registro exista
// =========================
async function getIncidentImage(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT incident_image_data, incident_image_mime
      FROM incidents
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Incidente no encontrado",
      });
    }

    const row = result.rows[0];
    if (!row.incident_image_data) {
      return res.status(404).json({
        success: false,
        message: "Este incidente no tiene imagen",
      });
    }

    res.setHeader("Content-Type", row.incident_image_mime || "image/jpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.send(row.incident_image_data);
  } catch (error) {
    console.error("Error al obtener imagen del incidente:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener imagen",
    });
  }
}

module.exports = {
  // middleware
  uploadIncidentImage: uploadIncidentImageMiddleware,

  // endpoints
  getAllIncidents,
  getIncidentById,
  createIncident,
  updateIncident,
  deleteIncident,
  filterIncidents,
  getIncidentHistory,
  getIncidentImage,
};
