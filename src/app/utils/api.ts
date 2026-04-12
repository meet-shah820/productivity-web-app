const API_BASE = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE) || "";

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

export async function createGoal(payload: {
	title: string;
	category?: string;
	rarity?: string;
	/** ISO date string (YYYY-MM-DD) from date input */
	deadline?: string;
	description?: string;
}) {
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

export const BILLING_UPDATED_EVENT = "app:billing-updated";

export class BillingApiError extends Error {
	status: number;
	code?: string;

	constructor(message: string, status: number, code?: string) {
		super(message);
		this.name = "BillingApiError";
		this.status = status;
		this.code = code;
	}
}

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

function friendlyDeleteAccountError(status: number, text: string): string {
	const t = text.trim();
	if (t.includes("<!DOCTYPE") || t.includes("<html") || t.includes("<pre>Cannot")) {
		return `The server could not delete your account (HTTP ${status}). Restart the API server so it has the latest routes, or check VITE_API_BASE points at your Express API.`;
	}
	if (t) {
		try {
			const j = JSON.parse(t) as { error?: string };
			if (typeof j?.error === "string" && j.error.trim()) return j.error.trim();
		} catch {
			return t.slice(0, 280);
		}
	}
	return `Failed to delete account (HTTP ${status})`;
}

export async function deleteAccount(): Promise<{ ok: boolean }> {
	const attempts: { path: string; method: string }[] = [
		{ path: "/api/auth/account", method: "DELETE" },
		{ path: "/api/delete-account", method: "POST" },
		{ path: "/api/auth/delete-account", method: "POST" },
		{ path: "/api/auth/account/delete", method: "POST" },
	];

	let lastStatus = 0;
	let lastText = "";

	for (const { path, method } of attempts) {
		const res = await apiFetch(path, { method });
		lastStatus = res.status;
		lastText = await res.text();
		if (res.ok) {
			try {
				return lastText.trim() ? (JSON.parse(lastText) as { ok: boolean }) : { ok: true };
			} catch {
				return { ok: true };
			}
		}
		if (lastStatus !== 404 && lastStatus !== 405) {
			throw new Error(friendlyDeleteAccountError(lastStatus, lastText));
		}
	}

	throw new Error(friendlyDeleteAccountError(lastStatus, lastText));
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
	isPenaltyActive?: boolean;
	originalTitle?: string;
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

export type BillingTierId = "free" | "starter" | "pro" | "elite";

export type BillingStatus = {
	tier: BillingTierId;
	subscriptionStatus: string;
	currentPeriodEnd: string | null;
	cancelAtPeriodEnd: boolean;
	hasStripeCustomer: boolean;
	checkoutAvailable: boolean;
};

export async function getBillingStatus(): Promise<BillingStatus> {
	const res = await apiFetch("/api/billing/status");
	if (!res.ok) throw new Error("Failed to load billing status");
	return res.json();
}

export type BillingPlanTier = {
	id: BillingTierId;
	name: string;
	tagline: string;
	monthlyPriceCents: number;
	/** ISO 4217 from Stripe Price (e.g. usd, cad) */
	currency: string;
	/** stripe = from live Price retrieve; fallback = Stripe off or error */
	pricingSource?: "stripe" | "fallback";
	features: string[];
	highlight?: boolean;
	stripeConfigured: boolean;
	hasPriceId: boolean;
};

export type BillingPlansResponse = {
	tiers: BillingPlanTier[];
	checkoutAvailable: boolean;
};

export async function getBillingPlans(): Promise<BillingPlansResponse> {
	const res = await apiFetch("/api/billing/plans");
	if (!res.ok) throw new Error("Failed to load plans");
	return res.json();
}

export async function createBillingCheckoutSession(tier: Exclude<BillingTierId, "free">): Promise<{ url: string }> {
	const res = await apiFetch("/api/billing/checkout-session", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ tier }),
	});
	const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
	if (!res.ok) {
		throw new BillingApiError(body.error || "Failed to start checkout", res.status, body.code);
	}
	return body as { url: string };
}

export async function createBillingPortalSession(): Promise<{ url: string }> {
	const res = await apiFetch("/api/billing/portal-session", { method: "POST" });
	const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
	if (!res.ok) {
		throw new BillingApiError(body.error || "Failed to open billing portal", res.status, body.code);
	}
	return body as { url: string };
}

export async function cancelBillingSubscription(when: "period_end" | "immediately"): Promise<{ ok: boolean; when: string }> {
	const res = await apiFetch("/api/billing/cancel-subscription", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ when }),
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((body as { error?: string }).error || "Failed to cancel subscription");
	return body as { ok: boolean; when: string };
}

export async function resumeBillingSubscription(): Promise<{ ok: boolean }> {
	const res = await apiFetch("/api/billing/resume-subscription", { method: "POST" });
	const body = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((body as { error?: string }).error || "Failed to resume subscription");
	return body as { ok: boolean };
}

export type BillingPaymentRow = {
	id: string;
	source: string;
	created: string;
	amount: number;
	currency: string;
	status: string;
	description: string;
	receiptUrl: string | null;
	hostedInvoiceUrl: string | null;
};

export async function getBillingPaymentHistory(): Promise<{ payments: BillingPaymentRow[] }> {
	const res = await apiFetch("/api/billing/payment-history");
	const body = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((body as { error?: string }).error || "Failed to load payment history");
	return body as { payments: BillingPaymentRow[] };
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
