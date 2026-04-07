import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

function makeJwt(user) {
	return jwt.sign({ uid: user._id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
}

function getServerOrigin(req) {
	const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http").toString().split(",")[0].trim();
	const host = (req.headers["x-forwarded-host"] || req.get("host") || "localhost:5000").toString().split(",")[0].trim();
	return `${proto}://${host}`;
}

function toUsernameCandidate(email, fallback = "user") {
	const base = (email || "")
		.split("@")[0]
		.replace(/[^a-zA-Z0-9_]/g, "_")
		.slice(0, 24);
	return (base || fallback).toLowerCase();
}

async function pickAvailableUsername(base) {
	const normalized = (base || "user").toLowerCase();
	for (let i = 0; i < 20; i++) {
		const suffix = i === 0 ? "" : `_${Math.floor(Math.random() * 9000 + 1000)}`;
		const candidate = `${normalized}${suffix}`.slice(0, 30);
		// eslint-disable-next-line no-await-in-loop
		const exists = await User.findOne({ username: candidate });
		if (!exists) return candidate;
	}
	return `${normalized}_${Date.now()}`.slice(0, 30);
}

router.post("/signup", async (req, res) => {
	try {
		const { username, password } = req.body || {};
		if (!username || !password) return res.status(400).json({ error: "username and password required" });
		const existing = await User.findOne({ username });
		if (existing) return res.status(409).json({ error: "username taken" });
		const hashed = await bcrypt.hash(password, 10);
		const user = await User.create({ username, password: hashed });
		const token = makeJwt(user);
		return res.json({ token });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "failed to signup" });
	}
});

router.post("/login", async (req, res) => {
	try {
		const { username, password } = req.body || {};
		if (!username || !password) return res.status(400).json({ error: "username and password required" });
		const user = await User.findOne({ username });
		if (!user || !user.password) return res.status(401).json({ error: "invalid credentials" });
		const ok = await bcrypt.compare(password, user.password);
		if (!ok) return res.status(401).json({ error: "invalid credentials" });
		const token = makeJwt(user);
		return res.json({ token });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "failed to login" });
	}
});

// Google OAuth (Authorization Code flow)
router.get("/google", (req, res) => {
	try {
		const clientId = process.env.GOOGLE_CLIENT_ID;
		const callbackUrl = process.env.GOOGLE_CALLBACK_URL || `${getServerOrigin(req)}/api/auth/google/callback`;
		if (!clientId) return res.status(500).send("Google OAuth env not configured");

		const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
		u.searchParams.set("client_id", clientId);
		u.searchParams.set("redirect_uri", callbackUrl);
		u.searchParams.set("response_type", "code");
		u.searchParams.set("scope", "openid email profile");
		u.searchParams.set("access_type", "offline");
		u.searchParams.set("prompt", "consent");
		// Minimal state to prevent trivial CSRF; for a stronger solution, store per-session state in a cookie.
		u.searchParams.set("state", "google_oauth");

		return res.redirect(u.toString());
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).send("Failed to start Google auth");
	}
});

router.get("/google/callback", async (req, res) => {
	try {
		const code = req.query?.code;
		const state = req.query?.state;
		if (!code) return res.status(400).send("Missing code");
		if (state && state !== "google_oauth") return res.status(400).send("Invalid state");

		const clientId = process.env.GOOGLE_CLIENT_ID;
		const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
		const callbackUrl = process.env.GOOGLE_CALLBACK_URL || `${getServerOrigin(req)}/api/auth/google/callback`;
		const successRedirect = process.env.OAUTH_SUCCESS_REDIRECT || "http://localhost:5173/auth/callback";
		if (!clientId || !clientSecret) return res.status(500).send("Google OAuth env not configured");

		// Exchange code -> tokens
		const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				code: String(code),
				client_id: clientId,
				client_secret: clientSecret,
				redirect_uri: callbackUrl,
				grant_type: "authorization_code",
			}),
		});

		if (!tokenRes.ok) {
			const text = await tokenRes.text();
			// eslint-disable-next-line no-console
			console.error("Google token exchange failed", tokenRes.status, text);
			return res.status(500).send("Google token exchange failed");
		}

		const tokenJson = await tokenRes.json();
		const accessToken = tokenJson?.access_token;
		if (!accessToken) return res.status(500).send("Missing access token from Google");

		// Fetch userinfo (email, sub, name, picture)
		const meRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		if (!meRes.ok) {
			const text = await meRes.text();
			// eslint-disable-next-line no-console
			console.error("Google userinfo failed", meRes.status, text);
			return res.status(500).send("Google userinfo failed");
		}
		const me = await meRes.json();
		const googleId = me?.sub;
		const email = me?.email || "";
		const displayName = me?.name || "";
		if (!googleId) return res.status(500).send("Missing Google sub");

		// Find or create user
		let user = await User.findOne({ googleId });
		if (!user && email) {
			user = await User.findOne({ email });
			if (user && !user.googleId) {
				user.googleId = googleId;
				if (!user.displayName && displayName) user.displayName = displayName;
				await user.save();
			}
		}
		if (!user) {
			const base = toUsernameCandidate(email, "google_user");
			const username = await pickAvailableUsername(base);
			user = await User.create({
				username,
				password: null,
				googleId,
				email,
				displayName,
			});
		}

		const jwtToken = makeJwt(user);
		const redirectUrl = new URL(successRedirect);
		redirectUrl.searchParams.set("token", jwtToken);
		redirectUrl.searchParams.set("username", user.username);
		return res.redirect(redirectUrl.toString());
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).send("Google callback failed");
	}
});

router.post("/change-password", async (req, res) => {
	try {
		const { username, currentPassword, newPassword } = req.body || {};
		if (!username || !currentPassword || !newPassword) {
			return res.status(400).json({ error: "username, currentPassword, newPassword required" });
		}
		const user = await User.findOne({ username });
		if (!user || !user.password) return res.status(401).json({ error: "invalid credentials" });
		const ok = await bcrypt.compare(currentPassword, user.password);
		if (!ok) return res.status(401).json({ error: "invalid credentials" });
		user.password = await bcrypt.hash(newPassword, 10);
		await user.save();
		return res.json({ ok: true });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "failed to change password" });
	}
});

export default router;

