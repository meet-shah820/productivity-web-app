import express from "express";
import http from "node:http";
import mongoose from "mongoose";
import cors from "cors";
import { loadProjectEnv } from "./config/loadEnv.js";
import goalsRouter from "./routes/goals.js";
import dashboardRouter from "./routes/dashboard.js";
import questsRouter from "./routes/quests.js";
import focusRouter from "./routes/focus.js";
import achievementsRouter from "./routes/achievements.js";
import analyticsRouter from "./routes/analytics.js";
import skillsRouter from "./routes/skills.js";
import authRouter, { deleteAccountAndData } from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import historyRouter from "./routes/history.js";
import profileRouter from "./routes/profile.js";
import settingsRouter from "./routes/settings.js";
import streakRouter from "./routes/streak.js";
import billingRouter from "./routes/billing.js";
import { billingWebhookHandler } from "./routes/billingWebhook.js";
import leaderboardRouter from "./routes/leaderboard.js";
import "./jobs/cron.js";
import "./jobs/penalties.js";
import { attachUser, requireAuth } from "./middleware/auth.js";
import { attachLeaderboardWebSocket } from "./services/leaderboardHub.js";

loadProjectEnv({ mode: "server" });

const app = express();
app.set("trust proxy", 1);
app.use(cors());

// Stripe webhooks require the raw body for signature verification
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), billingWebhookHandler);

app.use(express.json({ limit: "4mb" }));
app.use(attachUser);

// Account deletion (duplicate mount so POST works even if /api/auth/* nesting fails on a proxy)
app.post("/api/delete-account", requireAuth, deleteAccountAndData);

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
app.use("/api/billing", billingRouter);
app.use("/api/leaderboard", leaderboardRouter);

function startServer(preferredPort) {
	const server = http.createServer(app);
	attachLeaderboardWebSocket(server);

	server.listen(preferredPort, () => {
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

