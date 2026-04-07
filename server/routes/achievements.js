import express from "express";
import History from "../models/History.js";
import { getUserForReq } from "../utils/demoUser.js";
import Goal from "../models/Goal.js";
import { ACHIEVEMENTS } from "../data/achievements.js";
import AchievementUnlock from "../models/AchievementUnlock.js";
import { evaluateAndRecordAchievements } from "../services/achievementsEngine.js";
import { recalculateAndSaveUserRank } from "../services/rankEngine.js";
import { categoriesFromGoals, isAchievementApplicable } from "../utils/achievementAvailability.js";

const router = express.Router();

router.get("/", async (req, res) => {
	try {
		const user = await getUserForReq(req);
		const goals = await Goal.find({ userId: user._id, status: "active" }).lean();
		const categories = categoriesFromGoals(goals);

		// aggregates from history
		const sinceEpoch = new Date(0);
		const hist = await History.find({ userId: user._id, occurredAt: { $gte: sinceEpoch } }).lean();
		const questsCompleted = hist.filter((h) => h.type === "quest_complete" && h.xpChange > 0).length;
		const focusXp = hist.filter((h) => h.type === "focus_session").reduce((s, h) => s + h.xpChange, 0);
		// assuming 90 xp per 10 minutes baseline ~ 9 xp/min, hours approx:
		const focusHours = focusXp / (9 * 60);

		// ensure unlocks are recorded (so Profile recent achievements can be real)
		await evaluateAndRecordAchievements({ user, goals, questsCompleted, focusHours });
		const rank = await recalculateAndSaveUserRank(user._id, { preferGemini: true });
		const unlockDocs = await AchievementUnlock.find({ userId: user._id }).lean();
		const unlockedIds = new Set(unlockDocs.map((d) => d.achievementId));

		const unlocked = ACHIEVEMENTS.filter((a) => unlockedIds.has(a.id));
		// Single pool: locked OR unlocked. Category-gated achievements stay visible as locked until a matching goal exists.
		const locked = ACHIEVEMENTS.filter((a) => !unlockedIds.has(a.id)).map((a) => {
			const applicable = isAchievementApplicable(a, categories);
			return {
				...a,
				...(a.requiredCategory && !applicable
					? { blockedByCategory: a.requiredCategory }
					: {}),
			};
		});

		const recentUnlocked = unlockDocs
			.sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime())
			.slice(0, 6)
			.map((d) => d.achievementId);

		return res.json({
			unlocked,
			locked,
			notApplicable: [],
			recentUnlocked,
			rank: rank || user.rank || "E",
			stats: { questsCompleted, focusHours, totalXp: user.xp },
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to load achievements" });
	}
});

export default router;

