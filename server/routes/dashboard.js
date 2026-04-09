import express from "express";
import User from "../models/User.js";
import Quest from "../models/Quest.js";
import History from "../models/History.js";
import { calculateLevelFromXp } from "../utils/level.js";
import { getUserForReq } from "../utils/demoUser.js";
import { computeActivityStreakDays } from "../utils/activityStreak.js";

const router = express.Router();

/** Matches FocusMode: 9 XP per minute of focus → hours = focusXp / (9 * 60) */
const XP_PER_FOCUS_MINUTE = 9;
const DAILY_FOCUS_TARGET_HOURS = 4;

async function sumTodayXpBuckets(userId, start, end) {
	const rows = await History.find({
		userId,
		occurredAt: { $gte: start, $lte: end },
		type: { $in: ["quest_complete", "focus_session", "timeframe_bonus"] },
	})
		.select("xpChange type")
		.lean();
	let totalXp = 0;
	let focusXp = 0;
	for (const r of rows) {
		const add = r.xpChange || 0;
		totalXp += add;
		if (r.type === "focus_session") focusXp += add;
	}
	return { totalXp, focusXp };
}

// GET /api/dashboard
router.get("/", async (req, res) => {
	try {
		const user = await getUserForReq(req);
		// ensure level consistent with xp
		const computedLevel = calculateLevelFromXp(user.xp);
		if (computedLevel !== user.level) {
			user.level = computedLevel;
			await user.save();
		}

		// Today's quests
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);

		const todaysQuests = await Quest.find({
			userId: user._id,
			type: "daily",
			date: { $gte: start, $lte: end },
		})
			.sort({ createdAt: -1 })
			.lean();

		const completed = todaysQuests.filter((q) => q.isCompleted).length;
		const total = todaysQuests.length;

		const yStart = new Date(start);
		yStart.setDate(yStart.getDate() - 1);
		const yEnd = new Date(end);
		yEnd.setDate(yEnd.getDate() - 1);

		const todayBuckets = await sumTodayXpBuckets(user._id, start, end);
		const yesterdayBuckets = await sumTodayXpBuckets(user._id, yStart, yEnd);

		const focusHoursToday = todayBuckets.focusXp / (XP_PER_FOCUS_MINUTE * 60);

		const activityStreak = await computeActivityStreakDays(user._id);

		let xpVsYesterdayPercent = null;
		if (yesterdayBuckets.totalXp > 0) {
			xpVsYesterdayPercent = Math.round(
				((todayBuckets.totalXp - yesterdayBuckets.totalXp) / yesterdayBuckets.totalXp) * 100
			);
		} else if (todayBuckets.totalXp === 0) {
			xpVsYesterdayPercent = 0;
		}

		return res.json({
			user: {
				username: user.username,
				displayName: user.displayName || "",
				email: user.email || "",
				avatarDataUrl: user.avatarDataUrl || "",
				level: user.level,
				xp: user.xp,
				stats: user.stats,
				streak: activityStreak,
				rank: user.rank || "E",
				nextLevelXp: Math.pow(user.level, 2) * 100, // inverse of given formula
			},
			quests: todaysQuests.map((q) => ({
				id: q._id,
				title: q.title,
				xp: q.xpReward,
				isCompleted: q.isCompleted,
				statType: q.statType,
				difficulty: q.difficulty === "easy" || q.difficulty === "hard" ? q.difficulty : "medium",
			})),
			progress: {
				completed,
				total,
			},
			todayProgress: {
				quests: {
					completed,
					total,
					percent: total > 0 ? Math.round((completed / total) * 100) : 0,
				},
				focus: {
					hours: focusHoursToday,
					targetHours: DAILY_FOCUS_TARGET_HOURS,
					percentOfTarget: Math.min(
						100,
						Math.round((focusHoursToday / DAILY_FOCUS_TARGET_HOURS) * 100)
					),
				},
				xp: {
					gainedToday: todayBuckets.totalXp,
					vsYesterdayPercent: xpVsYesterdayPercent,
				},
			},
		});
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error(err);
		return res.status(500).json({ error: "Failed to load dashboard" });
	}
});

export default router;

