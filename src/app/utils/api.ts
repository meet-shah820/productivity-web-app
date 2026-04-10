const API_BASE = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE) || "";

const BILLING_ONBOARDED_KEY = "app_billing_onboarded";

/** Persist billing onboarding flag so the shell can render without a blank gate after login. */
export function syncBillingOnboardedCache(onboarded: boolean) {
	if (typeof window === "undefined") return;
	localStorage.setItem(BILLING_ONBOARDED_KEY, onboarded ? "1" : "0");
}

export function clearBillingOnboardedCache() {
	if (typeof window === "undefined") return;
	localStorage.removeItem(BILLING_ONBOARDED_KEY);
}

export function getBillingOnboardedCache(): boolean | null {
	if (typeof window === "undefined") return null;
	const v = localStorage.getItem(BILLING_ONBOARDED_KEY);
	if (v === "1") return true;
	if (v === "0") return false;
	return null;
}
function apiUrl(path: string): string {
	return `${API_BASE}${path}`;
}

function getAuthHeaders(): Record<string, string> {
	if (typeof window === "undefined") return {};
	const token = localStorage.getItem("auth_token");
	if (!token) return {};
	return { Authorization: `Bearer ${token}` };
}

async function apiFetch(path: string, init: RequestInit = {}) {
	const headers = new Headers(init.headers || {});
	// Attach auth if available (makes data user-specific)
	const auth = getAuthHeaders();
	for (const [k, v] of Object.entries(auth)) headers.set(k, v);
	return fetch(apiUrl(path), { ...init, headers });
}

async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
	const text = await res.text();
	if (!text.trim()) return `${fallback} (HTTP ${res.status})`;
	try {
		const j = JSON.parse(text) as { error?: string };
		if (typeof j?.error === "string" && j.error.trim()) return j.error.trim();
	} catch {
		/* not JSON */
	}
	const t = text.trim().replace(/\s+/g, " ");
	if (t.length > 0 && t.length < 1000) return t;
	return `${fallback} (HTTP ${res.status})`;
}

export async function getDashboard() {
	const res = await apiFetch("/api/dashboard");
	if (!res.ok) throw new Error("Failed to load dashboard");
	return res.json();
}

export async function createGoal(payload: { title: string; category?: string; rarity?: string }) {
	const res = await apiFetch("/api/goals", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	if (!res.ok) throw new Error("Failed to create goal");
	return res.json();
}

export async function getGoals() {
	const res = await apiFetch("/api/goals");
	if (!res.ok) throw new Error("Failed to load goals");
	return res.json();
}

export async function deleteGoal(goalId: string) {
	const res = await apiFetch(`/api/goals/${encodeURIComponent(goalId)}`, { method: "DELETE" });
	if (!res.ok) throw new Error("Failed to delete goal");
	return res.json();
}

export async function completeQuest(questId: string) {
	const res = await apiFetch(`/api/quests/${questId}/complete`, { method: "PATCH" });
	if (!res.ok) throw new Error("Failed to complete quest");
	return res.json();
}

export async function revertQuest(questId: string) {
	const res = await apiFetch(`/api/quests/${questId}/revert`, { method: "PATCH" });
	if (!res.ok) throw new Error("Failed to revert quest");
	return res.json();
}

export async function completeFocusSession(xp: number) {
	const res = await apiFetch(`/api/focus/complete`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ xp }),
	});
	if (!res.ok) throw new Error("Failed to record focus session");
	return res.json();
}

export type FocusTodayStats = {
	sessionsToday: number;
	focusXpToday: number;
	focusMinutesToday: number;
	focusHoursToday: number;
};

export async function getFocusTodayStats(): Promise<FocusTodayStats> {
	const res = await apiFetch("/api/focus/today-stats");
	if (!res.ok) throw new Error("Failed to load focus stats");
	return res.json();
}

export async function getAchievements() {
	const res = await apiFetch("/api/achievements");
	if (!res.ok) throw new Error("Failed to load achievements");
	return res.json();
}

