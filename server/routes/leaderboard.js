import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { buildLeaderboardSnapshot } from "../services/leaderboardSnapshot.js";

const router = express.Router();

// GET /api/leaderboard — requires login (no demo fallback)
router.get("/", requireAuth, async (req, res) => {
	try {
		const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
		const data = await buildLeaderboardSnapshot({ limit, viewerId: req.user._id });
		return res.json(data);
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error(err);
		return res.status(500).json({ error: "Failed to load leaderboard" });
	}
});

export default router;
