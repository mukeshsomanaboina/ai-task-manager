const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Missing auth header" });
  const parts = auth.split(" ");
  if (parts.length !== 2) return res.status(401).json({ error: "Invalid auth header" });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "secret");
    req.user = payload; // payload contains id and role
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Admin required" });
  next();
}

module.exports = { authenticate, requireAdmin };
