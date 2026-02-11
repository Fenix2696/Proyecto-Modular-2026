// backend/routes/routesTrafficRoutes.js

const express = require("express");
const router = express.Router();

const {
  computeTrafficRoutes,
} = require("../controllers/routesTrafficController");

// POST /api/routes/traffic
// body:
// {
//   origin: { lat, lng },
//   destination: { lat, lng },
//   travelMode: "DRIVE" | "TWO_WHEELER" | "WALK" | "TRANSIT" | "BICYCLE",
//   alternatives: boolean
// }
router.post("/traffic", computeTrafficRoutes);

module.exports = router;
