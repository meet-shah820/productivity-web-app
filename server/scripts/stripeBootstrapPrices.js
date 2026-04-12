/**
 * One-time (per Stripe account / mode) setup: creates LevelUp Starter / Pro / Elite products
 * with monthly prices. Prints env lines for STRIPE_PRICE_*.
 *
 * Usage (from repo root):
 *   Set STRIPE_SECRET_KEY in .env (sk_test_... or sk_live_...), then:
 *   npm run stripe:bootstrap
 *
 * Run separately for test vs live keys.
 *
 * Important: Paying with a test card in Checkout does NOT create products. Checkout only uses
 * existing Price IDs from your env. New catalog rows appear when you run this script or add
 * products manually in the Dashboard. Use ONE set of three prices in env to avoid duplicates.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import dotenv from "dotenv";
import Stripe from "stripe";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
	dotenv.config({ path: envPath });
} else {
	dotenv.config();
}

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
	console.error("Missing STRIPE_SECRET_KEY in environment (.env).");
	process.exit(1);
}

const stripe = new Stripe(key);

const PLANS = [
	{ tier: "starter", name: "LevelUp — Starter", amount: 499, envKey: "STRIPE_PRICE_STARTER" },
	{ tier: "pro", name: "LevelUp — Pro", amount: 1299, envKey: "STRIPE_PRICE_PRO" },
	{ tier: "elite", name: "LevelUp — Elite", amount: 2499, envKey: "STRIPE_PRICE_ELITE" },
];

async function findProductByTier(tier) {
	try {
		const res = await stripe.products.search({
			query: `active:'true' AND metadata['app_tier']:'${tier}'`,
			limit: 1,
		});
		if (res.data[0]) return res.data[0];
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		console.warn(`products.search failed (${msg}); listing products instead.`);
	}
	let startingAfter;
	for (let page = 0; page < 5; page++) {
		const list = await stripe.products.list({ active: true, limit: 100, starting_after: startingAfter });
		const found = list.data.find((p) => p.metadata?.app_tier === tier);
		if (found) return found;
		if (!list.has_more || list.data.length === 0) break;
		startingAfter = list.data[list.data.length - 1].id;
	}
	return null;
}

async function findMonthlyPriceForProduct(productId, unitAmount) {
	const prices = await stripe.prices.list({ product: productId, active: true, limit: 20 });
	return prices.data.find(
		(p) =>
			p.type === "recurring" &&
			p.recurring?.interval === "month" &&
			p.unit_amount === unitAmount &&
			p.currency === "usd",
	);
}

async function ensurePlan({ tier, name, amount, envKey }) {
	let product = await findProductByTier(tier);
	if (!product) {
		product = await stripe.products.create({
			name,
			metadata: { app: "levelup", app_tier: tier },
		});
		console.log(`Created product ${product.id} (${tier})`);
	} else {
		console.log(`Reusing product ${product.id} (${tier})`);
	}

	let price = await findMonthlyPriceForProduct(product.id, amount);
	if (!price) {
		price = await stripe.prices.create({
			product: product.id,
			currency: "usd",
			unit_amount: amount,
			recurring: { interval: "month" },
			metadata: { app: "levelup", app_tier: tier },
		});
		console.log(`Created price ${price.id} ($${(amount / 100).toFixed(2)}/mo)`);
	} else {
		console.log(`Reusing price ${price.id} ($${(amount / 100).toFixed(2)}/mo)`);
	}

	return { envKey, priceId: price.id };
}

async function main() {
	const mode = key.startsWith("sk_live") ? "LIVE" : "TEST";
	console.log(`\nStripe bootstrap (${mode} mode)\n`);

	const out = [];
	for (const plan of PLANS) {
		const row = await ensurePlan(plan);
		out.push(`${row.envKey}=${row.priceId}`);
	}

	console.log("\n--- Add these to .env and Render (same Stripe mode as this key) ---\n");
	console.log(out.join("\n"));
	console.log("\nThen restart the API. Webhook endpoint: POST /api/billing/webhook");
	console.log("Subscribe to: checkout.session.completed, customer.subscription.created,");
	console.log("customer.subscription.updated, customer.subscription.deleted\n");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
