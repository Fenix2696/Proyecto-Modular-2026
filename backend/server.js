const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

function collectJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsFiles(fullPath));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

function assertNoMergeArtifacts() {
  const roots = ["controllers", "routes", "middleware", "config"].map((d) =>
    path.join(__dirname, d)
  );
  const files = roots.filter((p) => fs.existsSync(p)).flatMap(collectJsFiles);

  const markerRegex = /(^<<<<<<<|^=======|^>>>>>>>|codex\/[A-Za-z0-9._-]+)/m;
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    if (markerRegex.test(content)) {
      throw new Error(
        `Se detectaron marcas de merge/conflicto en ${path.relative(
          __dirname,
          filePath
        )}. Resuelve conflictos antes de desplegar.`
      );
    }
  }
}

assertNoMergeArtifacts();

const incidentRoutes = require("./routes/incidentRoutes");
const authRoutes = require("./routes/authRoutes");
const usersRoutes = require("./routes/usersRoutes");
const aiReportsRoutes = require("./routes/aiReportsRoutes");
const routesTrafficRoutes = require("./routes/routesTrafficRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS bloqueado para origen: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Middlewares
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use("/api/incidents", incidentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);

// Compatibilidad: deja ambas mientras pruebas
app.use("/api/ai", aiReportsRoutes);
app.use("/api/ai-reports", aiReportsRoutes);

// ✅ NUEVO ENDPOINT:
// POST http://localhost:5000/api/routes/traffic
app.use("/api/routes", routesTrafficRoutes);

// Health
app.get("/", (req, res) => {
  res.json({ message: "✅ API de Radar Ciudadano funcionando" });
});

// 404 opcional
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
