import User from "../models/User.js";
import History from "../models/History.js";
import AchievementUnlock from "../models/AchievementUnlock.js";
import Goal from "../models/Goal.js";
import { evaluateHunterRank } from "./gemini.js";
import { computeActivityStreakDays } from "../utils/activityStreak.js";
import { scheduleLeaderboardBroadcast } from "./leaderboardHub.js";

const RANKS = ["E", "D", "C", "B", "A", "S"];
const RANK_ORDER = Object.fromEntries(RANKS.map((r, i) => [r, i]));

/** Same unlock thresholds as skills route (12 skills) */
const SKILL_UNLOCK_LEVELS = [2, 4, 8, 2, 4, 8, 3, 5, 9, 2, 6, 12];

export async function gatherRankContext(user) {
	const userId = user._id;
	const activityStreak = await computeActivityStreakDays(userId);
	const questsCompleted = await History.countDocuments({
		userId,
		type: "quest_complete",
		xpChange: { $gt: 0 },
	});
	const achievementsUnlocked = await AchievementUnlock.countDocuments({ userId });
	const focusAgg = await History.aggregate([
		{ $match: { userId, type: "focus_session" } },
		{ $group: { _id: null, total: { $sum: "$xpChange" } } },
	]);
	const focusXp = focusAgg?.[0]?.total || 0;
	const focusHours = Math.round((focusXp / (9 * 60)) * 10) / 10;
	const activeGoals = await Goal.countDocuments({ userId, status: "active" });
	const archivedGoals = await Goal.countDocuments({ userId, status: "archived" });
	const stats = user.stats || {};
	const statSum =
		(stats.strength || 0) + (stats.intelligence || 0) + (stats.agility || 0) + (stats.vitality || 0);
	const skillsUnlocked = SKILL_UNLOCK_LEVELS.filter((lv) => user.level >= lv).length;

	return {
		level: user.level,
		xp: user.xp,
		questsCompleted,
		achievementsUnlocked,
		focusHours,
		activeGoals,
		goalsFinishedOrArchived: archivedGoals,
		statSum,
		skillsUnlocked,
		streak: activityStreak,
	};
}

/** Deterministic strict fallback when Gemini is unavailable */
export function rankFromFallback(ctx) {
	let score = 0;
	score += Math.min(ctx.level / 50, 1) * 26;
	score += Math.min(ctx.questsCompleted / 180, 1) * 24;
	score += Math.min(ctx.achievementsUnlocked / 9, 1) * 18;
	score += Math.min(ctx.focusHours / 100, 1) * 12;
	score += Math.min(ctx.statSum / 220, 1) * 10;
	score += Math.min(ctx.skillsUnlocked / 12, 1) * 6;
	score += Math.min((ctx.activeGoals + ctx.goalsFinishedOrArchived) / 18, 1) * 4;
	if (score >= 90) return "S";
	if (score >= 74) return "A";
	if (score >= 58) return "B";
	if (score >= 40) return "C";
	if (score >= 22) return "D";
	return "E";
}

function rankMax(a, b) {
	return RANK_ORDER[a] >= RANK_ORDER[b] ? a : b;
}

/**
 * Re-evaluates rank (Gemini when possible), applies monotonic increase only, saves user.
 * @param {import("mongoose").Types.ObjectId} userId
 * @param {{ preferGemini?: boolean }} [options]
 */
export async function recalculateAndSaveUserRank(userId, options = {}) {
	const { preferGemini = true } = options;
	const user = await User.findById(userId);
	if (!user) return null;

	const ctx = await gatherRankContext(user);
	let proposed = null;
	if (preferGemini) {
		proposed = await evaluateHunterRank(ctx);
	}
	if (!proposed) {
		proposed = rankFromFallback(ctx);
	}

	const current = user.rank && RANKS.includes(user.rank) ? user.rank : "E";
	const next = rankMax(current, proposed);
	user.rank = next;
	if (user.isModified("rank")) {
		await user.save();
	}

	scheduleLeaderboardBroadcast();

	return next;
}
