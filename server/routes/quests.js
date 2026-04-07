import express from "express";
import mongoose from "mongoose";
import Quest from "../models/Quest.js";
import User from "../models/User.js";
import { getUserForReq } from "../utils/demoUser.js";
import { calculateLevelFromXp } from "../utils/level.js";
import History from "../models/History.js";
import Goal from "../models/Goal.js";
import { evaluateAndRecordAchievements } from "../services/achievementsEngine.js";
import { recalculateAndSaveUserRank } from "../services/rankEngine.js";
import { generateQuestDetails } from "../services/gemini.js";
import { computeQuestExpiry } from "../utils/timeframePeriod.js";
import {
	startOfDay,
	endOfDay,
	startOfMonth,
	endOfMonth,
	rollingWeeklyStart,
	rollingWeeklyEnd,
	rollingMonthlyStart,
	rollingMonthlyEnd,
	periodKeyDaily,
	periodKeyWeeklyRolling,
	periodKeyMonthlyRolling,
} from "../utils/timeframePeriod.js";

const router = express.Router();

/** Increment when quest briefing prompts change so clients get fresh Gemini content. */
const BRIEFING_SCHEMA_VERSION = 6;

/** XP granted once when every quest in that timeframe window for the user is completed. */
const TIMEFRAME_SET_BONUS_XP = { daily: 150, weekly: 400, monthly: 900 };

/**
 * If completing `completedQuest` finishes the full set for its day/week/month, grant bonus XP once.
 * Mutates `user` (xp, level) and saves when a bonus is awarded.
 */
async function maybeAwardTimeframeSetBonus(user, completedQuest) {
	const t = completedQuest.type;
	if (!["daily", "weekly", "monthly"].includes(t)) {
		return { awarded: 0, leveledUp: false };
	}

	const ref = completedQuest.date ? new Date(completedQuest.date) : new Date();
	let dateFilter;
	let periodKey;
	const bonusXp = TIMEFRAME_SET_BONUS_XP[t];
	if (bonusXp == null || bonusXp <= 0) return { awarded: 0, leveledUp: false };

	if (t === "daily") {
		dateFilter = { $gte: startOfDay(ref), $lte: endOfDay(ref) };
		periodKey = periodKeyDaily(ref);
	} else if (t === "weekly") {
		dateFilter = { $gte: rollingWeeklyStart(ref), $lte: rollingWeeklyEnd(ref) };
		periodKey = periodKeyWeeklyRolling(ref);
	} else {
		dateFilter = { $gte: rollingMonthlyStart(ref), $lte: rollingMonthlyEnd(ref) };
		periodKey = periodKeyMonthlyRolling(ref);
	}

	const inPeriod = await Quest.find({
		userId: user._id,
		type: t,
		date: dateFilter,
	}).lean();

	if (inPeriod.length === 0 || !inPeriod.every((q) => q.isCompleted)) {
		return { awarded: 0, leveledUp: false };
	}

	const existing = await History.findOne({
		userId: user._id,
		type: "timeframe_bonus",
		"meta.periodKey": periodKey,
	}).lean();
	if (existing) return { awarded: 0, leveledUp: false };

	const preBonusLevel = calculateLevelFromXp(user.xp);
	user.xp += bonusXp;
	const postBonusLevel = calculateLevelFromXp(user.xp);
	user.level = postBonusLevel;
	await user.save();

	const label =
		t === "daily" ? "daily quests" : t === "weekly" ? "weekly quests" : "monthly quests";
	await History.create({
		userId: user._id,
		type: "timeframe_bonus",
		xpChange: bonusXp,
		meta: { periodKey, timeframe: t, bonusKind: "all_complete", label },
	});

	if (postBonusLevel > preBonusLevel) {
		await History.create({
			userId: user._id,
			type: "level_up",
			xpChange: 0,
			meta: { level: postBonusLevel },
		});
	}

	return { awarded: bonusXp, leveledUp: postBonusLevel > preBonusLevel };
}

function mapQuestDifficulty(d) {
	if (d === "easy" || d === "medium" || d === "hard") return d;
	return "medium";
}

