import { Link } from "react-router-dom";
import { LegalDocumentShell } from "../../components/legal/LegalDocumentShell";

export default function RefundPolicy() {
	return (
		<LegalDocumentShell title="Refund & cancellation policy" metaLine="Last Updated: April 12, 2026">
			<section className="space-y-3">
				<h2>1. Overview</h2>
				<p>
					This policy explains how subscriptions, renewals, cancellations, and refunds work for LevelUp paid plans
					processed through Stripe. It is part of our <Link to="/terms">Terms of Service</Link>.
				</p>
			</section>

			<section className="space-y-3">
				<h2>2. Billing cycle</h2>
				<p>
					Paid plans renew automatically each billing period until you cancel. You can cancel at any time; cancellation
					stops future renewals but does not erase amounts already charged unless a refund applies as described below.
				</p>
			</section>

			<section className="space-y-3">
				<h2>3. How to cancel</h2>
				<p>
					Use the billing or subscription management options in the Service (for example, the Stripe Customer Portal linked
					from Settings or Pricing). You can also cancel through the Stripe receipt or customer portal email if available.
					After cancellation, you typically retain access through the end of the period you already paid for.
				</p>
			</section>

			<section className="space-y-3">
				<h2>4. Refunds</h2>
				<p>
					Unless required by law or expressly stated otherwise at checkout, fees are generally non-refundable. We may, at
					our discretion, offer a partial or full refund if you contact support within a reasonable time and describe a
					billing error, duplicate charge, or serious defect that we confirm.
				</p>
				<p>
					If you believe you are entitled to a refund under consumer law in your country (for example, a statutory cooling
					off period), contact the operator of the Service with your account details and jurisdiction; we will respond in
					line with applicable rules.
				</p>
			</section>

			<section className="space-y-3">
				<h2>5. Chargebacks</h2>
				<p>
					If you initiate a chargeback, we may dispute it with evidence of your purchase and use. We may suspend or close
					accounts associated with abusive or fraudulent payment disputes.
				</p>
			</section>

			<section className="space-y-3">
				<h2>6. Price changes</h2>
				<p>
					If we change subscription prices, we will provide notice as required by law and Stripe. Continued use after a
					change may constitute acceptance of the new price for the next renewal.
				</p>
			</section>

			<section className="space-y-3">
				<h2>7. Contact</h2>
				<p>
					For billing questions, use the contact method provided in the application or on the operator&apos;s website.
					Personal data practices are described in the <Link to="/privacy">Privacy Policy</Link>.
				</p>
			</section>
		</LegalDocumentShell>
	);
}
