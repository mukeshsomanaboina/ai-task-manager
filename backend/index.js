require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const authRoutes = require("./src/routes/auth");
const taskRoutes = require("./src/routes/tasks");


const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DATABASE_HOST || "db",
  port: process.env.DATABASE_PORT || 5432,
  user: process.env.DATABASE_USER || "postgres",
  password: process.env.DATABASE_PASSWORD || "postgres",
  database: process.env.DATABASE_NAME || "ai_task_manager",
});

async function initDb() {
  const sql = fs.readFileSync(path.join(__dirname, "db-init.sql"), "utf8");
  await pool.query(sql);
  // seed admin if not exists
  const r = await pool.query("SELECT * FROM users WHERE role='ADMIN' LIMIT 1");
  if (r.rowCount === 0) {
    const bcrypt = require("bcrypt");
    const pw = await bcrypt.hash("Admin@123", 10);
    await pool.query("INSERT INTO users (email,password,name,role) VALUES ($1,$2,$3,$4)", [
      "admin@local",
      pw,
      "Admin",
      "ADMIN",
    ]);
    console.log("Seeded admin user -> email: admin@local password: Admin@123");
  }
}

app.get("/health", (req, res) => res.json({ ok: true }));

// attach pool to req for simple access
app.use((req, res, next) => {
  req.pool = pool;
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);

const PORT = process.env.PORT || 5001;
initDb()
  .then(() => {
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("DB init failed", err);
    process.exit(1);
  });

