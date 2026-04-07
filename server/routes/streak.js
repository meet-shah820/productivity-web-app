import express from "express";
import History from "../models/History.js";
import { getUserForReq } from "../utils/demoUser.js";

const router = express.Router();

function startOfDay(d) {
	const dd = new Date(d);
	dd.setHours(0, 0, 0, 0);
	return dd;
}

function endOfDay(d) {
	const dd = new Date(d);
	dd.setHours(23, 59, 59, 999);
	return dd;
}

function ymd(d) {
	const yy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${yy}-${mm}-${dd}`;
}

/** Compute streaks (current and longest) from a sorted list of day booleans. */
function computeStreaks(days) {
	// days: [{ date: 'YYYY-MM-DD', hasCompletion: boolean }]
	let longest = { length: 0, start: null, end: null };
	let currentRun = { length: 0, start: null, end: null };
	let bestRun = { length: 0, start: null, end: null };

	for (let i = 0; i < days.length; i++) {
		const d = days[i];
		if (d.hasCompletion) {
			if (currentRun.length === 0) {
				currentRun = { length: 1, start: d.date, end: d.date };
			} else {
				currentRun = { length: currentRun.length + 1, start: currentRun.start, end: d.date };
			}
			if (currentRun.length > bestRun.length) {
				bestRun = { ...currentRun };
			}
		} else {
			currentRun = { length: 0, start: null, end: null };
		}
	}
	longest = bestRun.length > 0 ? bestRun : { length: 0, start: null, end: null };

	// Current streak is the run that ends on the last calendar day if that day hasCompletion,
	// otherwise it's the run that ends the day before today if consecutive until then.
	const last = days[days.length - 1];
	let current = { length: 0, start: null, end: null };
	if (last && last.hasCompletion) {
		// walk backwards until a gap
		let len = 0;
		let start = null;
		for (let i = days.length - 1; i >= 0; i--) {
			if (days[i].hasCompletion) {
				len++;
				start = days[i].date;
			} else {
				break;
			}
		}
		current = { length: len, start, end: last.date };
	}
	return { current, longest };
}

// GET /api/streak/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/calendar", async (req, res) => {
	try {
		const user = await getUserForReq(req);
		if (!user) return res.json({ days: [], current: { length: 0 }, longest: { length: 0 } });

		const now = new Date();
		const fromStr = String(req.query.from || "");
		const toStr = String(req.query.to || "");

		let from = startOfDay(!fromStr ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(fromStr));
		let to = endOfDay(!toStr ? new Date(now.getFullYear(), now.getMonth() + 1, 0) : new Date(toStr));

		// Guard invalid ranges
		if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
			return res.status(400).json({ error: "Invalid date range" });
		}

		// Fetch history entries in range that relate to daily activity (both positive and negative, so undo is reflected)
		const entries = await History.find({
			userId: user._id,
			type: { $in: ["quest_complete", "focus_session", "timeframe_bonus"] },
			occurredAt: { $gte: from, $lte: to },
		})
			.select({ occurredAt: 1, type: 1, xpChange: 1 })
			.lean();

		// Build day map with counts and net XP change
		const dayMap = new Map();
		for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
			dayMap.set(ymd(d), {
				date: ymd(d),
				completedCount: 0,
				netXp: 0,
				hasCompletion: false,
				_hadQuestOrFocusPositive: false,
			});
		}
		for (const e of entries) {
			const key = ymd(startOfDay(e.occurredAt || e.createdAt || new Date()));
			if (dayMap.has(key)) {
				const obj = dayMap.get(key);
				// Count only positive quest/focus events toward intensity
				if ((e.xpChange || 0) > 0 && (e.type === "quest_complete" || e.type === "focus_session")) {
					obj.completedCount += 1;
					obj._hadQuestOrFocusPositive = true;
				}
				obj.netXp += e.xpChange || 0;
				// A day counts for streak ONLY if there was at least one positive quest or focus session that day.
				// This ignores timeframe bonus-alone or other positives.
				obj.hasCompletion = obj._hadQuestOrFocusPositive === true;
				dayMap.set(key, obj);
			}
		}
		const days = Array.from(dayMap.values()).sort((a, b) => (a.date < b.date ? -1 : 1));

		// Compute streaks on the provided range
		const { current, longest } = computeStreaks(days);

		return res.json({
			range: { from: ymd(from), to: ymd(to) },
			days,
			currentStreak: current,
			longestStreak: longest,
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to load streak calendar" });
	}
});

export default router;

