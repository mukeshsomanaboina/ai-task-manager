import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest, requireAdmin } from "../middleware/auth";
import { suggestSubtasks } from "../services/ai";

const prisma = new PrismaClient();
const router = Router();

// Create task
router.post("/", authenticate, async (req: AuthRequest, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: "title required" });
  const task = await prisma.task.create({
    data: { title, description, ownerId: req.user.id }
  });
  res.json(task);
});

// Read tasks (user: only owns, admin: all)
router.get("/", authenticate, async (req: AuthRequest, res) => {
  if (req.user.role === "ADMIN") {
    const tasks = await prisma.task.findMany({ include: { owner: true, subtasks: true } });
    return res.json(tasks);
  }
  const tasks = await prisma.task.findMany({ where: { ownerId: req.user.id }, include: { subtasks: true } });
  res.json(tasks);
});

// Update
router.put("/:id", authenticate, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Task not found" });
  if (req.user.role !== "ADMIN" && existing.ownerId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  const updated = await prisma.task.update({ where: { id }, data: req.body });
  res.json(updated);
});

// Delete
router.delete("/:id", authenticate, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Task not found" });
  if (req.user.role !== "ADMIN" && existing.ownerId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  await prisma.task.delete({ where: { id } });
  res.json({ ok: true });
});

// Accept AI suggested subtasks: create subtasks for a task
router.post("/:id/subtasks", authenticate, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const { subtasks } = req.body; // array of strings
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Task not found" });
  if (req.user.role !== "ADMIN" && existing.ownerId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  const created = await Promise.all(subtasks.map((t: string) => prisma.subtask.create({ data: { text: t, taskId: id } })));
  res.json(created);
});

// Suggest sub-tasks using AI provider
router.post("/:id/suggest", authenticate, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (req.user.role !== "ADMIN" && task.ownerId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  // call AI service with the task.title + description
  try {
    const suggestions = await suggestSubtasks(`${task.title}${task.description ? " - " + task.description : ""}`);
    res.json({ suggestions });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "AI suggestion failed", detail: err.message || err });
  }
});

export default router;
