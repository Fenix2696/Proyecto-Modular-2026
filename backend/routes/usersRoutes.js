const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");

const usersController = require("../controllers/usersController");

router.post("/me/photo", authMiddleware, usersController.uploadMyPhoto);
router.get("/:id/photo", usersController.getUserPhoto);

// Roles (solo admin)
router.put("/:id/role", authMiddleware, requireAdmin, usersController.setUserRole);

module.exports = router;
