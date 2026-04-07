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
router.get("/oauth/google", (req, res) => {
  return res.status(405).json({
    success: false,
    message: "Metodo no permitido. Usa POST /api/auth/oauth/google",
  });
});
// Username
router.get("/check-username", authController.checkUsername);

// Recuperacion de contrasena
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

// Usuario autenticado actual
router.get("/me", authMiddleware, authController.me);
router.put("/me", authMiddleware, authController.updateMe);
router.put("/password", authMiddleware, authController.changePassword);

module.exports = router;
