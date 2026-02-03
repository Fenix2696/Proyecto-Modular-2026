module.exports = function requireAdmin(req, res, next) {
  const role = req.user?.role;
  if (role !== "admin") {
    return res.status(403).json({ success: false, message: "Acceso denegado (admin)" });
  }
  next();
};
