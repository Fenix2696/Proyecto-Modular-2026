const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/login", authController.login);
router.post("/register", authController.register);

// Recuperacion de password (publico)
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

router.get("/profile", authMiddleware, authController.getProfile);
router.put("/profile", authMiddleware, authController.updateProfile);
router.put("/password", authMiddleware, authController.changePassword);
router.post("/oauth/google", authController.oauthGoogle);

module.exports = router;
