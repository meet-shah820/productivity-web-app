import User from "../models/User.js";
import { getTierFromStripePriceId } from "../constants/billingPlans.js";

/**
 * @param {import("stripe").Stripe.Subscription} subscription
 * @returns {Promise<import("mongoose").Document | null>}
 */
async function findUserForSubscription(subscription) {
	const metaUid = subscription.metadata?.userId;
	if (metaUid) {
		const u = await User.findById(metaUid).exec();
		if (u) return u;
	}
	const cid = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
	if (cid) {
		const u = await User.findOne({ "billing.stripeCustomerId": cid }).exec();
		if (u) return u;
	}
	const sid = subscription.id;
	if (sid) {
		const u = await User.findOne({ "billing.stripeSubscriptionId": sid }).exec();
		if (u) return u;
	}
	return null;
}

/**
 * @param {import("stripe").Stripe.Subscription} subscription
 */
export async function syncUserFromSubscription(subscription) {
	const user = await findUserForSubscription(subscription);
	if (!user) {
		// eslint-disable-next-line no-console
		console.warn("billingSync: no user for subscription", subscription.id);
		return;
	}

	const priceId = subscription.items?.data?.[0]?.price?.id;
	const tierFromPrice = getTierFromStripePriceId(priceId);
	const status = subscription.status;

	const customerId =
		typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || "";

	if (status === "incomplete") {
		user.billing = user.billing || {};
		user.billing.stripeCustomerId = customerId || user.billing.stripeCustomerId;
		user.billing.stripeSubscriptionId = subscription.id;
		user.billing.subscriptionStatus = status;
		user.billing.cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
		await user.save();
		return;
	}

	if (status === "active" || status === "trialing") {
		user.billing = user.billing || {};
		user.billing.stripeCustomerId = customerId || user.billing.stripeCustomerId;
		user.billing.stripeSubscriptionId = subscription.id;
		user.billing.subscriptionStatus = status;
		user.billing.currentPeriodEnd = subscription.current_period_end
			? new Date(subscription.current_period_end * 1000)
			: null;
		user.billing.tier = tierFromPrice || user.billing.tier || "free";
		user.billing.cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
		await user.save();
		return;
	}

	if (status === "canceled" || status === "unpaid" || status === "incomplete_expired" || status === "paused") {
		user.billing = user.billing || {};
		user.billing.stripeSubscriptionId = "";
		user.billing.subscriptionStatus = status;
		user.billing.currentPeriodEnd = null;
		user.billing.tier = "free";
		user.billing.cancelAtPeriodEnd = false;
		await user.save();
		return;
	}

	// past_due, incomplete, etc. — keep tier but record status for portal / UX
	user.billing = user.billing || {};
	user.billing.stripeCustomerId = customerId || user.billing.stripeCustomerId;
	user.billing.stripeSubscriptionId = subscription.id;
	user.billing.subscriptionStatus = status;
	user.billing.currentPeriodEnd = subscription.current_period_end
		? new Date(subscription.current_period_end * 1000)
		: null;
	user.billing.cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
	if (tierFromPrice) user.billing.tier = tierFromPrice;
	await user.save();
}

/**
 * @param {string} userId
 * @param {string} customerId
 * @param {string} subscriptionId
 */
export async function linkCheckoutSessionToUser(userId, customerId, subscriptionId) {
	if (!userId || !customerId) return;
	const user = await User.findById(userId).exec();
	if (!user) return;
	user.billing = user.billing || {};
	user.billing.stripeCustomerId = customerId;
	if (subscriptionId) user.billing.stripeSubscriptionId = subscriptionId;
	await user.save();
}

/**
 * Fills missing billing.stripeCustomerId from Stripe when the user is subscribed but the DB link was lost.
 * @param {import("stripe").Stripe} stripe
 * @param {string} userId Mongo user id
 * @returns {Promise<string | null>} Stripe customer id or null
 */
export async function resolveStripeCustomerIdForUser(stripe, userId) {
	const user = await User.findById(userId).exec();
	if (!user) return null;

	const existing = String(user.billing?.stripeCustomerId || "").trim();
	if (existing) return existing;

	const subId = String(user.billing?.stripeSubscriptionId || "").trim();
	if (subId) {
		try {
			const sub = await stripe.subscriptions.retrieve(subId);
			const c = sub.customer;
			const cid = typeof c === "string" ? c : c && typeof c === "object" && "id" in c ? String(c.id) : "";
			if (cid) {
				user.billing = user.billing || {};
				user.billing.stripeCustomerId = cid;
				user.billing.cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
				await user.save();
				return cid;
			}
		} catch {
			/* subscription may be deleted in Stripe */
		}
	}

	const uid = String(user._id);
	const safeUid = uid.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
	try {
		const result = await stripe.subscriptions.search({
			query: `metadata['userId']:'${safeUid}'`,
			limit: 10,
		});
		for (const sub of result.data) {
			if (!["active", "trialing", "past_due"].includes(sub.status)) continue;
			const c = sub.customer;
			const cid = typeof c === "string" ? c : c && typeof c === "object" && "id" in c ? String(c.id) : "";
			if (cid) {
				user.billing = user.billing || {};
				user.billing.stripeCustomerId = cid;
				user.billing.stripeSubscriptionId = sub.id;
				user.billing.subscriptionStatus = sub.status;
				if (sub.current_period_end) {
					user.billing.currentPeriodEnd = new Date(sub.current_period_end * 1000);
				}
				const priceId = sub.items?.data?.[0]?.price?.id;
				const tierFromPrice = getTierFromStripePriceId(priceId);
				if (tierFromPrice) user.billing.tier = tierFromPrice;
				user.billing.cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
				await user.save();
				return cid;
			}
		}
	} catch {
		/* search API unavailable or no results */
	}

	return null;
}
