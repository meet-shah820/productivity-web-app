import express from "express";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { getStripe } from "../services/stripeClient.js";
import { resolveStripeCustomerIdForUser, syncUserFromSubscription } from "../services/billingSync.js";
import {
	PAID_TIER_IDS,
	getStripePriceIdForTier,
	TIER_CATALOG,
	stripePricesConfigured,
} from "../constants/billingPlans.js";

const router = express.Router();

/** @param {unknown} err */
function readableStripeError(err) {
	if (!err || typeof err !== "object") return null;
	const o = /** @type {{ message?: unknown; raw?: { message?: unknown } }} */ (err);
	if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
	const raw = o.raw;
	if (raw && typeof raw.message === "string" && raw.message.trim()) return raw.message.trim();
	return null;
}

/** @param {unknown} err */
function isNoSuchStripePrice(err) {
	if (!err || typeof err !== "object") return false;
	const o = /** @type {{ code?: string; param?: string; message?: unknown; raw?: { code?: string; param?: string; message?: string } }} */ (err);
	const code = o.code || o.raw?.code;
	const param = o.param || o.raw?.param;
	const message = o.message || o.raw?.message;
	if (code === "resource_missing") {
		const p = String(param || "");
		if (p.includes("price") || p === "price") return true;
	}
	const m = String(message || "").toLowerCase();
	return m.includes("no such price");
}

function stripePriceEnvMismatchHint() {
	return " Use Price IDs from the same Stripe account and mode (test vs live) as STRIPE_SECRET_KEY. From the repo root run: npm run stripe:verify";
}

/** @param {unknown} err */
function billingStripeUserMessage(err) {
	const base = readableStripeError(err);
	if (isNoSuchStripePrice(err)) {
		const head = base || "Stripe could not find that price.";
		return `${head}${stripePriceEnvMismatchHint()}`;
	}
	return base;
}

/** Stale cus_... after test reset, new API key, or different Stripe account */
/** @param {unknown} err */
function isStripeMissingCustomerError(err) {
	if (!err || typeof err !== "object") return false;
	const o = /** @type {{ code?: string; param?: string }} */ (err);
	return o.code === "resource_missing" && o.param === "customer";
}

/**
 * Base URL for Checkout success/cancel and Customer Portal return_url.
 * On Render, set FRONTEND_URL explicitly. If missing, we infer from Origin/Referer so
 * Stripe does not receive http://localhost (which causes portal-session to fail in production).
 * @param {import("express").Request} [req]
 */
function frontendOrigin(req) {
	const fromEnv =
		process.env.FRONTEND_URL?.trim() ||
		process.env.OAUTH_SUCCESS_REDIRECT?.trim()?.replace(/\/auth\/callback\/?$/, "") ||
		"";
	if (fromEnv) {
		return fromEnv.replace(/\/$/, "");
	}
	if (req) {
		const origin = req.get("origin");
		if (origin && /^https?:\/\//i.test(origin)) {
			return origin.replace(/\/$/, "");
		}
		const referer = req.get("referer");
		if (referer) {
			try {
				const u = new URL(referer);
				if (u.protocol === "http:" || u.protocol === "https:") {
					return `${u.protocol}//${u.host}`;
				}
			} catch {
				/* ignore */
			}
		}
	}
	return "http://localhost:5173";
}

/** Short-lived cache so GET /status does not hammer Stripe after GET /plans populated it. */
let checkoutOkCache = { secretKey: "", expiresAt: 0, value: false };

function setCheckoutOkCache(value) {
	const secretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();
	checkoutOkCache = {
		secretKey,
		expiresAt: Date.now() + 60_000,
		value,
	};
}

/**
 * @param {import("stripe").Stripe | null} stripe
 */
async function computeStripeCheckoutOk(stripe) {
	const secretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();
	const now = Date.now();
	if (secretKey && checkoutOkCache.secretKey === secretKey && now < checkoutOkCache.expiresAt) {
		return checkoutOkCache.value;
	}
	let ok = Boolean(stripe) && stripePricesConfigured();
	if (ok && stripe) {
		for (const tier of PAID_TIER_IDS) {
			try {
				await stripe.prices.retrieve(getStripePriceIdForTier(tier));
			} catch {
				ok = false;
				break;
			}
		}
	} else {
		ok = false;
	}
	setCheckoutOkCache(ok);
	return ok;
}

