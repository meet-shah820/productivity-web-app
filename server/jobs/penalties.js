import cron from "node-cron";
import History from "../models/History.js";
import { getOrCreateDemoUser } from "../utils/demoUser.js";
import { scheduleLeaderboardBroadcast } from "../services/leaderboardHub.js";
import {
	startOfDay,
	endOfDay,
	startOfWeekMonday,
	endOfWeekSunday,
	startOfMonth,
	endOfMonth,
} from "../utils/timeframePeriod.js";

// Helper to safely apply XP change and record history
async function applyXpChange(user, delta, type, meta, occurredAt = new Date()) {
	const newXp = Math.max(0, (user.xp || 0) + delta);
	const xpChange = newXp - (user.xp || 0);
	if (xpChange === 0) return;
	user.xp = newXp;
	await user.save();
	scheduleLeaderboardBroadcast();
	await History.create({
		userId: user._id,
		type,
		xpChange, // negative for penalties
		meta,
		occurredAt,
	});
	// eslint-disable-next-line no-console
	console.log(`[XP] ${type}: ${xpChange}XP @ ${occurredAt.toISOString()}`);
}

// Daily at 00:05 — apply penalties for missed activity and timeframe with zero completions
cron.schedule("5 0 * * *", async () => {
	try {
		const user = await getOrCreateDemoUser();
		if (!user) return;

		const now = new Date();

		// 1) Missed day penalty: no quest_complete or focus_session yesterday
		const yFrom = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
		const yTo = endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
		const dailyCount = await History.countDocuments({
			userId: user._id,
			type: { $in: ["quest_complete", "focus_session", "timeframe_bonus"] },
			xpChange: { $gt: 0 },
			occurredAt: { $gte: yFrom, $lte: yTo },
		});
		if (dailyCount === 0) {
			// 10 XP penalty for missed day
			await applyXpChange(user, -10, "penalty_missed_day", { from: yFrom, to: yTo, timeframe: "daily" }, yTo);
		}

		// 2) Weekly timeframe penalty (check on Mondays for the previous week) — quest completions only
		if (now.getDay() === 1) {
			const lastWeekEnd = endOfWeekSunday(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
			const lastWeekStart = startOfWeekMonday(new Date(lastWeekEnd));
			const weeklyQuestCompletions = await History.countDocuments({
				userId: user._id,
				type: "quest_complete",
				xpChange: { $gt: 0 },
				occurredAt: { $gte: lastWeekStart, $lte: lastWeekEnd },
			});
			if (weeklyQuestCompletions === 0) {
				// 30 XP penalty for missing any weekly quest
				await applyXpChange(
					user,
					-30,
					"penalty_timeframe_miss",
					{ timeframe: "weekly", from: lastWeekStart, to: lastWeekEnd },
					lastWeekEnd
				);
			}
		}

		// 3) Monthly timeframe penalty (check on the 1st for previous calendar month)
		if (now.getDate() === 1) {
			const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
			const mFrom = startOfMonth(prevMonth);
			const mTo = endOfMonth(prevMonth);
			const monthlyQuestCompletions = await History.countDocuments({
				userId: user._id,
				type: "quest_complete",
				xpChange: { $gt: 0 },
				occurredAt: { $gte: mFrom, $lte: mTo },
			});
			if (monthlyQuestCompletions === 0) {
				// 80 XP penalty for missing any monthly quest
				await applyXpChange(user, -80, "penalty_timeframe_miss", { timeframe: "monthly", from: mFrom, to: mTo }, mTo);
			}
		}
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error("Cron penalty job error:", err);
	}
});

