import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

/**
 * Find `.env` from repo root or parent (e.g. if cwd is `server/`).
 * @returns {string | null}
 */
function findEnvFile() {
	const candidates = [path.join(process.cwd(), ".env"), path.join(process.cwd(), "..", ".env")];
	for (const p of candidates) {
		if (fs.existsSync(p)) return p;
	}
	return null;
}

/**
 * @param {{ mode?: "server" | "script" }} [opts]
 * - server: same rules as the Express app (do not override Render-injected env in production).
 * - script: always load `.env` over existing vars so CLI tools match local file.
 */
export function loadProjectEnv(opts = {}) {
	const scriptMode = opts.mode === "script";
	const onRender = String(process.env.RENDER || "").toLowerCase() === "true";
	// Render injects env in the dashboard. A stray `.env` in the deploy bundle can supply
	// STRIPE_SECRET_KEY while Price IDs come from the dashboard (or vice versa) → "No such price".
	if (!scriptMode && process.env.NODE_ENV === "production" && onRender) {
		return;
	}

	const envPath = findEnvFile();
	const envExample = path.join(process.cwd(), "env.example");
	const envExampleParent = path.join(process.cwd(), "..", "env.example");

	if (envPath) {
		dotenv.config({
			path: envPath,
			override: scriptMode || process.env.NODE_ENV !== "production",
		});
		return;
	}

	if (!scriptMode && process.env.NODE_ENV !== "production") {
		if (fs.existsSync(envExample)) dotenv.config({ path: envExample });
		else if (fs.existsSync(envExampleParent)) dotenv.config({ path: envExampleParent });
	}
}