export async function getAnalytics() {
	const res = await apiFetch("/api/analytics");
	if (!res.ok) throw new Error("Failed to load analytics");
	return res.json();
}

export async function getSkills() {
	const res = await apiFetch("/api/skills");
	if (!res.ok) throw new Error("Failed to load skills");
	return res.json();
}

export const PROFILE_UPDATED_EVENT = "app:profile-updated";

/** Fired after server-side rank may have changed (quests, focus, goals, achievements). */
export const RANK_UPDATED_EVENT = "app:rank-updated";

export async function getProfile() {
	const res = await apiFetch("/api/profile");
	if (!res.ok) throw new Error("Failed to load profile");
	return res.json();
}

export type PatchProfilePayload = {
	username?: string;
	displayName?: string;
	email?: string;
	bio?: string;
	/** data:image/jpeg;base64,... */
	avatarDataUrl?: string;
	clearAvatar?: boolean;
};

export async function patchProfile(payload: PatchProfilePayload) {
	const body = Object.fromEntries(
		Object.entries(payload).filter(([, v]) => v !== undefined),
	) as Record<string, unknown>;
	const res = await apiFetch("/api/profile", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	const out = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((out as { error?: string }).error || "Failed to update profile");
	return out;
}

export async function getSettings() {
	const res = await apiFetch("/api/settings");
	if (!res.ok) throw new Error("Failed to load settings");
	return res.json();
}

export async function saveSettings(payload: { notifications: any }) {
	const res = await apiFetch("/api/settings", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	if (!res.ok) throw new Error("Failed to save settings");
	return res.json();
}

export async function changePassword(payload: { username: string; currentPassword: string; newPassword: string }) {
	const res = await apiFetch("/api/auth/change-password", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	if (!res.ok) throw new Error("Failed to change password");
	return res.json();
}

export async function resetAll() {
	const res = await apiFetch("/api/admin/reset", { method: "POST" });
	if (!res.ok) throw new Error("Failed to reset");
	return res.json();
}

export async function getQuests(timeframe: "daily" | "weekly" | "monthly", difficulty?: "easy" | "medium" | "hard") {
	const params = new URLSearchParams({ timeframe });
	if (difficulty) params.set("difficulty", difficulty);
	const res = await apiFetch(`/api/quests?${params.toString()}`);
	if (!res.ok) throw new Error("Failed to load quests");
	return res.json();
}

export type QuestDetailsPayload = {
	quest: {
		id: string;
		title: string;
		xpReward: number;
		statType: string;
		type: string;
		isCompleted: boolean;
		goalId?: string;
		/** easy | medium | hard */
		difficulty?: string;
	};
	goal: { id: string; title: string; category: string } | null;
	details: {
		summary: string;
		/** Plain language: goal, stat, and why this quest matters when finished. */
		whatYouImprove: string;
		/** One checkable line: when to tap Complete. */
		doneWhen: string;
		steps: string[];
		tips?: string;
		source?: string;
		/** Legacy v2 fields — optional if old cached payloads appear. */
		requirements?: string;
		howTo?: string;
	};
};

export async function getQuestDetails(questId: string): Promise<QuestDetailsPayload> {
	const res = await apiFetch(`/api/quests/${encodeURIComponent(questId)}/details`);
	const body = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((body as { error?: string }).error || "Failed to load quest details");
	return body as QuestDetailsPayload;
}

export async function getRecentHistory() {
	const res = await apiFetch("/api/history/recent");
	if (!res.ok) throw new Error("Failed to load history");
	return res.json();
}

export type BillingStatus = {
	tier: "free" | "starter" | "pro" | "elite";
	onboarded: boolean;
	stripeStatus: string;
	currentPeriodEndMs: number;
	/** Amounts shown on plan cards; from server .env (STRIPE_PRICE_* or *_LABEL). */
	priceDisplay?: { starter: string; pro: string; elite: string };
};

export async function getBillingStatus(): Promise<BillingStatus> {
	const res = await apiFetch("/api/billing/status");
	if (!res.ok) throw new Error("Failed to load billing status");
	return res.json();
}

export async function startCheckout(tier: "starter" | "pro" | "elite"): Promise<{ url: string }> {
	const res = await apiFetch("/api/billing/checkout", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ tier }),
	});
	if (!res.ok) {
		throw new Error(await readApiErrorMessage(res, "Failed to start checkout"));
	}
	return res.json() as Promise<{ url: string }>;
}

