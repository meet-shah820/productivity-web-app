import express from "express";
import History from "../models/History.js";
import User from "../models/User.js";
import { getUserForReq } from "../utils/demoUser.js";
import { computeActivityStreakDays } from "../utils/activityStreak.js";

const router = express.Router();

async function getUser(req) {
	return await getUserForReq(req);
}

router.get("/", async (req, res) => {
	try {
		const user = await getUser(req);
		const now = new Date();
		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
		monthStart.setHours(0, 0, 0, 0);
		const sevenDaysAgo = new Date(now);
		sevenDaysAgo.setDate(now.getDate() - 6);
		sevenDaysAgo.setHours(0, 0, 0, 0);

		const hist = await History.find({ userId: user._id, occurredAt: { $gte: sevenDaysAgo } }).lean();
		const dayKey = (d) => d.toISOString().slice(0, 10);
		const xpByDay = new Map();
		const focusByDay = new Map();

		for (let i = 0; i < 7; i++) {
			const d = new Date(sevenDaysAgo);
			d.setDate(sevenDaysAgo.getDate() + i);
			const key = dayKey(d);
			xpByDay.set(key, 0);
			focusByDay.set(key, 0);
		}
		for (const h of hist) {
			const key = dayKey(new Date(h.occurredAt));
			if (!xpByDay.has(key)) continue;
			// XP series should reflect undos (negative xpChange) and penalties too.
			// We include quest_complete, focus_session, timeframe_bonus, and penalty_* events.
			if (
				h.type === "quest_complete" ||
				h.type === "focus_session" ||
				h.type === "timeframe_bonus" ||
				h.type === "penalty_missed_day" ||
				h.type === "penalty_timeframe_miss"
			) {
				xpByDay.set(key, (xpByDay.get(key) || 0) + (h.xpChange || 0));
				if (h.type === "focus_session") {
					// convert xp to hours ~ 9 xp/min
					focusByDay.set(key, (focusByDay.get(key) || 0) + (h.xpChange || 0) / (9 * 60));
				}
			}
		}

		const xpSeries = Array.from(xpByDay.entries()).map(([date, xp]) => ({ date, xp: Math.round(xp) }));
		const focusSeries = Array.from(focusByDay.entries()).map(([day, hours]) => ({ day, hours: Number(hours.toFixed(2)) }));

		// Net quests completed: if a quest is undone, its earlier completion should not count.
		// We compute this by summing quest_complete xpChange per questId (positive on complete, negative on revert)
		// and counting questIds with net > 0.
		const netQuestAgg = await History.aggregate([
			{
				$match: {
					userId: user._id,
					type: "quest_complete",
					questId: { $ne: null },
				},
			},
			{
				$group: {
					_id: "$questId",
					net: { $sum: "$xpChange" },
				},
			},
			{
				$match: { net: { $gt: 0 } },
			},
			{
				$count: "count",
			},
		]);
		const questsCompleted = netQuestAgg?.[0]?.count ?? 0;
		const activityStreak = await computeActivityStreakDays(user._id);

		// This month aggregates
		const monthHistory = await History.find({ userId: user._id, occurredAt: { $gte: monthStart } }).lean();
		// Net month quests: completion undone within the same month should not count for month summary.
		const monthQuestNetById = new Map();
		for (const h of monthHistory) {
			if (h.type !== "quest_complete" || !h.questId) continue;
			const k = String(h.questId);
			monthQuestNetById.set(k, (monthQuestNetById.get(k) || 0) + (h.xpChange || 0));
		}
		const monthQuests = Array.from(monthQuestNetById.values()).filter((net) => net > 0).length;
		const monthFocusHours = Number(
			(monthHistory.filter((h) => h.type === "focus_session").reduce((s, h) => s + (h.xpChange || 0), 0) / (9 * 60)).toFixed(1)
		);
		const monthLevelsGained = monthHistory.filter((h) => h.type === "level_up").length;
		const monthAchievements = monthHistory.filter((h) => h.type === "achievement_unlocked").length;

		// Weekly quest completion series (last 4 weeks) — net-based so undos remove the completion.
		const fourWeeksAgo = new Date(now);
		fourWeeksAgo.setDate(now.getDate() - 27);
		fourWeeksAgo.setHours(0, 0, 0, 0);
		const questNet4w = await History.aggregate([
			{
				$match: {
					userId: user._id,
					type: "quest_complete",
					questId: { $ne: null },
					occurredAt: { $gte: fourWeeksAgo },
				},
			},
			{
				$group: {
					_id: "$questId",
					net: { $sum: "$xpChange" },
					lastPositiveAt: {
						$max: {
							$cond: [{ $gt: ["$xpChange", 0] }, "$occurredAt", null],
						},
					},
				},
			},
			{ $match: { net: { $gt: 0 } } },
		]);

		const weekBuckets = [0, 0, 0, 0];
		for (const row of questNet4w) {
			const at = row.lastPositiveAt ? new Date(row.lastPositiveAt) : null;
			if (!at || Number.isNaN(at.getTime())) continue;
			const ageDays = Math.floor((now.getTime() - at.getTime()) / (1000 * 60 * 60 * 24));
			const idx = 3 - Math.min(3, Math.floor(ageDays / 7)); // oldest->newest mapping
			weekBuckets[Math.max(0, Math.min(3, idx))] += 1;
		}
		const questWeeklySeries = [
			{ name: "Week 1", completed: weekBuckets[0] },
			{ name: "Week 2", completed: weekBuckets[1] },
			{ name: "Week 3", completed: weekBuckets[2] },
			{ name: "Week 4", completed: weekBuckets[3] },
		];

		const statsRadar = [
			{ stat: "Strength", value: user.stats?.strength ?? 0 },
			{ stat: "Intelligence", value: user.stats?.intelligence ?? 0 },
			{ stat: "Agility", value: user.stats?.agility ?? 0 },
			{ stat: "Vitality", value: user.stats?.vitality ?? 0 },
		];

		return res.json({
			stats: {
				totalXp: user.xp,
				questsCompleted,
				focusHours: Number(
					(hist.filter((h) => h.type === "focus_session").reduce((s, h) => s + h.xpChange, 0) / (9 * 60)).toFixed(1)
				),
				streak: activityStreak,
			},
			monthSummary: {
				questsCompleted: monthQuests,
				focusHours: monthFocusHours,
				levelsGained: monthLevelsGained,
				achievementsUnlocked: monthAchievements,
			},
			xpSeries,
			focusSeries,
			questWeeklySeries,
			statsRadar,
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to load analytics" });
	}
});

export default router;

