import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import goalsRouter from "./routes/goals.js";
import dashboardRouter from "./routes/dashboard.js";
import questsRouter from "./routes/quests.js";
import focusRouter from "./routes/focus.js";
import achievementsRouter from "./routes/achievements.js";
import analyticsRouter from "./routes/analytics.js";
import skillsRouter from "./routes/skills.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import historyRouter from "./routes/history.js";
import profileRouter from "./routes/profile.js";
import settingsRouter from "./routes/settings.js";
import streakRouter from "./routes/streak.js";
import "./jobs/cron.js";
import "./jobs/penalties.js";
import { attachUser } from "./middleware/auth.js";

// Prefer .env for real secrets. If missing, fall back to env.example to reduce "env not configured" confusion.
const rootDir = path.resolve(process.cwd());
const envPath = path.join(rootDir, ".env");
const envExamplePath = path.join(rootDir, "env.example");
if (fs.existsSync(envPath)) {
	dotenv.config({ path: envPath });
} else if (fs.existsSync(envExamplePath)) {
	dotenv.config({ path: envExamplePath });
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" }));
app.use(attachUser);

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/productivity_app";
mongoose
	.connect(mongoUri, { dbName: "productivity_app" })
	.then(() => {
		// eslint-disable-next-line no-console
		console.log("✅ MongoDB connected");
	})
	.catch((err) => {
		// eslint-disable-next-line no-console
		console.error("MongoDB connection error", err);
		process.exit(1);
	});

app.get("/api/health", (_req, res) => {
	res.json({ ok: true });
});

// Basic root route (useful for Render/health checks and manual verification)
app.get("/", (_req, res) => {
	res.status(200).send("API is running");
});

app.use("/api/goals", goalsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/quests", questsRouter);
app.use("/api/focus", focusRouter);
app.use("/api/achievements", achievementsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/skills", skillsRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/history", historyRouter);
app.use("/api/profile", profileRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/streak", streakRouter);

function startServer(preferredPort) {
	const server = app.listen(preferredPort, () => {
		// eslint-disable-next-line no-console
		console.log(`🚀 Server running on http://localhost:${preferredPort}`);
	});

	server.on("error", (err) => {
		if (err?.code === "EADDRINUSE") {
			const nextPort = Number(preferredPort) + 1;
			// eslint-disable-next-line no-console
			console.warn(`⚠️ Port ${preferredPort} is in use. Retrying on ${nextPort}...`);
			server.close(() => startServer(nextPort));
			return;
		}
		// eslint-disable-next-line no-console
		console.error("Server failed to start", err);
		process.exit(1);
	});
}

const PORT = Number(process.env.PORT || 5000);
startServer(PORT);

