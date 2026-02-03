const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');
const authMiddleware = require('../middleware/authMiddleware');

// Públicas
router.get('/', incidentController.getAllIncidents);
router.get('/filter', incidentController.filterIncidents);
router.get('/:id', incidentController.getIncidentById);

// Protegidas
router.post('/', authMiddleware, incidentController.createIncident);
router.put('/:id', authMiddleware, incidentController.updateIncident);
router.delete('/:id', authMiddleware, incidentController.deleteIncident);

module.exports = router;
