import { getStripe } from "../services/stripeClient.js";
import { syncUserFromSubscription, linkCheckoutSessionToUser } from "../services/billingSync.js";
import StripeWebhookEvent from "../models/StripeWebhookEvent.js";

/**
 * @param {import("stripe").Stripe} stripe
 * @param {import("stripe").Stripe.Checkout.Session} session
 */
async function handleSubscriptionCheckoutSession(stripe, session) {
	if (session.mode !== "subscription") return;

	const userId = session.metadata?.userId || session.client_reference_id;
	const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
	const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

	if (userId && customerId) {
		await linkCheckoutSessionToUser(userId, customerId, subId || "");
	}
	if (subId) {
		const sub = await stripe.subscriptions.retrieve(subId);
		await syncUserFromSubscription(sub);
	}
}

/**
 * Express handler — must be mounted with express.raw({ type: "application/json" }).
 */
export async function billingWebhookHandler(req, res) {
	const stripe = getStripe();
	const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
	if (!stripe || !secret) {
		return res.status(503).send("Billing not configured");
	}

	const sig = req.headers["stripe-signature"];
	if (!sig || typeof sig !== "string") {
		return res.status(400).send("Missing stripe-signature");
	}

	let event;
	try {
		event = stripe.webhooks.constructEvent(req.body, sig, secret);
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Invalid payload";
		return res.status(400).send(`Webhook Error: ${msg}`);
	}

	try {
		switch (event.type) {
			case "checkout.session.completed":
			case "checkout.session.async_payment_succeeded": {
				const session = /** @type {import("stripe").Stripe.Checkout.Session} */ (event.data.object);
				await handleSubscriptionCheckoutSession(stripe, session);
				break;
			}
			case "customer.subscription.created":
			case "customer.subscription.updated":
			case "customer.subscription.deleted": {
				const sub = /** @type {import("stripe").Stripe.Subscription} */ (event.data.object);
				await syncUserFromSubscription(sub);
				break;
			}
			case "invoice.paid": {
				const invoice = /** @type {import("stripe").Stripe.Invoice} */ (event.data.object);
				const subId =
					typeof invoice.subscription === "string"
						? invoice.subscription
						: invoice.subscription?.id || null;
				if (subId) {
					const sub = await stripe.subscriptions.retrieve(subId);
					await syncUserFromSubscription(sub);
				}
				break;
			}
			case "invoice.payment_failed": {
				const invoice = /** @type {import("stripe").Stripe.Invoice} */ (event.data.object);
				const subId =
					typeof invoice.subscription === "string"
						? invoice.subscription
						: invoice.subscription?.id || null;
				if (subId) {
					const sub = await stripe.subscriptions.retrieve(subId);
					await syncUserFromSubscription(sub);
				}
				break;
			}
			default:
				break;
		}

		try {
			await StripeWebhookEvent.create({
				stripeEventId: event.id,
				type: event.type,
			});
		} catch (createErr) {
			if (createErr?.code === 11000) {
				return res.json({ received: true, duplicate: true });
			}
			throw createErr;
		}
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error("billing webhook handler error", e);
		return res.status(500).json({ error: "Webhook handler failed" });
	}

	return res.json({ received: true });
}