export async function openBillingPortal(): Promise<{ url: string }> {
	const res = await apiFetch("/api/billing/portal", { method: "POST" });
	const out = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((out as { error?: string }).error || "Failed to open portal");
	return out as { url: string };
}

export async function refreshBilling(): Promise<BillingStatus & { ok: true }> {
	const res = await apiFetch("/api/billing/refresh", { method: "POST" });
	const out = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((out as { error?: string }).error || "Failed to refresh billing");
	return out as BillingStatus & { ok: true };
}

export async function chooseFreePlan(): Promise<{ ok: true; tier: "free"; onboarded: true }> {
	const res = await apiFetch("/api/billing/choose", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ tier: "free" }),
	});
	const out = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((out as { error?: string }).error || "Failed to choose plan");
	return out as { ok: true; tier: "free"; onboarded: true };
}

export type StreakCalendarDay = {
	date: string;
	completedCount: number;
	hasCompletion: boolean;
};

export type StreakCalendarResponse = {
	range: { from: string; to: string };
	days: StreakCalendarDay[];
	currentStreak: { length: number; start: string | null; end: string | null };
	longestStreak: { length: number; start: string | null; end: string | null };
};

export async function getStreakCalendar(fromISO?: string, toISO?: string): Promise<StreakCalendarResponse> {
	const params = new URLSearchParams();
	if (fromISO) params.set("from", fromISO);
	if (toISO) params.set("to", toISO);
	const qs = params.toString();
	const res = await apiFetch(`/api/streak/calendar${qs ? `?${qs}` : ""}`);
	if (!res.ok) throw new Error("Failed to load streak calendar");
	return res.json();
}

export type LeaderboardEntry = {
	position: number;
	userId: string;
	username: string;
	displayName: string;
	level: number;
	xp: number;
	rank: string;
	statSum: number;
};

export type LeaderboardResponse = {
	entries: LeaderboardEntry[];
	totalUsers: number;
	yourRank: LeaderboardEntry | null;
	sort: string;
};

export async function getLeaderboard(limit = 50): Promise<LeaderboardResponse> {
	const res = await apiFetch(`/api/leaderboard?limit=${encodeURIComponent(String(limit))}`);
	if (!res.ok) throw new Error("Failed to load leaderboard");
	return res.json();
}

const DEFAULT_DEV_API_ORIGIN = "http://127.0.0.1:5000";

/**
 * WebSocket URL for live leaderboard updates (requires auth token in localStorage).
 * In dev, connects straight to the API host (not through the Vite WS proxy) to avoid flaky proxies / ECONNRESET.
 */
export function getLeaderboardWebSocketUrl(): string {
	if (typeof window === "undefined") return "";
	const token = localStorage.getItem("auth_token");
	if (!token) return "";
	const enc = encodeURIComponent(token);
	const apiBase = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE) || "";
	if (apiBase && /^https?:\/\//i.test(String(apiBase))) {
		const u = new URL(String(apiBase));
		const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
		return `${wsProto}//${u.host}/ws/leaderboard?token=${enc}`;
	}
	if (typeof import.meta !== "undefined" && (import.meta as any).env?.DEV) {
		const raw = String((import.meta as any).env?.VITE_DEV_API_ORIGIN || DEFAULT_DEV_API_ORIGIN).replace(/\/$/, "");
		try {
			const u = new URL(raw);
			const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
			return `${wsProto}//${u.host}/ws/leaderboard?token=${enc}`;
		} catch {
			/* fall through */
		}
	}
	const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${proto}//${window.location.host}/ws/leaderboard?token=${enc}`;
}
