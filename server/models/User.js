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
	},
	{ timestamps: true }
);

export default mongoose.model("User", UserSchema);

