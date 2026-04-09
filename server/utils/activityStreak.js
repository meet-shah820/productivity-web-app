import History from "../models/History.js";

function utcDayKey(d) {
	return d.toISOString().slice(0, 10);
}

/**
 * Consecutive UTC calendar days with qualifying activity (quest complete with XP, or focus session with XP).
 * Streak is broken if neither today nor yesterday had activity (same-day grace if today is still open).
 */
export async function computeActivityStreakDays(userId) {
	// Important: this must stay fast even if a shared/demo user accumulates massive history.
	// We only need *recent* activity days to compute a consecutive-day streak, so cap the query.
	const now = new Date();
	now.setUTCHours(0, 0, 0, 0);

	// Safety bound: don't scan older than ~400 days.
	const floor = new Date(now);
	floor.setUTCDate(floor.getUTCDate() - 400);

	const rows = await History.find({
		userId,
		type: { $in: ["quest_complete", "focus_session"] },
		occurredAt: { $gte: floor },
		xpChange: { $gt: 0 },
	})
		.sort({ occurredAt: -1 })
		.select("occurredAt xpChange")
		.limit(2500)
		lean();

	if (!rows.length) return 0;

	// Build a set of active UTC days from recent rows.
	const activeDays = new Set();
	for (const h of rows) {
		const t = h.occurredAt ? new Date(h.occurredAt) : null;
		if (!t || Number.isNaN(t.getTime())) continue;
		activeDays.add(utcDayKey(t));
	}
	if (activeDays.size === 0) return 0;

	const todayK = utcDayKey(now);
	const y = new Date(now);
	y.setUTCDate(y.getUTCDate() - 1);
	const yesterdayK = utcDayKey(y);

	let startK;
	if (activeDays.has(todayK)) startK = todayK;
	else if (activeDays.has(yesterdayK)) startK = yesterdayK;
	else return 0;

	let streak = 0;
	const d = new Date(`${startK}T12:00:00.000Z`);
	while (activeDays.has(utcDayKey(d))) {
		streak++;
		d.setUTCDate(d.getUTCDate() - 1);
	}
	return streak;
}
