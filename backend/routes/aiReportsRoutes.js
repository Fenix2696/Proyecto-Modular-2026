const express = require("express");
const router = express.Router();

const {
  getActiveAIReports,
  syncAIReports,
} = require("../controllers/aiReportsController");

router.get("/", getActiveAIReports);
router.post("/sync", syncAIReports);

module.exports = router;