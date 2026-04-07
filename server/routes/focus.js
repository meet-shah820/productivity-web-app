import express from "express";
import User from "../models/User.js";
import { getUserForReq } from "../utils/demoUser.js";
import { calculateLevelFromXp } from "../utils/level.js";
import History from "../models/History.js";
import Goal from "../models/Goal.js";
import { evaluateAndRecordAchievements } from "../services/achievementsEngine.js";
import { recalculateAndSaveUserRank } from "../services/rankEngine.js";

const router = express.Router();

/** Same as dashboard: 9 XP per minute of focus */
const XP_PER_FOCUS_MINUTE = 9;

// GET /api/focus/today-stats — sessions, focus duration, XP from focus today (local server day)
router.get("/today-stats", async (_req, res) => {
	try {
		const user = await getUserForReq(_req);
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);

		const rows = await History.find({
			userId: user._id,
			type: "focus_session",
			createdAt: { $gte: start, $lte: end },
		}).lean();

		const sessionsToday = rows.length;
		const focusXpToday = rows.reduce((s, r) => s + (r.xpChange || 0), 0);
		const focusMinutesToday = focusXpToday / XP_PER_FOCUS_MINUTE;
		const focusHoursToday = focusMinutesToday / 60;

		return res.json({
			sessionsToday,
			focusXpToday,
			focusMinutesToday,
			focusHoursToday,
		});
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error(err);
		return res.status(500).json({ error: "Failed to load focus stats" });
	}
});

// POST /api/focus/complete { xp: number }
router.post("/complete", async (req, res) => {
	try {
		const { xp } = req.body || {};
		const addXp = Number(xp) || 0;
		if (addXp <= 0) return res.status(400).json({ error: "xp must be > 0" });

		const user = await getUserForReq(req);
		const preLevel = calculateLevelFromXp(user.xp);
		user.xp += addXp;
		user.level = calculateLevelFromXp(user.xp);
		await user.save();

		await History.create({
			userId: user._id,
			type: "focus_session",
			xpChange: addXp,
			meta: { source: "focus_mode" },
		});
		if (user.level > preLevel) {
			await History.create({
				userId: user._id,
				type: "level_up",
				xpChange: 0,
				meta: { level: user.level },
			});
		}

		const goals = await Goal.find({ userId: user._id, status: "active" }).lean();
		const questsCompleted = await History.countDocuments({ userId: user._id, type: "quest_complete", xpChange: { $gt: 0 } });
		const focusXp = await History.aggregate([
			{ $match: { userId: user._id, type: "focus_session" } },
			{ $group: { _id: null, total: { $sum: "$xpChange" } } },
		]);
		const focusHours = (focusXp?.[0]?.total || 0) / (9 * 60);
		await evaluateAndRecordAchievements({ user, goals, questsCompleted, focusHours });

		const rank = await recalculateAndSaveUserRank(user._id, { preferGemini: true });

		return res.json({
			ok: true,
			leveledUp: user.level > preLevel,
			user: { level: user.level, xp: user.xp, stats: user.stats, rank: rank || user.rank || "E" },
		});
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error(err);
		return res.status(500).json({ error: "Failed to record focus session" });
	}
});

export default router;