/**
 * @param {import("stripe").Stripe | null} stripe
 * @param {string} tierId
 */
async function resolveTierPricingFromStripe(stripe, tierId) {
	const fallback = TIER_CATALOG.find((t) => t.id === tierId);
	const fallbackCents = fallback?.monthlyPriceCents ?? 0;
	const priceId = getStripePriceIdForTier(tierId);

	if (!stripe || !priceId || tierId === "free") {
		return {
			monthlyPriceCents: tierId === "free" ? 0 : fallbackCents,
			currency: "usd",
			pricingSource: "fallback",
			stripePriceReachable: false,
		};
	}

	try {
		const price = await stripe.prices.retrieve(priceId);
		if (price.unit_amount == null) {
			return {
				monthlyPriceCents: fallbackCents,
				currency: (price.currency || "usd").toLowerCase(),
				pricingSource: "fallback",
				stripePriceReachable: true,
			};
		}
		return {
			monthlyPriceCents: price.unit_amount,
			currency: (price.currency || "usd").toLowerCase(),
			pricingSource: "stripe",
			stripePriceReachable: true,
		};
	} catch (err) {
		const hint = readableStripeError(err) || (err instanceof Error ? err.message : "");
		// eslint-disable-next-line no-console
		console.warn(`[billing] price retrieve failed tier=${tierId} id=${priceId}:`, hint);
		return {
			monthlyPriceCents: fallbackCents,
			currency: "usd",
			pricingSource: "fallback",
			stripePriceReachable: false,
		};
	}
}

