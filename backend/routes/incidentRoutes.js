const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');
const authMiddleware = require('../middleware/authMiddleware');

// Publicas
router.get('/', incidentController.getAllIncidents);
router.get('/filter', incidentController.filterIncidents);

// Imagen del incidente (publica)
router.get('/:id/image', incidentController.getIncidentImage);

router.get('/:id', incidentController.getIncidentById);

// Protegidas
// Nota: createIncident acepta JSON normal o multipart/form-data con "image" opcional
router.post('/', authMiddleware, incidentController.uploadIncidentImage, incidentController.createIncident);

router.put('/:id', authMiddleware, incidentController.updateIncident);
router.delete('/:id', authMiddleware, incidentController.deleteIncident);

module.exports = router;
