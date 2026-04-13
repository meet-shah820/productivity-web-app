import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { Check, Sparkles } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
	getBillingPlans,
	getBillingStatus,
	createBillingCheckoutSession,
	createBillingPortalSession,
	BillingApiError,
	BILLING_UPDATED_EVENT,
	type BillingPlanTier,
	type BillingTierId,
} from "../utils/api";
import { toast } from "sonner";
import { setAuthReturnPath } from "../utils/authRedirect";
import { LegalFooterLinks } from "../components/legal/LegalFooterLinks";

function formatMoney(cents: number, currency = "usd") {
	const code = currency.length === 3 ? currency.toUpperCase() : "USD";
	if (cents <= 0) {
		return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(0);
	}
	return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(cents / 100);
}

function readSignedIn(): boolean {
	try {
		return Boolean(typeof localStorage !== "undefined" && localStorage.getItem("auth_token"));
	} catch {
		return false;
	}
}

export default function Pricing() {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [tiers, setTiers] = useState<BillingPlanTier[]>([]);
	const [checkoutAvailable, setCheckoutAvailable] = useState(false);
	const [plansNotice, setPlansNotice] = useState<string | null>(null);
	const [currentTier, setCurrentTier] = useState<BillingTierId>("free");
	const [signedIn, setSignedIn] = useState(readSignedIn);
	const [loadingTier, setLoadingTier] = useState<BillingTierId | null>(null);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const plans = await getBillingPlans();
				if (!cancelled) {
					setTiers(plans.tiers);
					setCheckoutAvailable(plans.checkoutAvailable);
					setPlansNotice(plans.plansNotice ?? null);
				}
			} catch {
				if (!cancelled) toast.error("Could not load plans.");
			}
			try {
				const st = await getBillingStatus();
				if (!cancelled) {
					setCurrentTier(st.tier);
					setSignedIn(true);
				}
			} catch {
				if (!cancelled) setSignedIn(readSignedIn());
			}
			if (!cancelled) setLoaded(true);
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		const c = searchParams.get("checkout");
		if (c === "success") {
			toast.success("Subscription updated. It may take a few seconds for your tier to sync.");
			void (async () => {
				try {
					const st = await getBillingStatus();
					setCurrentTier(st.tier);
					window.dispatchEvent(new CustomEvent(BILLING_UPDATED_EVENT));
				} catch {
					/* not signed in */
				}
			})();
			searchParams.delete("checkout");
			setSearchParams(searchParams, { replace: true });
		} else if (c === "canceled") {
			toast.message("Checkout canceled.");
			searchParams.delete("checkout");
			setSearchParams(searchParams, { replace: true });
		}
	}, [searchParams, setSearchParams]);

	async function subscribe(tierId: BillingTierId) {
		if (tierId === "free") return;
		if (!readSignedIn()) {
			setAuthReturnPath("/pricing");
			navigate("/auth?next=/pricing");
			return;
		}
		setLoadingTier(tierId);
		try {
			const { url } = await createBillingCheckoutSession(tierId);
			window.location.href = url;
		} catch (e) {
			if (e instanceof BillingApiError && e.code === "USE_PORTAL") {
				toast.message("You already have a subscription. Opening Stripe to change your plan.");
				try {
					const { url } = await createBillingPortalSession();
					window.location.href = url;
				} catch (pe) {
					const pm = pe instanceof Error ? pe.message : "Could not open billing portal.";
					toast.error(pm);
					setLoadingTier(null);
				}
				return;
			}
			if (e instanceof BillingApiError && e.status === 401) {
				setAuthReturnPath("/pricing");
				navigate("/auth?next=/pricing");
				setLoadingTier(null);
				return;
			}
			const msg = e instanceof Error ? e.message : "Checkout failed.";
			toast.error(msg);
			setLoadingTier(null);
		}
	}

	return (
		<div className="min-h-full p-4 lg:p-8 space-y-10">
			<motion.div
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				className="text-center space-y-3 max-w-2xl mx-auto"
			>
				<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-xs text-purple-200">
					<Sparkles className="w-3.5 h-3.5" />
					Monthly billing — cancel anytime
				</div>
				<h1 className="text-3xl lg:text-4xl font-bold text-white">Choose your tier</h1>
				<p className="text-gray-400 text-sm lg:text-base">
					Free forever for core progression. Upgrade for analytics, deeper quests, and elite perks — billed monthly
					through Stripe. Amounts show live Stripe prices when your server can load each Price ID; otherwise catalog
					estimates are shown and Subscribe stays off until keys match.
				</p>
				{loaded && !signedIn ? (
					<p className="text-gray-500 text-sm">Sign in to subscribe. Browse plans below anytime.</p>
				) : null}
				{loaded && plansNotice ? (
					<p className="text-amber-400/90 text-sm max-w-xl mx-auto">{plansNotice}</p>
				) : null}
				{loaded && !checkoutAvailable && !plansNotice ? (
					<p className="text-amber-400/90 text-sm">
						Checkout is not configured (set Stripe keys and monthly Price IDs in the server environment).
					</p>
				) : null}
				<p className="text-gray-500 text-xs max-w-2xl mx-auto leading-relaxed">
					Paid plans are subject to our{" "}
					<Link to="/terms" className="text-indigo-400 hover:text-indigo-300 underline-offset-2 hover:underline">
						Terms of Service
					</Link>{" "}
					(including refunds) and{" "}
					<Link to="/privacy" className="text-indigo-400 hover:text-indigo-300 underline-offset-2 hover:underline">
						Privacy Policy
					</Link>
					. At checkout,{" "}
					<a
						href="https://stripe.com/privacy"
						target="_blank"
						rel="noopener noreferrer"
						className="text-indigo-400 hover:text-indigo-300 underline-offset-2 hover:underline"
					>
						Stripe&apos;s privacy policy
					</a>{" "}
					and{" "}
					<a
						href="https://stripe.com/legal"
						target="_blank"
						rel="noopener noreferrer"
						className="text-indigo-400 hover:text-indigo-300 underline-offset-2 hover:underline"
					>
						terms
					</a>{" "}
					apply. Subscriptions are billed by Stripe; taxes may apply.
				</p>
			</motion.div>

			<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
				{tiers.map((tier, i) => {
					const isCurrent = tier.id === currentTier;
					const isPaid = tier.id !== "free";
					const stripeReady = isPaid && checkoutAvailable && tier.hasPriceId;
					const showHighlight = Boolean(tier.highlight);

					return (
						<motion.div
							key={tier.id}
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.05 * i }}
						>
							<Card
								className={`relative h-full flex flex-col p-6 bg-[#111827] border ${
									showHighlight
										? "border-indigo-400/50 shadow-lg shadow-indigo-500/20"
										: "border-purple-500/20"
								}`}
							>
								{showHighlight ? (
									<div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
										Popular
									</div>
								) : null}

								<div className="mb-4">
									<h2 className="text-xl font-bold text-white">{tier.name}</h2>
									<p className="text-sm text-gray-400 mt-1">{tier.tagline}</p>
								</div>

								<div className="mb-6">
									<span className="text-3xl font-bold text-white">
										{formatMoney(tier.monthlyPriceCents, tier.currency || "usd")}
									</span>
									{tier.monthlyPriceCents > 0 ? (
										<span className="text-gray-400 text-sm ml-1">/ month</span>
									) : (
										<span className="text-gray-400 text-sm ml-1">forever</span>
									)}
								</div>

								<ul className="space-y-3 mb-8 flex-1">
									{tier.features.map((f) => (
										<li key={f} className="flex gap-2 text-sm text-gray-300">
											<Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
											<span>{f}</span>
										</li>
									))}
								</ul>

								{isCurrent ? (
									<Button disabled className="w-full bg-white/10 text-white border border-purple-500/30">
										Current plan
									</Button>
								) : isPaid ? (
									<Button
										className={`w-full ${
											showHighlight
												? "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
												: "bg-white/10 hover:bg-white/15 text-white border border-purple-500/30"
										}`}
										disabled={!stripeReady || loadingTier !== null}
										onClick={() => void subscribe(tier.id)}
									>
										{loadingTier === tier.id
											? "Redirecting…"
											: !stripeReady
												? "Unavailable"
												: !signedIn
													? "Sign in to subscribe"
													: "Subscribe"}
									</Button>
								) : (
									<Button variant="outline" className="w-full border-purple-500/30 text-gray-300" disabled>
										Default at signup
									</Button>
								)}
							</Card>
						</motion.div>
					);
				})}
			</div>

			<LegalFooterLinks className="pt-4" />
		</div>
	);
}
