import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import taskRoutes from "./routes/tasks";
import dotenv from "dotenv";
dotenv.config();

export const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);

// simple health
app.get("/health", (_, res) => res.json({ ok: true }));
