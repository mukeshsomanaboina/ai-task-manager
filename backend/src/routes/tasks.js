const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const { suggestSubtasks } = require("../services/ai");

// Create task
router.post("/", authenticate, async (req, res) => {
  const pool = req.pool;
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: "title required" });
  try {
    const r = await pool.query(
      "INSERT INTO tasks (owner_id,title,description,status) VALUES ($1,$2,$3,$4) RETURNING *",
      [req.user.id, title, description || null, "TODO"]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Read tasks: users get only their tasks; admin usage handled on frontend with token role
router.get("/", authenticate, async (req, res) => {
  const pool = req.pool;
  try {
    if (req.user.role === "ADMIN") {
      const r = await pool.query("SELECT t.*, u.email as owner_email FROM tasks t JOIN users u ON u.id = t.owner_id ORDER BY t.created_at DESC");
      return res.json(r.rows);
    }
    const r = await pool.query("SELECT * FROM tasks WHERE owner_id=$1 ORDER BY created_at DESC", [req.user.id]);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update task
router.put("/:id", authenticate, async (req, res) => {
  const pool = req.pool;
  const id = Number(req.params.id);
  const { title, description, status } = req.body;
  try {
    const existing = await pool.query("SELECT * FROM tasks WHERE id=$1", [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: "Task not found" });
    if (existing.rows[0].owner_id !== req.user.id && req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
    const r = await pool.query(
      "UPDATE tasks SET title=$1,description=$2,status=$3,updated_at=now() WHERE id=$4 RETURNING *",
      [title || existing.rows[0].title, description || existing.rows[0].description, status || existing.rows[0].status, id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete
router.delete("/:id", authenticate, async (req, res) => {
  const pool = req.pool;
  const id = Number(req.params.id);
  try {
    const existing = await pool.query("SELECT * FROM tasks WHERE id=$1", [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: "Task not found" });
    if (existing.rows[0].owner_id !== req.user.id && req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
    await pool.query("DELETE FROM tasks WHERE id=$1", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Suggest subtasks: calls AI and returns suggestions (does NOT save)
router.post("/:id/suggest", authenticate, async (req, res) => {
  const pool = req.pool;
  const id = Number(req.params.id);
  try {
    const r = await pool.query("SELECT * FROM tasks WHERE id=$1", [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Task not found" });
    const task = r.rows[0];
    if (task.owner_id !== req.user.id && req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

    const suggestions = await suggestSubtasks(`${task.title}${task.description ? " - " + task.description : ""}`);
    res.json({ suggestions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI failed", detail: err.message || err });
  }
});

// Accept suggestions: create subtasks records
router.post("/:id/subtasks", authenticate, async (req, res) => {
  const pool = req.pool;
  const id = Number(req.params.id);
  const { subtasks } = req.body; // array of strings
  if (!Array.isArray(subtasks)) return res.status(400).json({ error: "subtasks must be an array" });
  try {
    const r = await pool.query("SELECT * FROM tasks WHERE id=$1", [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Task not found" });
    const task = r.rows[0];
    if (task.owner_id !== req.user.id && req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

    const created = [];
    for (const text of subtasks) {
      const cr = await pool.query("INSERT INTO subtasks (task_id,text) VALUES ($1,$2) RETURNING *", [id, text]);
      created.push(cr.rows[0]);
    }
    res.json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
