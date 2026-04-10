import express from "express";
import http from "node:http";
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
import billingRouter, { syncUserFromSubscription } from "./routes/billing.js";
import leaderboardRouter from "./routes/leaderboard.js";
import "./jobs/cron.js";
import "./jobs/penalties.js";
import { attachUser } from "./middleware/auth.js";
import { attachLeaderboardWebSocket } from "./services/leaderboardHub.js";
import Stripe from "stripe";

// Prefer .env for real secrets. If missing, fall back to env.example to reduce "env not configured" confusion.
const rootDir = path.resolve(process.cwd());
const envPath = path.join(rootDir, ".env");
const envExamplePath = path.join(rootDir, "env.example");
if (fs.existsSync(envPath)) {
	dotenv.config({
		path: envPath,
		// Default dotenv does NOT override existing process.env. A stale STRIPE_* or PATH from
		// Windows / the IDE can hide your real .env values and cause "No such price" forever.
		// In production, NODE_ENV is usually "production" and hosts set env without a checked-in .env.
		override: process.env.NODE_ENV !== "production",
	});
} else if (process.env.NODE_ENV !== "production" && fs.existsSync(envExamplePath)) {
	dotenv.config({ path: envExamplePath });
}

const app = express();
app.set("trust proxy", 1);
app.use(cors());
// Stripe only POSTs to webhooks; GET helps verify the URL in a browser and avoids "Cannot GET".
app.get("/api/billing/webhook", (_req, res) => {
	res.status(200).json({
		ok: true,
		message: "Stripe webhook URL — use POST with application/json. Browser checks are GET only.",
	});
});
// Stripe webhooks require raw body. We mount the webhook route BEFORE JSON parsing.
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
	try {
		const secret = process.env.STRIPE_WEBHOOK_SECRET;
		const key = process.env.STRIPE_SECRET_KEY;
		if (!secret || !key) return res.status(500).send("Stripe webhook env not configured");

		const stripe = new Stripe(key, { apiVersion: "2024-06-20" });
		const sig = req.headers["stripe-signature"];
		if (!sig || typeof sig !== "string") return res.status(400).send("Missing stripe-signature");

		const event = stripe.webhooks.constructEvent(req.body, sig, secret);

		if (event.type === "checkout.session.completed") {
			// Subscription is created async; we’ll rely on subscription.updated too, but try to sync early when possible.
			const session = event.data.object;
			const subId = session?.subscription;
			if (typeof subId === "string") {
				const sub = await stripe.subscriptions.retrieve(subId, { expand: ["customer", "items.data.price"] });
				await syncUserFromSubscription(sub);
			}
		}

		if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
			const sub = event.data.object;
			await syncUserFromSubscription(sub);
		}

		return res.json({ received: true });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error("Stripe webhook error", e);
		return res.status(400).send("Webhook Error");
	}
});

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

