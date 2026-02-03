const pool = require('../config/database');

// Helpers
const toNumberOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
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

async function getAllIncidents(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM incidents ORDER BY created_at DESC'
    );

    res.json({
      success: true,
      data: result.rows.map(normalizeIncidentRow),
    });
  } catch (error) {
    console.error('Error al obtener incidentes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener incidentes',
    });
  }
}

async function getIncidentById(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM incidents WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Incidente no encontrado',
      });
    }

    res.json({
      success: true,
      data: normalizeIncidentRow(result.rows[0]),
    });
  } catch (error) {
    console.error('Error al obtener incidente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener incidente',
    });
  }
}

async function createIncident(req, res) {
  try {
    const {
      type,
      description,
      address,
      priority,

      // acepta ambos formatos:
      lat,
      lng,
      latitude,
      longitude,
    } = req.body;

    const latNum = toNumberOrNull(lat ?? latitude);
    const lngNum = toNumberOrNull(lng ?? longitude);

    if (!type || !description) {
      return res.status(400).json({
        success: false,
        message: 'type y description son requeridos',
      });
    }

    if (!isValidLatLng(latNum, lngNum)) {
      return res.status(400).json({
        success: false,
        message: 'Latitud/Longitud inválidas',
      });
    }

    const result = await pool.query(
      `INSERT INTO incidents
       (type, description, latitude, longitude, address, priority)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [type, description, latNum, lngNum, address || null, priority || 'medium']
    );

    res.status(201).json({
      success: true,
      message: 'Incidente creado exitosamente',
      data: normalizeIncidentRow(result.rows[0]),
    });
  } catch (error) {
    console.error('Error al crear incidente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear incidente',
    });
  }
}

async function updateIncident(req, res) {
  try {
    const { id } = req.params;
    const { status, priority } = req.body;

    const result = await pool.query(
      `UPDATE incidents
       SET status = $1, priority = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, priority, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Incidente no encontrado',
      });
    }

    res.json({
      success: true,
      message: 'Incidente actualizado exitosamente',
      data: normalizeIncidentRow(result.rows[0]),
    });
  } catch (error) {
    console.error('Error al actualizar incidente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar incidente',
    });
  }
}

async function deleteIncident(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM incidents WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Incidente no encontrado',
      });
    }

    res.json({
      success: true,
      message: 'Incidente eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error al eliminar incidente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar incidente',
    });
  }
}

async function filterIncidents(req, res) {
  try {
    const { type, status, priority } = req.query;

    let query = 'SELECT * FROM incidents WHERE 1=1';
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

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows.map(normalizeIncidentRow),
    });
  } catch (error) {
    console.error('Error al filtrar incidentes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al filtrar incidentes',
    });
  }
}

module.exports = {
  getAllIncidents,
  getIncidentById,
  createIncident,
  updateIncident,
  deleteIncident,
  filterIncidents,
};
