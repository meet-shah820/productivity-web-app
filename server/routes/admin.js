import express from "express";
import User from "../models/User.js";
import Goal from "../models/Goal.js";
import Quest from "../models/Quest.js";
import History from "../models/History.js";
import AchievementUnlock from "../models/AchievementUnlock.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

async function pickResetUsername(userId) {
	const desired = "shadow_hunter";
	const existing = await User.findOne({ username: desired });
	if (!existing) return desired;
	if (String(existing._id) === String(userId)) return desired;
	for (let i = 0; i < 20; i++) {
		const candidate = `${desired}_${Math.floor(Math.random() * 9000 + 1000)}`;
		// eslint-disable-next-line no-await-in-loop
		const taken = await User.findOne({ username: candidate });
		if (!taken) return candidate;
	}
	return `${desired}_${Date.now()}`;
}

router.post("/reset", requireAuth, async (req, res) => {
	try {
		const userId = req.user._id;
		const resetUsername = await pickResetUsername(userId);
		await Quest.deleteMany({ userId });
		await Goal.deleteMany({ userId });
		await History.deleteMany({ userId });
		await AchievementUnlock.deleteMany({ userId });
		await User.updateOne(
			{ _id: userId },
			{
				$set: {
					username: resetUsername,
					displayName: "shadow_hunter",
					level: 1,
					xp: 0,
					streak: 0,
					rank: "E",
					stats: { strength: 0, intelligence: 0, agility: 0, vitality: 0 },
				},
			}
		);
		return res.json({ ok: true, username: resetUsername });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "failed to reset" });
	}
});

export default router;

