import express from "express";
import Stripe from "stripe";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

function getServerOrigin(req) {
	const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http").toString().split(",")[0].trim();
	const host = (req.headers["x-forwarded-host"] || req.get("host") || "localhost:5000").toString().split(",")[0].trim();
	return `${proto}://${host}`;
}

function getClientOrigin(req) {
	// Prefer explicit frontend base if provided (typical on Vite + Render)
	const envBase = String(process.env.VITE_API_BASE || "").trim();
	// VITE_API_BASE is API base, not client base, so don't use it here.
	// Use OAUTH_SUCCESS_REDIRECT host as a decent "frontend origin" fallback if configured.
	const successRedirect = String(process.env.OAUTH_SUCCESS_REDIRECT || "").trim();
	if (successRedirect) {
		try {
			return new URL(successRedirect).origin;
		} catch {
			// ignore
		}
	}
	// Final fallback: same origin as API (works when served together)
	return getServerOrigin(req);
}

function mustEnv(name) {
	const v = process.env[name];
	if (!v) throw new Error(`Missing env var: ${name}`);
	return v;
}

function stripeClient() {
	const key = mustEnv("STRIPE_SECRET_KEY");
	return new Stripe(key, { apiVersion: "2024-06-20" });
}

function tierToPriceId(tier) {
	switch (tier) {
		case "starter":
			return process.env.STRIPE_PRICE_STARTER;
		case "pro":
			return process.env.STRIPE_PRICE_PRO;
		case "elite":
			return process.env.STRIPE_PRICE_ELITE;
		default:
			return null;
	}
}

function isStripePriceId(v) {
	return typeof v === "string" && /^price_[a-zA-Z0-9]+$/.test(v.trim());
}

function priceIdToTier(priceId) {
	if (!priceId) return "free";
	if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
	if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
	if (priceId === process.env.STRIPE_PRICE_ELITE) return "elite";
	return "free";
}

async function ensureStripeCustomer(stripe, user) {
	if (user?.billing?.stripeCustomerId) return user.billing.stripeCustomerId;

	const customer = await stripe.customers.create({
		metadata: { userId: String(user._id), username: user.username },
		email: user.email || undefined,
		name: user.displayName || undefined,
	});

	user.billing.stripeCustomerId = customer.id;
	await user.save();
	return customer.id;
}

// GET /api/billing/status — current tier + subscription status for UI
router.get("/status", requireAuth, async (req, res) => {
	try {
		const user = await User.findById(req.user._id).lean();
		return res.json({
			tier: user?.billing?.tier || "free",
			stripeStatus: user?.billing?.stripeStatus || "",
			currentPeriodEndMs: user?.billing?.currentPeriodEndMs || 0,
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to load billing status" });
	}
});

// POST /api/billing/checkout { tier: "starter" | "pro" | "elite" }
router.post("/checkout", requireAuth, async (req, res) => {
	try {
		const { tier } = req.body || {};
		if (!["starter", "pro", "elite"].includes(String(tier))) {
			return res.status(400).json({ error: "Invalid tier" });
		}

		const priceId = tierToPriceId(String(tier));
		if (!priceId) return res.status(500).json({ error: "Stripe price not configured for this tier" });
		if (!isStripePriceId(priceId)) {
			return res.status(500).json({
				error: `Invalid Stripe price id for ${tier}. Expected something like price_123... (not a dollar amount).`,
			});
		}

		const stripe = stripeClient();
		const user = await User.findById(req.user._id);
		if (!user) return res.status(401).json({ error: "Unauthorized" });

		const customerId = await ensureStripeCustomer(stripe, user);

		const clientOrigin = getClientOrigin(req);
		const successUrl = `${clientOrigin}/settings?billing=success`;
		const cancelUrl = `${clientOrigin}/settings?billing=cancel`;

		const session = await stripe.checkout.sessions.create({
			mode: "subscription",
			customer: customerId,
			line_items: [{ price: priceId, quantity: 1 }],
			success_url: successUrl,
			cancel_url: cancelUrl,
			allow_promotion_codes: true,
			subscription_data: {
				metadata: {
					userId: String(user._id),
					username: user.username,
					requestedTier: String(tier),
				},
			},
			metadata: {
				userId: String(user._id),
				username: user.username,
				requestedTier: String(tier),
			},
		});

		return res.json({ url: session.url });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to start checkout" });
	}
});

// POST /api/billing/portal — Stripe customer billing portal
router.post("/portal", requireAuth, async (req, res) => {
	try {
		const stripe = stripeClient();
		const user = await User.findById(req.user._id);
		if (!user) return res.status(401).json({ error: "Unauthorized" });

		const customerId = await ensureStripeCustomer(stripe, user);
		const clientOrigin = getClientOrigin(req);
		const returnUrl = `${clientOrigin}/settings?billing=portal_return`;

		const portal = await stripe.billingPortal.sessions.create({
			customer: customerId,
			return_url: returnUrl,
		});

		return res.json({ url: portal.url });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to open billing portal" });
	}
});

// POST /api/billing/refresh — pull latest subscription state from Stripe (useful when webhooks aren't configured)
router.post("/refresh", requireAuth, async (req, res) => {
	try {
		const stripe = stripeClient();
		const user = await User.findById(req.user._id);
		if (!user) return res.status(401).json({ error: "Unauthorized" });

		if (!user.billing?.stripeCustomerId) {
			return res.json({ ok: true, tier: user.billing?.tier || "free", stripeStatus: user.billing?.stripeStatus || "" });
		}

		const subs = await stripe.subscriptions.list({
			customer: user.billing.stripeCustomerId,
			status: "all",
			limit: 10,
			expand: ["data.customer", "data.items.data.price"],
		});

		// Prefer an active/trialing subscription; otherwise fall back to most recent.
		const preferred =
			subs.data.find((s) => s.status === "active" || s.status === "trialing" || s.status === "past_due" || s.status === "unpaid") ||
			subs.data[0] ||
			null;

		if (preferred) {
			await syncUserFromSubscription(preferred);
		}

		const fresh = await User.findById(req.user._id).lean();
		return res.json({
			ok: true,
			tier: fresh?.billing?.tier || "free",
			stripeStatus: fresh?.billing?.stripeStatus || "",
			currentPeriodEndMs: fresh?.billing?.currentPeriodEndMs || 0,
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to refresh billing" });
	}
});

/**
 * Used by webhook handler to synchronize a user based on a Stripe subscription.
 * Exported for server/index.js webhook path.
 */
export async function syncUserFromSubscription(sub) {
	const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
	if (!customerId) return;
	const priceId = sub?.items?.data?.[0]?.price?.id || "";
	const tier = priceIdToTier(priceId);
	const status = sub.status || "";
	const periodEndMs = sub.current_period_end ? Number(sub.current_period_end) * 1000 : 0;

	const user = await User.findOne({ "billing.stripeCustomerId": customerId });
	if (!user) return;

	user.billing.tier = ["active", "trialing", "past_due", "unpaid"].includes(status) ? tier : "free";
	user.billing.stripeSubscriptionId = String(sub.id || "");
	user.billing.stripePriceId = String(priceId || "");
	user.billing.stripeStatus = String(status || "");
	user.billing.currentPeriodEndMs = periodEndMs;
	await user.save();
}

export default router;

