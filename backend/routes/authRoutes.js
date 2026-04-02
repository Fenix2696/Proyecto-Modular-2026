const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// Registro
router.post("/register", authController.register);

// Login normal
router.post("/login", authController.login);

// Login con Google
router.post("/oauth/google", authController.oauthGoogle);

// Recuperacion de contrasena
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

// Usuario autenticado actual
router.get("/me", authMiddleware, authController.me);

module.exports = router;