import express from "express";
import User from "../models/User.js";
import History from "../models/History.js";
import AchievementUnlock from "../models/AchievementUnlock.js";
import { ACHIEVEMENTS } from "../data/achievements.js";
import { getUserForReq } from "../utils/demoUser.js";
import { computeActivityStreakDays } from "../utils/activityStreak.js";

const router = express.Router();

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

function normalizeUsernameInput(raw) {
	return String(raw ?? "")
		.trim()
		.replace(/^@+/, "")
		.replace(/\s+/g, "_")
		.toLowerCase();
}

function validateAvatarDataUrl(raw) {
	if (raw == null || raw === "") return { ok: true, value: "" };
	const s = String(raw);
	if (!/^data:image\/(jpeg|jpg|png|gif);base64,/i.test(s)) {
		return { ok: false, error: "Avatar must be JPG, PNG, or GIF" };
	}
	const parts = s.split(",");
	if (parts.length < 2) return { ok: false, error: "Invalid image data" };
	try {
		const buf = Buffer.from(parts[parts.length - 1], "base64");
		if (buf.length > AVATAR_MAX_BYTES) {
			return { ok: false, error: "Image too large (max 2MB)" };
		}
	} catch {
		return { ok: false, error: "Invalid image data" };
	}
	if (s.length > 3 * 1024 * 1024) {
		return { ok: false, error: "Image payload too large" };
	}
	return { ok: true, value: s };
}

function normalizeEmail(raw) {
	const s = String(raw ?? "").trim().slice(0, 320);
	if (!s) return "";
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
	return s;
}

router.get("/", async (_req, res) => {
	try {
		const user = await getUserForReq(req);
		// Net quests completed: if a quest is undone, it should not count.
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
		const focusXp = (await History.find({ userId: user._id, type: "focus_session" }).lean()).reduce((s, h) => s + (h.xpChange || 0), 0);
		const focusHours = Number((focusXp / (9 * 60)).toFixed(1));

		const unlocks = await AchievementUnlock.find({ userId: user._id }).sort({ unlockedAt: -1 }).limit(6).lean();
		const recentAchievements = unlocks
			.map((u) => ACHIEVEMENTS.find((a) => a.id === u.achievementId))
			.filter(Boolean)
			.map((a) => ({ id: a.id, name: a.name, rarity: a.rarity }));

		const recentActivity = await History.find({ userId: user._id }).sort({ occurredAt: -1 }).limit(10).lean();
		const activityStreak = await computeActivityStreakDays(user._id);

		return res.json({
			user: {
				username: user.username,
				displayName: user.displayName || "",
				email: user.email || "",
				bio: user.bio || "",
				avatarDataUrl: user.avatarDataUrl || "",
				level: user.level,
				xp: user.xp,
				nextLevelXp: Math.pow(user.level, 2) * 100,
				stats: user.stats,
				streak: activityStreak,
				rank: user.rank || "E",
			},
			quickStats: { questsCompleted, focusHours, totalXp: user.xp },
			recentAchievements,
			recentActivity,
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to load profile" });
	}
});

/** PATCH /api/profile — partial updates: username, displayName, email, bio, avatarDataUrl, clearAvatar */
router.patch("/", async (req, res) => {
	try {
		const user = await getUserForReq(req);
		const body = req.body || {};

		if (body.username != null) {
			const username = normalizeUsernameInput(body.username);
			if (username.length < 3 || username.length > 32) {
				return res.status(400).json({ error: "Username must be 3–32 characters" });
			}
			if (!/^[a-z0-9_]+$/.test(username)) {
				return res.status(400).json({ error: "Use only letters, numbers, and underscores" });
			}
			const taken = await User.findOne({ username, _id: { $ne: user._id } });
			if (taken) {
				return res.status(409).json({ error: "That username is already taken" });
			}
			user.username = username;
		}

		if (body.displayName != null) {
			user.displayName = String(body.displayName).trim().slice(0, 64);
		}

		if (body.email != null) {
			const em = normalizeEmail(body.email);
			if (em === null) {
				return res.status(400).json({ error: "Invalid email address" });
			}
			user.email = em;
		}

		if (body.bio != null) {
			user.bio = String(body.bio).trim().slice(0, 500);
		}

		if (body.clearAvatar === true) {
			user.avatarDataUrl = "";
		} else if (body.avatarDataUrl != null) {
			const av = validateAvatarDataUrl(body.avatarDataUrl);
			if (!av.ok) {
				return res.status(400).json({ error: av.error });
			}
			user.avatarDataUrl = av.value;
		}

		await user.save();
		const activityStreak = await computeActivityStreakDays(user._id);
		return res.json({
			user: {
				username: user.username,
				displayName: user.displayName || "",
				email: user.email || "",
				bio: user.bio || "",
				avatarDataUrl: user.avatarDataUrl || "",
				level: user.level,
				xp: user.xp,
				nextLevelXp: Math.pow(user.level, 2) * 100,
				stats: user.stats,
				streak: activityStreak,
				rank: user.rank || "E",
			},
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to update profile" });
	}
});

export default router;

