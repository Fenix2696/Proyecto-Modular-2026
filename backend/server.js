const express = require("express");
const cors = require("cors");
require("dotenv").config();

const incidentRoutes = require("./routes/incidentRoutes");
const authRoutes = require("./routes/authRoutes");
const usersRoutes = require("./routes/usersRoutes");

// ✅ NUEVO: rutas para Routes API v2 (trafico en polilinea)
const routesTrafficRoutes = require("./routes/routesTrafficRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use("/api/incidents", incidentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);

// ✅ NUEVO ENDPOINT:
// POST http://localhost:5000/api/routes/traffic
app.use("/api/routes", routesTrafficRoutes);

// Health
app.get("/", (req, res) => {
  res.json({ message: "✅ API de Radar Ciudadano funcionando" });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
