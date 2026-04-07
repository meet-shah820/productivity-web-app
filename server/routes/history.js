import express from "express";
import History from "../models/History.js";
import { getUserForReq } from "../utils/demoUser.js";
import { ACHIEVEMENTS } from "../data/achievements.js";

const router = express.Router();

function mapHistoryDoc(doc) {
	const meta = doc.meta || {};
	const at = doc.occurredAt || doc.createdAt;
	if (!at) return null;

	switch (doc.type) {
		case "quest_complete": {
			if ((doc.xpChange || 0) <= 0) return null;
			return {
				id: String(doc._id),
				type: "quest",
				message: `Completed quest: ${meta.title || "Quest"}`,
				xp: doc.xpChange,
				at: new Date(at).toISOString(),
				questId: doc.questId ? String(doc.questId) : undefined,
			};
		}
		case "penalty_missed_day": {
			const from = meta?.from ? new Date(meta.from).toISOString().slice(0, 10) : null;
			return {
				id: String(doc._id),
				type: "penalty",
				message: `Penalty: missed day${from ? ` (${from})` : ""}`,
				xp: doc.xpChange, // negative
				at: new Date(at).toISOString(),
			};
		}
		case "penalty_timeframe_miss": {
			const tf = meta?.timeframe || "daily";
			let label = "timeframe";
			if (tf === "weekly") label = "week";
			else if (tf === "monthly") label = "month";
			return {
				id: String(doc._id),
				type: "penalty",
				message: `Penalty: no quests completed last ${label}`,
				xp: doc.xpChange, // negative
				at: new Date(at).toISOString(),
			};
		}
		case "level_up":
			return {
				id: String(doc._id),
				type: "level",
				message: `Reached Level ${meta.level ?? "?"}!`,
				at: new Date(at).toISOString(),
			};
		case "achievement_unlocked": {
			const ach = ACHIEVEMENTS.find((a) => a.id === meta.achievementId);
			return {
				id: String(doc._id),
				type: "achievement",
				message: `Unlocked achievement: ${ach?.name || meta.achievementId}`,
				at: new Date(at).toISOString(),
				achievementId: meta.achievementId != null ? String(meta.achievementId) : undefined,
			};
		}
		case "focus_session": {
			if ((doc.xpChange || 0) <= 0) return null;
			return {
				id: String(doc._id),
				type: "focus",
				message: "Completed focus session",
				xp: doc.xpChange,
				at: new Date(at).toISOString(),
			};
		}
		case "timeframe_bonus": {
			if ((doc.xpChange || 0) <= 0) return null;
			const tf = meta.timeframe === "weekly" ? "weekly" : meta.timeframe === "monthly" ? "monthly" : "daily";
			const msg =
				tf === "weekly"
					? "Bonus: completed all weekly quests"
					: tf === "monthly"
						? "Bonus: completed all monthly quests"
						: "Bonus: completed all daily quests";
			return {
				id: String(doc._id),
				type: "quest",
				message: msg,
				xp: doc.xpChange,
				at: new Date(at).toISOString(),
			};
		}
		default:
			return null;
	}
}

// GET /api/history/recent — last 10 displayable events (quests, levels, achievements, focus)
router.get("/recent", async (_req, res) => {
	try {
		const user = await getUserForReq(_req);
		if (!user) return res.json({ items: [] });
		const raw = await History.find({ userId: user._id })
			.sort({ occurredAt: -1, createdAt: -1 })
			.limit(50)
			.lean();
		const items = [];
		// If a quest was reverted, hide the earlier "Completed quest" notification for it.
		// Since docs are sorted newest-first, we’ll see the revert first and then suppress the earlier completion.
		const suppressedQuestIds = new Set();
		for (const doc of raw) {
			if (doc.type === "quest_complete") {
				const qid = doc.questId ? String(doc.questId) : "";
				const reverted = !!(doc.meta && doc.meta.reverted);
				if (qid && (reverted || (doc.xpChange || 0) < 0)) {
					suppressedQuestIds.add(qid);
				}
				if (qid && (doc.xpChange || 0) > 0 && suppressedQuestIds.has(qid)) {
					// skip the earlier completion notification
					continue;
				}
			}
			const mapped = mapHistoryDoc(doc);
			if (mapped) items.push(mapped);
			if (items.length >= 10) break;
		}
		return res.json({ items });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to load history" });
	}
});

export default router;