// GET /api/quests?timeframe=daily|weekly|monthly&difficulty=easy|medium|hard
router.get("/", async (req, res) => {
	try {
		const timeframe = (req.query.timeframe || "daily").toString();
		const goalId = req.query.goalId ? req.query.goalId.toString() : null;
		const diffRaw = req.query.difficulty ? String(req.query.difficulty).toLowerCase() : null;
		const userId = (await getUserForReq(req))._id;
		let filter = { userId, type: timeframe };
		if (goalId) filter = { ...filter, goalId };
		if (diffRaw && ["easy", "medium", "hard"].includes(diffRaw)) {
			filter = { ...filter, difficulty: diffRaw };
		}
		if (timeframe === "daily") {
			const start = new Date();
			start.setHours(0, 0, 0, 0);
			const end = new Date();
			end.setHours(23, 59, 59, 999);
			filter = { ...filter, date: { $gte: start, $lte: end }, isExpired: { $ne: true } };
		}
		// For weekly/monthly, switch to rolling windows per quest: fetch all by type and filter in JS
		let quests;
		if (timeframe === "weekly") {
			const allWeekly = await Quest.find({ ...filter, type: "weekly", isExpired: { $ne: true } }).sort({ createdAt: -1 }).lean();
			const now = new Date();
			quests = allWeekly.filter((q) => {
				const start = rollingWeeklyStart(q.date || now);
				const end = rollingWeeklyEnd(q.date || now);
				return now >= start && now <= end;
			});
		} else if (timeframe === "monthly") {
			const allMonthly = await Quest.find({ ...filter, type: "monthly", isExpired: { $ne: true } }).sort({ createdAt: -1 }).lean();
			const now = new Date();
			quests = allMonthly.filter((q) => {
				const start = rollingMonthlyStart(q.date || now);
				const end = rollingMonthlyEnd(q.date || now);
				return now >= start && now <= end;
			});
		} else {
			quests = await Quest.find({ ...filter, isExpired: { $ne: true } }).sort({ createdAt: -1 }).lean();
		}
		return res.json({
			quests: quests.map((q) => ({
				id: q._id,
				goalId: q.goalId,
				title: q.title,
				xp: q.xpReward,
				isCompleted: q.isCompleted,
				statType: q.statType,
				type: q.type,
				difficulty: mapQuestDifficulty(q.difficulty),
				expiresAt: (q.expiresAt || computeQuestExpiry(q.type, q.date)).toISOString(),
			})),
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to fetch quests" });
	}
});

function hasStoredBriefing(questDoc) {
	if (!questDoc.briefingSchemaVersion || questDoc.briefingSchemaVersion < BRIEFING_SCHEMA_VERSION) {
		return false;
	}
	const b = questDoc.briefing;
	if (!b || !b.summary || String(b.summary).trim().length < 8) return false;
	if (!Array.isArray(b.steps) || b.steps.length < 1) return false;
	if (!String(b.whatYouImprove || "").trim()) return false;
	return true;
}

// GET /api/quests/:id/details — System briefing (Gemini); cached on quest after first load
router.get("/:id/details", async (req, res) => {
	try {
		const { id } = req.params;
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({ error: "Invalid quest id" });
		}
		const user = await getUserForReq(req);
		const quest = await Quest.findOne({ _id: id, userId: user._id });
		if (!quest) {
			return res.status(404).json({ error: "Quest not found" });
		}
		const goal = quest.goalId ? await Goal.findById(quest.goalId).lean() : null;
		const userLevel = calculateLevelFromXp(user.xp);
		const diff = mapQuestDifficulty(quest.difficulty);

		let details;
		if (hasStoredBriefing(quest)) {
			details = {
				summary: quest.briefing.summary,
				whatYouImprove: quest.briefing.whatYouImprove || "",
				doneWhen: quest.briefing.doneWhen || "",
				steps: quest.briefing.steps,
				tips: quest.briefing.tips || "",
				source: quest.briefing.source || "fallback",
			};
		} else {
			details = await generateQuestDetails({
				questTitle: quest.title,
				goalTitle: goal?.title || "Your goal",
				goalCategory: goal?.category || "general",
				goalRarity: goal?.rarity || "common",
				questType: quest.type || "daily",
				statType: quest.statType,
				xpReward: quest.xpReward,
				difficulty: diff,
				userLevel,
				isCompleted: !!quest.isCompleted,
			});
			quest.briefing = {
				summary: details.summary,
				whatYouImprove: details.whatYouImprove || "",
				doneWhen: details.doneWhen || "",
				requirements: "",
				howTo: "",
				steps: details.steps || [],
				tips: details.tips || "",
				source: details.source === "gemini" ? "gemini" : "fallback",
			};
			quest.briefingGeneratedAt = new Date();
			quest.briefingSchemaVersion = BRIEFING_SCHEMA_VERSION;
			await quest.save();
		}

		return res.json({
			quest: {
				id: quest._id,
				title: quest.title,
				xpReward: quest.xpReward,
				statType: quest.statType,
				type: quest.type,
				isCompleted: quest.isCompleted,
				goalId: quest.goalId,
				difficulty: diff,
			},
			goal: goal
				? { id: goal._id, title: goal.title, category: goal.category }
				: null,
			details,
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to load quest details" });
	}
});

// PATCH /api/quests/:id/complete
router.patch("/:id/complete", async (req, res) => {
	try {
		const { id } = req.params;
		const quest = await Quest.findById(id);
		if (!quest) {
			return res.status(404).json({ error: "Quest not found" });
		}
		if (quest.isCompleted) {
			return res.json({ updated: false, leveledUp: false });
		}
		// Prevent completing expired quests
		if (quest.isExpired || (quest.expiresAt && new Date(quest.expiresAt) < new Date())) {
			return res.status(400).json({ error: "Quest has expired" });
		}

		quest.isCompleted = true;
		await quest.save();

		// Update user stats and xp
		const user = await User.findById(quest.userId);
		if (!user) {
			return res.status(500).json({ error: "User not found for quest" });
		}

		const preLevel = calculateLevelFromXp(user.xp);
		user.xp += quest.xpReward;

		// increment appropriate stat
		const incMap = {
			str: "strength",
			int: "intelligence",
			agi: "agility",
			vit: "vitality",
		};
		const statKey = incMap[quest.statType] || "strength";
		user.stats[statKey] = (user.stats[statKey] || 0) + 1;

		const postLevel = calculateLevelFromXp(user.xp);
		user.level = postLevel;
		await user.save();

		await History.create({
			userId: user._id,
			type: "quest_complete",
			xpChange: quest.xpReward,
			questId: quest._id,
			meta: { statType: quest.statType, title: quest.title },
		});
		if (postLevel > preLevel) {
			await History.create({
				userId: user._id,
				type: "level_up",
				xpChange: 0,
				meta: { level: postLevel },
			});
		}

		const bonus = await maybeAwardTimeframeSetBonus(user, quest);
		const leveledUpFromBonus = bonus.leveledUp;

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
			updated: true,
			leveledUp: postLevel > preLevel || leveledUpFromBonus,
			timeframeBonusXp: bonus.awarded || 0,
			user: {
				level: user.level,
				xp: user.xp,
				stats: user.stats,
				rank: rank || user.rank || "E",
			},
		});
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error(err);
		return res.status(500).json({ error: "Failed to complete quest" });
	}
});

// PATCH /api/quests/:id/revert
router.patch("/:id/revert", async (req, res) => {
	try {
		const { id } = req.params;
		const quest = await Quest.findById(id);
	 if (!quest) {
			return res.status(404).json({ error: "Quest not found" });
		}
		if (!quest.isCompleted) {
			return res.json({ updated: false });
		}
		const user = await User.findById(quest.userId);
		if (!user) return res.status(500).json({ error: "User not found for quest" });

		// revert quest completion
		quest.isCompleted = false;
		await quest.save();

		// decrement xp and stat (minimum 0)
		user.xp = Math.max(0, user.xp - quest.xpReward);
		const map = { str: "strength", int: "intelligence", agi: "agility", vit: "vitality" };
		const key = map[quest.statType] || "strength";
		user.stats[key] = Math.max(0, (user.stats[key] || 0) - 1);
		user.level = calculateLevelFromXp(user.xp);
		await user.save();

		await History.create({
			userId: user._id,
			type: "quest_complete",
			xpChange: -quest.xpReward,
			questId: quest._id,
			meta: { reverted: true, statType: quest.statType, title: quest.title },
		});

		return res.json({
			updated: true,
			user: { level: user.level, xp: user.xp, stats: user.stats },
		});
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error(err);
		return res.status(500).json({ error: "Failed to revert quest" });
	}
});

export default router;

