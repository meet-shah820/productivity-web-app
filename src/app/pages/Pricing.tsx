import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Check, CreditCard } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { chooseFreePlan, getBillingStatus, openBillingPortal, refreshBilling, startCheckout, type BillingStatus } from "../utils/api";

type Tier = "free" | "starter" | "pro" | "elite";

const TIERS: {
	id: Tier;
	name: string;
	priceLabel: string;
	description: string;
	features: string[];
	cta: string;
}[] = [
	{
		id: "free",
		name: "Free",
		priceLabel: "$0",
		description: "Try the core experience.",
		features: ["Quests & goals", "Basic analytics", "Streak tracking"],
		cta: "Current plan",
	},
	{
		id: "starter",
		name: "Starter",
		priceLabel: "Monthly",
		description: "For consistent daily progress.",
		features: ["Everything in Free", "More quests per timeframe", "Priority rank recalculation"],
		cta: "Choose Starter",
	},
	{
		id: "pro",
		name: "Pro",
		priceLabel: "Monthly",
		description: "For serious execution mode.",
		features: ["Everything in Starter", "Advanced analytics", "Faster AI suggestions (if enabled)"],
		cta: "Choose Pro",
	},
	{
		id: "elite",
		name: "Elite",
		priceLabel: "Monthly",
		description: "Maximum performance + status.",
		features: ["Everything in Pro", "Exclusive cosmetics/badges", "Early features access"],
		cta: "Choose Elite",
	},
];

function tierBadge(tier: Tier) {
	switch (tier) {
		case "elite":
			return "Elite";
		case "pro":
			return "Pro";
		case "starter":
			return "Starter";
		default:
			return "Free";
	}
}

export default function Pricing() {
	const [status, setStatus] = useState<BillingStatus | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [msg, setMsg] = useState<string | null>(null);
	const [onboarding, setOnboarding] = useState(false);

	useEffect(() => {
		(async () => {
			try {
				// If user just returned from Stripe (success/cancel/portal_return), attempt a manual refresh.
				const qs = new URLSearchParams(window.location.search);
				const billingFlag = qs.get("billing");
				setOnboarding(qs.get("onboarding") === "1");
				if (billingFlag) {
					try {
						const refreshed = await refreshBilling();
						setStatus(refreshed);
					} catch {
						const s = await getBillingStatus();
						setStatus(s);
					}
					qs.delete("billing");
					const next = `${window.location.pathname}${qs.toString() ? `?${qs.toString()}` : ""}${window.location.hash || ""}`;
					window.history.replaceState({}, "", next);
					return;
				}
				const s = await getBillingStatus();
				setStatus(s);
			} catch {
				setStatus(null);
			}
		})();
	}, []);

	const currentTier: Tier = (status?.tier as Tier) || "free";
	const isPaid = currentTier !== "free";
	const needsPlanChoice = onboarding && status != null && !status.onboarded;

	const periodEndLabel = useMemo(() => {
		if (!status?.currentPeriodEndMs) return "";
		const d = new Date(status.currentPeriodEndMs);
		return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
	}, [status?.currentPeriodEndMs]);

	const handleCheckout = async (tier: Exclude<Tier, "free">) => {
		setMsg(null);
		setBusy(tier);
		try {
			const { url } = await startCheckout(tier);
			if (!url) throw new Error("Missing checkout url");
			window.location.href = url;
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "Failed to start checkout");
			setBusy(null);
		}
	};

	const handlePortal = async () => {
		setMsg(null);
		setBusy("portal");
		try {
			const { url } = await openBillingPortal();
			if (!url) throw new Error("Missing portal url");
			window.location.href = url;
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "Failed to open portal");
			setBusy(null);
		}
	};

	const handleChooseFree = async () => {
		setMsg(null);
		setBusy("free");
		try {
			await chooseFreePlan();
			const s = await getBillingStatus();
			setStatus(s);
			window.location.href = "/";
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "Failed to choose free plan");
			setBusy(null);
		}
	};

	return (
		<div className="min-h-full p-4 lg:p-8 space-y-6">
			<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
				<h1 className="text-3xl font-bold text-white">Pricing</h1>
				<p className="text-gray-400">
					Current plan: <span className="text-white font-medium">{tierBadge(currentTier)}</span>
					{status?.stripeStatus ? <span className="text-gray-500"> • {status.stripeStatus}</span> : null}
					{periodEndLabel ? <span className="text-gray-500"> • Renews {periodEndLabel}</span> : null}
				</p>
			</motion.div>

			{needsPlanChoice ? (
				<Card className="bg-[#111827] border-purple-500/30 p-4 text-sm text-gray-300">
					<span className="text-white font-medium">Choose a plan to continue.</span> You can start on Free and upgrade anytime.
				</Card>
			) : null}

			{msg ? <p className="text-sm text-amber-400">{msg}</p> : null}

			<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
				{TIERS.map((t, idx) => {
					const isCurrent = t.id === currentTier;
					const isDisabled = busy != null;
					const highlight = t.id === "pro";
					return (
						<motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * idx }}>
							<Card
								className={`bg-[#111827] border p-6 h-full ${
									highlight ? "border-purple-500/50 shadow-xl shadow-purple-500/20" : "border-purple-500/20"
								}`}
							>
								<div className="flex items-start justify-between gap-4">
									<div>
										<p className="text-white font-semibold text-lg">{t.name}</p>
										<p className="text-xs text-gray-400 mt-1">{t.description}</p>
									</div>
									<div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/30 to-purple-600/30 flex items-center justify-center border border-purple-500/20">
										<CreditCard className="w-5 h-5 text-white" />
									</div>
								</div>

								<div className="mt-5">
									<p className="text-3xl font-bold text-white">{t.priceLabel}</p>
									<p className="text-xs text-gray-500 mt-1">{t.id === "free" ? "No card required" : "Billed via Stripe"}</p>
								</div>

								<ul className="mt-5 space-y-2">
									{t.features.map((f) => (
										<li key={f} className="flex items-start gap-2 text-sm text-gray-300">
											<Check className="w-4 h-4 text-indigo-400 mt-0.5" />
											<span>{f}</span>
										</li>
									))}
								</ul>

								<div className="mt-6 space-y-3">
									{t.id === "free" ? (
										<Button
											type="button"
											variant="outline"
											className="w-full border-purple-500/30 text-white hover:bg-white/5"
											disabled={isDisabled || (isCurrent && status?.onboarded)}
											onClick={() => void handleChooseFree()}
										>
											{busy === "free" ? "Saving…" : isCurrent ? "Current plan" : "Choose Free"}
										</Button>
									) : (
										<Button
											type="button"
											className={`w-full ${
												highlight
													? "bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90"
													: "bg-white/10 hover:bg-white/15"
											}`}
											disabled={isDisabled || isCurrent}
											onClick={() => void handleCheckout(t.id as Exclude<Tier, "free">)}
										>
											{isCurrent ? "Current plan" : busy === t.id ? "Redirecting…" : t.cta}
										</Button>
									)}

									{isPaid ? (
										<Button
											type="button"
											variant="outline"
											className="w-full border-purple-500/30 text-white hover:bg-white/5"
											disabled={busy != null}
											onClick={() => void handlePortal()}
										>
											{busy === "portal" ? "Opening…" : "Manage subscription"}
										</Button>
									) : null}
								</div>
							</Card>
						</motion.div>
					);
				})}
			</div>
		</div>
	);
}

