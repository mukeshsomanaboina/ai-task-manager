const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");

// register
router.post("/register", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email + password required" });
  const pool = req.pool;
  try {
    const exists = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (exists.rowCount > 0) return res.status(400).json({ error: "Email already used" });
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      "INSERT INTO users (email,password,name,role) VALUES ($1,$2,$3,$4) RETURNING id,email,name,role",
      [email, hash, name || null, "USER"]
    );
    const user = r.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || "secret", {
      expiresIn: "7d",
    });
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const pool = req.pool;
  try {
    const r = await pool.query("SELECT id,email,password,name,role FROM users WHERE email=$1", [email]);
    if (r.rowCount === 0) return res.status(401).json({ error: "Invalid credentials" });
    const user = r.rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || "secret", {
      expiresIn: "7d",
    });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// admin: list all users (requires token check in frontend or extend middleware)
router.get("/users", async (req, res) => {
  const pool = req.pool;
  const r = await pool.query("SELECT id,email,name,role,created_at FROM users");
  res.json(r.rows);
});

module.exports = router;
