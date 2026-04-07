import jwt from "jsonwebtoken";
import User from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

/**
 * If a valid JWT is provided, attach the authenticated user document to req.user.
 * This does NOT block requests; use requireAuth() if you need to enforce login.
 */
export async function attachUser(req, _res, next) {
	try {
		const raw = req.headers?.authorization || req.headers?.Authorization;
		const header = Array.isArray(raw) ? raw[0] : raw;
		if (!header || typeof header !== "string") return next();
		const m = header.match(/^Bearer\s+(.+)$/i);
		if (!m) return next();
		const token = m[1];
		const payload = jwt.verify(token, JWT_SECRET);
		const uid = payload?.uid;
		if (!uid) return next();
		const user = await User.findById(uid).exec();
		if (user) req.user = user;
		return next();
	} catch {
		// ignore invalid/expired token; treat as anonymous
		return next();
	}
}

export function requireAuth(req, res, next) {
	if (req.user) return next();
	return res.status(401).json({ error: "Unauthorized" });
}

