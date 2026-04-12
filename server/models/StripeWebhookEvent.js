import mongoose from "mongoose";

/**
 * Records processed Stripe webhook event IDs so retries are acknowledged without double work.
 * Processing remains idempotent on the User side; this avoids redundant DB writes.
 */
const StripeWebhookEventSchema = new mongoose.Schema(
	{
		stripeEventId: { type: String, required: true, unique: true, index: true },
		type: { type: String, default: "" },
		receivedAt: { type: Date, default: Date.now },
	},
	{ timestamps: true }
);

export default mongoose.model("StripeWebhookEvent", StripeWebhookEventSchema);
