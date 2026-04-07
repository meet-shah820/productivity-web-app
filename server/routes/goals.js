import express from "express";
import mongoose from "mongoose";
import Goal from "../models/Goal.js";
import Quest from "../models/Quest.js";
import { getUserForReq } from "../utils/demoUser.js";
import { generateDailyQuests, pickQuestsBalancedByDifficulty } from "../services/gemini.js";
import { calculateLevelFromXp } from "../utils/level.js";
import History from "../models/History.js";
import { evaluateAndRecordAchievements } from "../services/achievementsEngine.js";
import { recalculateAndSaveUserRank } from "../services/rankEngine.js";

const router = express.Router();

const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
const LEGACY_DIFF_TO_RARITY = {
	Easy: "common",
	Medium: "rare",
	Hard: "epic",
	Epic: "legendary",
};

function normalizeGoalRarity(g) {
	if (g.rarity && Object.prototype.hasOwnProperty.call(RARITY_ORDER, g.rarity)) return g.rarity;
	if (g.difficulty && LEGACY_DIFF_TO_RARITY[g.difficulty]) return LEGACY_DIFF_TO_RARITY[g.difficulty];
	return "common";
}

// GET /api/goals — sorted by rarity: common → mythic (easiest → hardest)
router.get("/", async (req, res) => {
	try {
		const user = await getUserForReq(req);
		const raw = await Goal.find({ userId: user._id, status: "active" }).lean();
		if (raw.length === 0) {
			await Quest.deleteMany({ userId: user._id });
		}
		const goals = raw
			.map((g) => {
				const rarity = normalizeGoalRarity(g);
				return { ...g, rarity, _r: RARITY_ORDER[rarity] ?? 0 };
			})
			.sort((a, b) => {
				if (a._r !== b._r) return a._r - b._r;
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			})
			.map(({ _r, ...g }) => g);
		return res.json({ goals });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to fetch goals" });
	}
});

// POST /api/goals
router.post("/", async (req, res) => {
	try {
		const { title, category, rarity: rawRarity } = req.body || {};
		if (!title) {
			return res.status(400).json({ error: "title is required" });
		}

		const rarity =
			rawRarity && Object.prototype.hasOwnProperty.call(RARITY_ORDER, String(rawRarity).toLowerCase())
				? String(rawRarity).toLowerCase()
				: "common";

		const user = await getUserForReq(req);
		const goalCategory = category || "general";
		const goal = await Goal.create({
			userId: user._id,
			title,
			category: goalCategory,
			rarity,
		});

		// Gemini: daily quests for the next 7 days (5 per day), weekly milestones for the next 4 weeks
		const userLevel = calculateLevelFromXp(user.xp);
		const questsToInsert = [];
		for (let i = 0; i < 7; i++) {
			const aiQuests = await generateDailyQuests({
				goalTitle: title,
				currentLevel: userLevel,
				category: goalCategory,
				timeframe: "daily",
			});
			const date = new Date();
			date.setDate(date.getDate() + i);
			for (const q of aiQuests) {
				questsToInsert.push({
					userId: user._id,
					goalId: goal._id,
					title: q.title,
					xpReward: q.xp,
					statType: q.statType,
					difficulty: q.difficulty || "medium",
					isCompleted: false,
					type: "daily",
					date,
				});
			}
		}
		for (let w = 0; w < 4; w++) {
			const weekDate = new Date();
			weekDate.setDate(weekDate.getDate() + w * 7);
			const aiQuestsWeekly = await generateDailyQuests({
				goalTitle: title,
				currentLevel: userLevel,
				category: goalCategory,
				timeframe: "weekly",
			});
			for (const q of pickQuestsBalancedByDifficulty(aiQuestsWeekly, 3)) {
				questsToInsert.push({
					userId: user._id,
					goalId: goal._id,
					title: q.title,
					xpReward: Math.round(q.xp || 200),
					statType: q.statType,
					difficulty: q.difficulty || "medium",
					isCompleted: false,
					type: "weekly",
					date: weekDate,
				});
			}
		}
		for (let m = 0; m < 3; m++) {
			const monthDate = new Date();
			monthDate.setMonth(monthDate.getMonth() + m);
			monthDate.setDate(1);
			monthDate.setHours(12, 0, 0, 0);
			const aiQuestsMonthly = await generateDailyQuests({
				goalTitle: title,
				currentLevel: userLevel,
				category: goalCategory,
				timeframe: "monthly",
			});
			for (const q of pickQuestsBalancedByDifficulty(aiQuestsMonthly, 2)) {
				questsToInsert.push({
					userId: user._id,
					goalId: goal._id,
					title: q.title,
					xpReward: Math.round(q.xp || 400),
					statType: q.statType,
					difficulty: q.difficulty || "medium",
					isCompleted: false,
					type: "monthly",
					date: monthDate,
				});
			}
		}
		if (questsToInsert.length) {
			await Quest.insertMany(questsToInsert);
		}

		const goalsActive = await Goal.find({ userId: user._id, status: "active" }).lean();
		const hist = await History.find({ userId: user._id }).lean();
		const questsCompleted = hist.filter((h) => h.type === "quest_complete" && h.xpChange > 0).length;
		const focusXp = hist.filter((h) => h.type === "focus_session").reduce((s, h) => s + (h.xpChange || 0), 0);
		const focusHours = focusXp / (9 * 60);
		await evaluateAndRecordAchievements({ user, goals: goalsActive, questsCompleted, focusHours });

		const rank = await recalculateAndSaveUserRank(user._id, { preferGemini: true });

		return res.status(201).json({ goalId: goal._id, rank: rank || user.rank || "E" });
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error(err);
		return res.status(500).json({ error: "Failed to create goal" });
	}
});

// DELETE /api/goals/:id — archive so it no longer appears in GET / (active-only)
router.delete("/:id", async (req, res) => {
	try {
		const { id } = req.params;
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({ error: "Invalid goal id" });
		}
		const user = await getUserForReq(req);
		const goal = await Goal.findOneAndUpdate(
			{ _id: id, userId: user._id },
			{ status: "archived" },
			{ new: true }
		);
		if (!goal) {
			return res.status(404).json({ error: "Goal not found" });
		}
		await Quest.deleteMany({ goalId: goal._id, userId: user._id });
		return res.json({ ok: true });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to delete goal" });
	}
});

export default router;

