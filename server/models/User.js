import mongoose from "mongoose";

const StatsSchema = new mongoose.Schema(
	{
		strength: { type: Number, default: 0 },
		intelligence: { type: Number, default: 0 },
		agility: { type: Number, default: 0 },
		vitality: { type: Number, default: 0 },
	},
	{ _id: false }
);

const UserSchema = new mongoose.Schema(
	{
		username: { type: String, required: true, unique: true },
		password: { type: String },
		/** Anonymous app trial; password null; not the same as OAuth (googleId set there). */
		isGuest: { type: Boolean, default: false },
		/** Google OAuth subject ("sub") - unique per Google account */
		googleId: { type: String, default: null, unique: true, sparse: true, index: true },
		/** Shown in UI; falls back to formatted username if empty */
		displayName: { type: String, default: "" },
		email: { type: String, default: "" },
		bio: { type: String, default: "" },
		/** data:image/...;base64,... — optional, max size enforced in routes */
		avatarDataUrl: { type: String, default: "" },
		preferences: {
			notifications: {
				questReminders: { type: Boolean, default: true },
				levelUp: { type: Boolean, default: true },
				achievementUnlocked: { type: Boolean, default: true },
				streakReminders: { type: Boolean, default: true },
				weeklySummary: { type: Boolean, default: false },
			},
		},
		level: { type: Number, default: 1 },
		xp: { type: Number, default: 0 },
		/** Hunter rank E (lowest) → S (apex); only increases over time */
		rank: { type: String, enum: ["E", "D", "C", "B", "A", "S"], default: "E" },
		stats: { type: StatsSchema, default: () => ({}) },
		streak: { type: Number, default: 0 },
		billing: {
			/** free | starter | pro | elite — synced from Stripe webhooks when subscribed */
			tier: { type: String, enum: ["free", "starter", "pro", "elite"], default: "free" },
			stripeCustomerId: { type: String, default: "" },
			stripeSubscriptionId: { type: String, default: "" },
			/** Stripe subscription.status */
			subscriptionStatus: { type: String, default: "" },
			currentPeriodEnd: { type: Date, default: null },
			/** True when subscription is set to cancel at period end (still active until then) */
			cancelAtPeriodEnd: { type: Boolean, default: false },
		},
	},
	{ timestamps: true }
);

export default mongoose.model("User", UserSchema);

