import express from "express";
import User from "../models/User.js";
import { getUserForReq } from "../utils/demoUser.js";

const router = express.Router();

router.get("/", async (req, res) => {
	try {
		const user = await getUserForReq(req);
		return res.json({
			notifications: user.preferences?.notifications || {},
		});
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to load settings" });
	}
});

router.put("/", async (req, res) => {
	try {
		const user = await getUserForReq(req);
		const { notifications } = req.body || {};
		if (notifications && typeof notifications === "object") {
			user.preferences = user.preferences || {};
			user.preferences.notifications = {
				...user.preferences.notifications,
				...notifications,
			};
			await user.save();
		}
		return res.json({ ok: true, notifications: user.preferences.notifications });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return res.status(500).json({ error: "Failed to save settings" });
	}
});

export default router;

