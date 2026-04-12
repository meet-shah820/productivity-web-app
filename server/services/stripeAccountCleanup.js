/**
 * @param {import("stripe").Stripe.Subscription} sub
 * @param {import("mongoose").Document} user
 */
export function subscriptionBelongsToUser(sub, user) {
	const uid = String(user._id);
	const meta = sub.metadata?.userId;
	const cust = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
	const storedCid = String(user.billing?.stripeCustomerId || "").trim();
	const storedSubId = String(user.billing?.stripeSubscriptionId || "").trim();

	if (meta && meta !== uid) return false;
	if (storedCid && cust && cust !== storedCid) return false;
	if (meta === uid) return true;
	if (storedSubId && sub.id === storedSubId) return true;
	if (storedCid && cust === storedCid) return true;
	return false;
}

const CANCELLABLE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "incomplete"]);

/**
 * Immediately cancels any Stripe subscriptions tied to this user (same metadata / customer as checkout).
 * @param {import("stripe").Stripe} stripe
 * @param {import("mongoose").Document} user
 */
export async function cancelStripeBillingForUser(stripe, user) {
	const customerId = String(user.billing?.stripeCustomerId || "").trim();
	const primarySubId = String(user.billing?.stripeSubscriptionId || "").trim();

	/** @type {Set<string>} */
	const idsToCancel = new Set();

	if (primarySubId) {
		try {
			const sub = await stripe.subscriptions.retrieve(primarySubId);
			if (subscriptionBelongsToUser(sub, user) && CANCELLABLE_STATUSES.has(sub.status)) {
				idsToCancel.add(sub.id);
			}
		} catch (e) {
			if (e?.code !== "resource_missing") throw e;
		}
	}

	if (customerId) {
		const { data } = await stripe.subscriptions.list({ customer: customerId, limit: 100 });
		for (const sub of data) {
			if (!CANCELLABLE_STATUSES.has(sub.status)) continue;
			if (subscriptionBelongsToUser(sub, user)) idsToCancel.add(sub.id);
		}
	}

	for (const id of idsToCancel) {
		try {
			await stripe.subscriptions.cancel(id);
		} catch (e) {
			if (e?.code === "resource_missing") continue;
			throw e;
		}
	}
}
