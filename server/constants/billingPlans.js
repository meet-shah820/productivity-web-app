/**
 * Four tiers: one free + three paid (monthly via Stripe Price IDs in env).
 * Display amounts are for marketing; actual charge is whatever each Stripe Price is set to.
 */

export const PAID_TIER_IDS = ["starter", "pro", "elite"];

/**
 * Strip BOM, whitespace, and wrapping quotes from env-based Price IDs (common Dashboard / Render paste issues).
 * @param {string | undefined} raw
 */
export function normalizeStripePriceId(raw) {
	if (raw == null) return "";
	let s = String(raw).replace(/^\uFEFF/, "").trim();
	if (!s) return "";
	// Line breaks / unicode spaces from dashboard or Render paste
	s = s.replace(/[\r\n\u00a0\u200b\u202f\uFEFF]/g, "").trim();
	// Repeatedly unwrap quotes (e.g. "\"price_xxx\"" from a bad paste)
	for (let i = 0; i < 3; i++) {
		const next = s.replace(/^['"]+|['"]+$/g, "").trim();
		if (next === s) break;
		s = next;
	}
	// Trailing junk from copy-paste
	s = s.replace(/[\s,;\u200b]+$/g, "");
	return s;
}

/** @param {string} tier */
export function getStripePriceIdForTier(tier) {
	if (tier === "starter") return normalizeStripePriceId(process.env.STRIPE_PRICE_STARTER);
	if (tier === "pro") return normalizeStripePriceId(process.env.STRIPE_PRICE_PRO);
	if (tier === "elite") return normalizeStripePriceId(process.env.STRIPE_PRICE_ELITE);
	return "";
}

/** @param {string | undefined} priceId */
export function getTierFromStripePriceId(priceId) {
	if (!priceId || typeof priceId !== "string") return null;
	const id = normalizeStripePriceId(priceId);
	const s = normalizeStripePriceId(process.env.STRIPE_PRICE_STARTER);
	const p = normalizeStripePriceId(process.env.STRIPE_PRICE_PRO);
	const e = normalizeStripePriceId(process.env.STRIPE_PRICE_ELITE);
	if (s && id === s) return "starter";
	if (p && id === p) return "pro";
	if (e && id === e) return "elite";
	return null;
}

export function stripePricesConfigured() {
	return Boolean(
		getStripePriceIdForTier("starter") &&
			getStripePriceIdForTier("pro") &&
			getStripePriceIdForTier("elite"),
	);
}

/**
 * Tier copy + fallback cents if Stripe Price retrieve fails.
 * Live Pricing page amounts come from Stripe via GET /api/billing/plans.
 */
export const TIER_CATALOG = [
	{
		id: "free",
		name: "Free",
		tagline: "Start leveling up",
		monthlyPriceCents: 0,
		features: [
			"Dashboard, quests, goals, and focus mode",
			"Skills, achievements, streak, and leaderboard",
			"Core notifications and profile",
		],
	},
	{
		id: "starter",
		name: "Starter",
		tagline: "Stay consistent",
		monthlyPriceCents: 499,
		features: [
			"Everything in Free",
			"More quest depth and goal flexibility",
			"Quest reminder tuning",
			"Founding-member badge in profile (optional)",
		],
	},
	{
		id: "pro",
		name: "Pro",
		tagline: "Level up faster",
		monthlyPriceCents: 1299,
		features: [
			"Everything in Starter",
			"Analytics and insights",
			"Weekly summary emails",
			"Higher daily quest caps",
		],
		highlight: true,
	},
	{
		id: "elite",
		name: "Elite",
		tagline: "Maximum momentum",
		monthlyPriceCents: 2499,
		features: [
			"Everything in Pro",
			"Priority AI quest briefing quality",
			"Early access to new modes",
			"Elite flair on leaderboard",
		],
	},
];