// GET /api/billing/plans — catalog; paid amounts/currency match Stripe Price objects when configured
router.get("/plans", async (_req, res) => {
	try {
		const stripe = getStripe();
		const tiers = await Promise.all(
			TIER_CATALOG.map(async (t) => {
				if (t.id === "free") {
					return {
						...t,
						monthlyPriceCents: 0,
						currency: "usd",
						pricingSource: "stripe",
						stripeConfigured: true,
						hasPriceId: false,
						stripePriceReachable: true,
					};
				}
				const pricing = await resolveTierPricingFromStripe(stripe, t.id);
				return {
					...t,
					monthlyPriceCents: pricing.monthlyPriceCents,
					currency: pricing.currency,
					pricingSource: pricing.pricingSource,
					stripeConfigured: stripePricesConfigured(),
					hasPriceId: Boolean(getStripePriceIdForTier(t.id)),
					stripePriceReachable: pricing.stripePriceReachable,
				};
			}),
		);
		const checkoutAvailable =
			Boolean(stripe) &&
			stripePricesConfigured() &&
			tiers.filter((x) => x.id !== "free").every((x) => x.stripePriceReachable === true);
		setCheckoutOkCache(checkoutAvailable);
		const plansNotice =
			Boolean(stripe) && stripePricesConfigured() && !checkoutAvailable
				? "Price IDs are set, but this server's STRIPE_SECRET_KEY cannot load them — use the same Stripe account and Test/Live mode for the secret key and every STRIPE_PRICE_* (set all in Render; redeploy after changes)."
				: null;
		return res.json({
			tiers,
			checkoutAvailable,
			plansNotice,
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error("GET /api/billing/plans", e);
		return res.status(500).json({ error: "Failed to load plans" });
	}
});

// GET /api/billing/payment-history — paid invoices & charges for this app's Stripe customer
router.get("/payment-history", requireAuth, async (req, res) => {
	const stripe = getStripe();
	if (!stripe) {
		return res.status(503).json({ error: "Stripe billing is not configured on this server." });
	}

	try {
		const user = await User.findById(req.user._id).lean();
		const customerId = user?.billing?.stripeCustomerId;
		if (!customerId) {
			return res.json({ payments: [] });
		}

		/** @type {Array<{ id: string; source: string; created: string; amount: number; currency: string; status: string; description: string; receiptUrl: string | null; hostedInvoiceUrl: string | null }>} */
		const payments = [];

		const [invoiceList, chargeList] = await Promise.all([
			stripe.invoices.list({ customer: customerId, limit: 100 }),
			stripe.charges.list({ customer: customerId, limit: 100 }),
		]);

		for (const inv of invoiceList.data) {
			if (inv.status !== "paid" || !inv.amount_paid) continue;
			const lineDesc = inv.lines?.data?.map((l) => l.description).filter(Boolean)[0];
			payments.push({
				id: inv.id,
				source: "invoice",
				created: new Date(inv.created * 1000).toISOString(),
				amount: inv.amount_paid,
				currency: inv.currency,
				status: inv.status,
				description: inv.description || lineDesc || "Subscription",
				receiptUrl: null,
				hostedInvoiceUrl: inv.hosted_invoice_url || null,
			});
		}

		for (const ch of chargeList.data) {
			if (ch.status !== "succeeded" || !ch.paid) continue;
			if (ch.invoice) continue;
			payments.push({
				id: ch.id,
				source: "charge",
				created: new Date(ch.created * 1000).toISOString(),
				amount: ch.amount,
				currency: ch.currency,
				status: ch.status,
				description: ch.description || "Payment",
				receiptUrl: ch.receipt_url || null,
				hostedInvoiceUrl: null,
			});
		}

		payments.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

		return res.json({ payments });
	} catch (e) {
		if (isStripeMissingCustomerError(e)) {
			await User.findByIdAndUpdate(req.user._id, {
				$set: {
					"billing.stripeCustomerId": "",
					"billing.stripeSubscriptionId": "",
				},
			});
			return res.json({ payments: [] });
		}
		// eslint-disable-next-line no-console
		console.error("payment-history", e);
		const fromStripe = readableStripeError(e);
		return res.status(500).json({
			error: fromStripe || "Failed to load payment history",
		});
	}
});

// GET /api/billing/status — tier + subscription snapshot for nav and settings
router.get("/status", requireAuth, async (req, res) => {
	try {
		const user = await User.findById(req.user._id).lean();
		const b = user?.billing || {};
		const stripe = getStripe();
		const checkoutAvailable = await computeStripeCheckoutOk(stripe);
		return res.json({
			tier: b.tier || "free",
			subscriptionStatus: b.subscriptionStatus || "",
			currentPeriodEnd: b.currentPeriodEnd ? new Date(b.currentPeriodEnd).toISOString() : null,
			cancelAtPeriodEnd: Boolean(b.cancelAtPeriodEnd),
			hasStripeCustomer: Boolean(b.stripeCustomerId),
			checkoutAvailable,
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to load billing status" });
	}
});

// POST /api/billing/checkout-session — Stripe Checkout (subscription mode)
router.post("/checkout-session", requireAuth, async (req, res) => {
	const stripe = getStripe();
	if (!stripe || !stripePricesConfigured()) {
		return res.status(503).json({ error: "Stripe billing is not configured on this server." });
	}

	const tier = typeof req.body?.tier === "string" ? req.body.tier.trim() : "";
	if (!PAID_TIER_IDS.includes(tier)) {
		return res.status(400).json({ error: "Invalid tier. Choose starter, pro, or elite." });
	}

	const priceId = getStripePriceIdForTier(tier);
	if (!priceId) {
		return res.status(503).json({ error: "Missing Stripe Price ID for this tier." });
	}

	if (!(await computeStripeCheckoutOk(stripe))) {
		return res.status(503).json({
			error:
				"Checkout is unavailable: STRIPE_SECRET_KEY cannot load your Price IDs. Use the same Stripe account and Test/Live mode for the secret key and all STRIPE_PRICE_* variables (see Render Environment).",
		});
	}

	try {
		const user = await User.findById(req.user._id).exec();
		if (!user) return res.status(401).json({ error: "Unauthorized" });

		const activeLike = ["active", "trialing", "past_due"].includes(user.billing?.subscriptionStatus || "");
		if (activeLike && user.billing?.stripeCustomerId) {
			return res.status(409).json({
				error: "You already have a subscription. Use Manage billing to change or cancel your plan.",
				code: "USE_PORTAL",
			});
		}

		const origin = frontendOrigin(req);
		const successUrl = `${origin}/pricing?checkout=success`;
		const cancelUrl = `${origin}/pricing?checkout=canceled`;
		const termsUrl = `${origin}/terms`;
		const privacyUrl = `${origin}/privacy`;

		/** @type {import("stripe").Stripe.Checkout.SessionCreateParams} */
		const params = {
			mode: "subscription",
			line_items: [{ price: priceId, quantity: 1 }],
			success_url: successUrl,
			cancel_url: cancelUrl,
			client_reference_id: String(user._id),
			metadata: { userId: String(user._id), tier },
			subscription_data: {
				metadata: { userId: String(user._id), tier },
			},
			custom_text: {
				submit: {
					message: `By subscribing you agree to LevelUp Terms of Service (${termsUrl}) and Privacy Policy (${privacyUrl}). Payments are processed by Stripe; refunds follow our Terms. Stripe's policies also apply at checkout.`,
				},
			},
		};

		if (user.billing?.stripeCustomerId) {
			params.customer = user.billing.stripeCustomerId;
		} else {
			const email = String(user.email || "").trim();
			if (email) params.customer_email = email;
		}

		// Include priceId so changing STRIPE_PRICE_* env vars does not replay an old Stripe idempotent
		// response (same user+tier used to pin deleted prices and broke Checkout for existing accounts).
		const baseIdempotencyKey = `checkout_${user._id}_${tier}_${priceId}`;

		let session;
		try {
			session = await stripe.checkout.sessions.create(params, {
				idempotencyKey: baseIdempotencyKey,
			});
		} catch (firstErr) {
			if (isStripeMissingCustomerError(firstErr) && user.billing?.stripeCustomerId) {
				user.billing.stripeCustomerId = "";
				user.billing.stripeSubscriptionId = "";
				await user.save();
				delete params.customer;
				const email = String(user.email || "").trim();
				if (email) params.customer_email = email;
				session = await stripe.checkout.sessions.create(params, {
					idempotencyKey: `${baseIdempotencyKey}_recover_${Date.now()}`,
				});
			} else {
				throw firstErr;
			}
		}

		if (!session.url) {
			return res.status(500).json({ error: "Checkout did not return a URL" });
		}
		return res.json({ url: session.url });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error("checkout-session", e);
		const fromStripe = billingStripeUserMessage(e);
		return res.status(500).json({
			error: fromStripe || "Failed to start checkout",
		});
	}
});

// POST /api/billing/portal-session — Stripe Customer Portal
router.post("/portal-session", requireAuth, async (req, res) => {
	const stripe = getStripe();
	if (!stripe) {
		return res.status(503).json({ error: "Stripe billing is not configured on this server." });
	}

	try {
		let customerId = String((await User.findById(req.user._id).lean())?.billing?.stripeCustomerId || "").trim();
		if (!customerId) {
			customerId = (await resolveStripeCustomerIdForUser(stripe, String(req.user._id))) || "";
		}
		if (!customerId) {
			return res.status(400).json({
				error:
					"No Stripe customer is linked to this account. If you subscribed already, ensure webhooks are configured; otherwise subscribe again from Pricing.",
				code: "NO_STRIPE_CUSTOMER",
			});
		}

		const origin = frontendOrigin(req);
		const returnUrl = `${origin}/settings?tab=subscription`;
		try {
			const session = await stripe.billingPortal.sessions.create({
				customer: customerId,
				return_url: returnUrl,
			});
			return res.json({ url: session.url });
		} catch (portalErr) {
			if (isStripeMissingCustomerError(portalErr)) {
				await User.findByIdAndUpdate(req.user._id, {
					$set: {
						"billing.stripeCustomerId": "",
						"billing.stripeSubscriptionId": "",
					},
				});
				return res.status(400).json({
					error:
						"Your saved Stripe customer is no longer valid (e.g. test data reset). Subscribe again from the Pricing page.",
					code: "STALE_STRIPE_CUSTOMER",
				});
			}
			const msg = readableStripeError(portalErr) || "";
			const lower = msg.toLowerCase();
			const portalSetupHint =
				lower.includes("portal") ||
				lower.includes("configuration") ||
				lower.includes("billing portal");
			if (portalSetupHint) {
				return res.status(503).json({
					error: `${msg} Open Stripe Dashboard → Settings → Billing → Customer portal, activate it, and add your site URL to allowed return domains if required. Set FRONTEND_URL on the server to your exact app URL (e.g. https://your-app.onrender.com).`,
					code: "STRIPE_PORTAL_SETUP",
				});
			}
			throw portalErr;
		}
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error("portal-session", e);
		const fromStripe = readableStripeError(e);
		return res.status(500).json({
			error: fromStripe || "Failed to open billing portal",
		});
	}
});

// POST /api/billing/cancel-subscription — body: { when: "period_end" | "immediately" }
router.post("/cancel-subscription", requireAuth, async (req, res) => {
	const stripe = getStripe();
	if (!stripe) {
		return res.status(503).json({ error: "Stripe billing is not configured on this server." });
	}

	const when = req.body?.when === "immediately" ? "immediately" : "period_end";

	try {
		let user = await User.findById(req.user._id).exec();
		if (!user) return res.status(401).json({ error: "Unauthorized" });

		if (!String(user.billing?.stripeSubscriptionId || "").trim()) {
			await resolveStripeCustomerIdForUser(stripe, String(user._id));
			user = await User.findById(req.user._id).exec();
		}

		const subId = String(user?.billing?.stripeSubscriptionId || "").trim();
		if (!subId) {
			return res.status(400).json({ error: "No active subscription found for this account." });
		}

		const sub = await stripe.subscriptions.retrieve(subId);
		if (sub.metadata?.userId && sub.metadata.userId !== String(user._id)) {
			return res.status(403).json({ error: "This subscription is not linked to your account." });
		}

		if (when === "immediately") {
			const canceled = await stripe.subscriptions.cancel(subId);
			await syncUserFromSubscription(canceled);
		} else {
			const updated = await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
			await syncUserFromSubscription(updated);
		}

		return res.json({ ok: true, when });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error("cancel-subscription", e);
		const fromStripe = readableStripeError(e);
		return res.status(500).json({
			error: fromStripe || "Failed to cancel subscription",
		});
	}
});

// POST /api/billing/resume-subscription — undo cancel-at-period-end
router.post("/resume-subscription", requireAuth, async (req, res) => {
	const stripe = getStripe();
	if (!stripe) {
		return res.status(503).json({ error: "Stripe billing is not configured on this server." });
	}

	try {
		let user = await User.findById(req.user._id).exec();
		if (!user) return res.status(401).json({ error: "Unauthorized" });

		if (!String(user.billing?.stripeSubscriptionId || "").trim()) {
			await resolveStripeCustomerIdForUser(stripe, String(user._id));
			user = await User.findById(req.user._id).exec();
		}

		const subId = String(user?.billing?.stripeSubscriptionId || "").trim();
		if (!subId) {
			return res.status(400).json({ error: "No subscription found." });
		}

		const sub = await stripe.subscriptions.retrieve(subId);
		if (!sub.cancel_at_period_end) {
			return res.status(400).json({ error: "Subscription is not scheduled for cancellation." });
		}
		if (sub.metadata?.userId && sub.metadata.userId !== String(user._id)) {
			return res.status(403).json({ error: "This subscription is not linked to your account." });
		}

		const updated = await stripe.subscriptions.update(subId, { cancel_at_period_end: false });
		await syncUserFromSubscription(updated);
		return res.json({ ok: true });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error("resume-subscription", e);
		const fromStripe = readableStripeError(e);
		return res.status(500).json({
			error: fromStripe || "Failed to resume subscription",
		});
	}
});

export default router;
