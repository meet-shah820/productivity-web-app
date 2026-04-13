import { Link } from "react-router-dom";
import { LegalDocumentShell } from "../components/legal/LegalDocumentShell";

export default function Terms() {
	return (
		<LegalDocumentShell title="📜 TERMS OF SERVICE – LevelUp">
			<section className="space-y-3">
				<h2>1. Acceptance of Terms</h2>
				<p>By using LevelUp, you agree to these Terms.</p>
				<p>If you do not agree, do not use the service.</p>
			</section>

			<section className="space-y-3">
				<h2>2. Description of Service</h2>
				<p>LevelUp is a productivity web app where users:</p>
				<ul>
					<li>Set goals</li>
					<li>Complete quests</li>
					<li>Track progress</li>
					<li>Unlock achievements and skills</li>
				</ul>
			</section>

			<section className="space-y-3">
				<h2>3. Accounts</h2>
				<p>You must:</p>
				<ul>
					<li>Provide accurate information</li>
					<li>Keep your login secure</li>
				</ul>
				<p>We may suspend accounts that violate these terms.</p>
			</section>

			<section className="space-y-3">
				<h2>4. Subscriptions &amp; Payments</h2>
				<p>LevelUp offers:</p>
				<ul>
					<li>Free tier</li>
					<li>Paid monthly subscription</li>
				</ul>
				<p>Payments are processed via Stripe.</p>
				<p>
					Stripe&apos;s policies apply at checkout:{" "}
					<a
						href="https://stripe.com/privacy"
						target="_blank"
						rel="noopener noreferrer"
						className="text-indigo-400 underline-offset-2 hover:underline"
					>
						Stripe Privacy
					</a>
					{" · "}
					<a
						href="https://stripe.com/legal"
						target="_blank"
						rel="noopener noreferrer"
						className="text-indigo-400 underline-offset-2 hover:underline"
					>
						Stripe Legal
					</a>
				</p>
				<h3 className="text-gray-200 text-sm font-medium pt-2">Billing Terms:</h3>
				<ul>
					<li>Subscriptions are billed monthly</li>
					<li>Payments are charged automatically</li>
					<li>You can cancel anytime</li>
				</ul>
			</section>

			<section className="space-y-3">
				<h2>5. Refund Policy</h2>
				<p>
					<span aria-hidden>🚫</span> All payments are non-refundable
				</p>
				<p>Once charged, no refunds will be issued.</p>
			</section>

			<section className="space-y-3">
				<h2>6. Cancellation</h2>
				<p>You may cancel your subscription at any time.</p>
				<ul>
					<li>Cancellation stops future billing</li>
					<li>You will retain access until the end of your billing cycle</li>
				</ul>
			</section>

			<section className="space-y-3">
				<h2>7. Acceptable Use</h2>
				<p>You agree NOT to:</p>
				<ul>
					<li>Abuse or exploit the system</li>
					<li>Attempt unauthorized access</li>
					<li>Disrupt the platform</li>
				</ul>
			</section>

			<section className="space-y-3">
				<h2>8. Intellectual Property</h2>
				<p>All content, branding, and features belong to LevelUp.</p>
				<p>You may not copy or reuse without permission.</p>
			</section>

			<section className="space-y-3">
				<h2>9. Termination</h2>
				<p>We may suspend or terminate accounts if:</p>
				<ul>
					<li>Terms are violated</li>
					<li>Fraud or misuse is detected</li>
				</ul>
			</section>

			<section className="space-y-3">
				<h2>10. Disclaimer</h2>
				<p>The service is provided &quot;as is&quot;. We do not guarantee:</p>
				<ul>
					<li>Continuous availability</li>
					<li>Error-free performance</li>
				</ul>
			</section>

			<section className="space-y-3">
				<h2>11. Limitation of Liability</h2>
				<p>LevelUp is not liable for:</p>
				<ul>
					<li>Data loss</li>
					<li>Service interruptions</li>
					<li>Any indirect damages</li>
				</ul>
			</section>

			<section className="space-y-3">
				<h2>12. Governing Law</h2>
				<p>
					<span aria-hidden>📍</span> These Terms are governed by the laws of: <strong className="text-gray-200">Ontario, Canada</strong>
				</p>
			</section>

			<section className="space-y-3">
				<h2>13. Changes to Terms</h2>
				<p>We may update these Terms at any time.</p>
			</section>

			<section className="space-y-3">
				<h2>14. Contact</h2>
				<p>
					<span aria-hidden>📧</span>{" "}
					<a href="mailto:shahmeet8210@gmail.com" className="text-indigo-400 underline-offset-2 hover:underline">
						shahmeet8210@gmail.com
					</a>
				</p>
				<p className="pt-2">
					See also our <Link to="/privacy">Privacy Policy</Link>.
				</p>
			</section>
		</LegalDocumentShell>
	);
}
