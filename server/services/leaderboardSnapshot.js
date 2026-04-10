import User from "../models/User.js";

const HUNTER_RANK_ORDER = { S: 6, A: 5, B: 4, C: 3, D: 2, E: 1 };

function statSum(u) {
	const s = u.stats || {};
	return (s.strength || 0) + (s.intelligence || 0) + (s.agility || 0) + (s.vitality || 0);
}

function compareUsers(a, b) {
	if ((b.xp || 0) !== (a.xp || 0)) return (b.xp || 0) - (a.xp || 0);
	const ra = HUNTER_RANK_ORDER[a.rank] ?? 0;
	const rb = HUNTER_RANK_ORDER[b.rank] ?? 0;
	if (rb !== ra) return rb - ra;
	if ((b.level || 0) !== (a.level || 0)) return (b.level || 0) - (a.level || 0);
	const sb = statSum(b);
	const sa = statSum(a);
	if (sb !== sa) return sb - sa;
	return String(a.username || "").localeCompare(String(b.username || ""));
}

function publicDisplayName(u) {
	const d = String(u.displayName || "").trim();
	return d || u.username || "Player";
}

/**
 * Sorted leaderboard: XP (primary), Hunter rank, level, stat sum, username.
 * @param {{ limit?: number; viewerId?: import("mongoose").Types.ObjectId | string | null }} opts
 */
export async function buildLeaderboardSnapshot(opts = {}) {
	const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));
	const viewerId = opts.viewerId != null ? String(opts.viewerId) : null;

	const users = await User.find({})
		.select("username displayName level xp rank stats")
		.lean();

	users.sort(compareUsers);
	const totalUsers = users.length;
	const top = users.slice(0, limit);

	const entries = top.map((u, i) => ({
		position: i + 1,
		userId: String(u._id),
		username: u.username,
		displayName: publicDisplayName(u),
		level: u.level ?? 1,
		xp: u.xp ?? 0,
		rank: u.rank && HUNTER_RANK_ORDER[u.rank] != null ? u.rank : "E",
		statSum: statSum(u),
	}));

	let yourRow = null;
	if (viewerId) {
		const idx = users.findIndex((u) => String(u._id) === viewerId);
		if (idx >= 0) {
			const u = users[idx];
			yourRow = {
				position: idx + 1,
				userId: String(u._id),
				username: u.username,
				displayName: publicDisplayName(u),
				level: u.level ?? 1,
				xp: u.xp ?? 0,
				rank: u.rank && HUNTER_RANK_ORDER[u.rank] != null ? u.rank : "E",
				statSum: statSum(u),
			};
		}
	}

	return {
		entries,
		totalUsers,
		yourRank: yourRow,
		sort: "xp",
	};
}
