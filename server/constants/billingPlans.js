/**
 * Four tiers: one free + three paid (monthly via Stripe Price IDs in env).
 * Display amounts are for marketing; actual charge is whatever each Stripe Price is set to.
 */

export const PAID_TIER_IDS = ["starter", "pro", "elite"];

/** @param {string} tier */
export function getStripePriceIdForTier(tier) {
	if (tier === "starter") return process.env.STRIPE_PRICE_STARTER?.trim() || "";
	if (tier === "pro") return process.env.STRIPE_PRICE_PRO?.trim() || "";
	if (tier === "elite") return process.env.STRIPE_PRICE_ELITE?.trim() || "";
	return "";
}

/** @param {string | undefined} priceId */
export function getTierFromStripePriceId(priceId) {
	if (!priceId || typeof priceId !== "string") return null;
	const s = process.env.STRIPE_PRICE_STARTER?.trim();
	const p = process.env.STRIPE_PRICE_PRO?.trim();
	const e = process.env.STRIPE_PRICE_ELITE?.trim();
	if (s && priceId === s) return "starter";
	if (p && priceId === p) return "pro";
	if (e && priceId === e) return "elite";
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
