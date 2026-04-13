import Stripe from "stripe";

let cached = null;
let cachedKey = "";

/** @returns {Stripe | null} */
export function getStripe() {
	const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
	if (!key) {
		cached = null;
		cachedKey = "";
		return null;
	}
	if (cached && cachedKey === key) return cached;
	cached = new Stripe(key);
	cachedKey = key;
	return cached;
}
