import { Link } from "react-router-dom";
import { LegalDocumentShell } from "../components/legal/LegalDocumentShell";

const SITE_URL = "https://levelup-productivity-web-app.vercel.app";

export default function Privacy() {
	return (
		<LegalDocumentShell title="🛡️ PRIVACY POLICY – LevelUp">
			<section className="space-y-3">
				<h2>1. Introduction</h2>
				<p>
					Welcome to LevelUp (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;). We respect your privacy and are committed to protecting your
					personal data.
				</p>
				<p>This Privacy Policy explains how we collect, use, and safeguard your information when you use:</p>
				<p>
					<span className="mr-1" aria-hidden>
						👉
					</span>
					<a href={SITE_URL} className="text-indigo-400 underline-offset-2 hover:underline break-all">
						{SITE_URL}
					</a>
				</p>
			</section>

			<section className="space-y-3">
				<h2>2. Information We Collect</h2>
				<h3 className="text-gray-200 text-sm font-medium">Personal Information</h3>
				<p>When you create an account, we collect:</p>
				<ul>
					<li>Name</li>
					<li>Email address</li>
					<li>Profile information</li>
				</ul>
				<h3 className="text-gray-200 text-sm font-medium pt-2">Payment Information</h3>
				<p>Payments are processed securely through Stripe. We do NOT store your card details.</p>
				<p>
					Stripe&apos;s own policies apply when you pay:{" "}
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
			</section>

			<section className="space-y-3">
				<h2>3. How We Use Your Information</h2>
				<p>We use your data to:</p>
				<ul>
					<li>Create and manage your account</li>
					<li>Provide productivity tracking features</li>
					<li>Manage subscriptions and billing</li>
					<li>Improve the platform</li>
				</ul>
			</section>

			<section className="space-y-3">
				<h2>4. Cookies &amp; Tracking</h2>
				<p>We currently:</p>
				<ul>
					<li>
						<span aria-hidden>❌</span> Do NOT use cookies for tracking
					</li>
					<li>
						<span aria-hidden>❌</span> Do NOT use Google Analytics
					</li>
				</ul>
				<p>(We may update this in the future, and this policy will be revised accordingly.)</p>
			</section>

			<section className="space-y-3">
				<h2>5. Data Sharing</h2>
				<p>We do NOT sell your data.</p>
				<p>We only share data with:</p>
				<ul>
					<li>Stripe (for payments)</li>
				</ul>
			</section>

			<section className="space-y-3">
				<h2>6. Data Retention</h2>
				<p>We keep your data as long as your account is active.</p>
				<p>You may request deletion anytime.</p>
			</section>

			<section className="space-y-3">
				<h2>7. Your Rights</h2>
				<p>You have the right to:</p>
				<ul>
					<li>Access your data</li>
					<li>Request correction</li>
					<li>Request deletion</li>
				</ul>
				<p>
					To do so, contact:{" "}
					<span aria-hidden>📧</span>{" "}
					<a href="mailto:shahmeet8210@gmail.com" className="text-indigo-400 underline-offset-2 hover:underline">
						shahmeet8210@gmail.com
					</a>
				</p>
			</section>

			<section className="space-y-3">
				<h2>8. Security</h2>
				<p>We take reasonable steps to protect your data. However, no system is 100% secure.</p>
			</section>

			<section className="space-y-3">
				<h2>9. Children&apos;s Privacy</h2>
				<p>
					LevelUp does not impose a specific age restriction, but the service is intended for general audiences.
				</p>
			</section>

			<section className="space-y-3">
				<h2>10. Changes to This Policy</h2>
				<p>We may update this policy. Changes will be posted on this page.</p>
			</section>

			<section className="space-y-3">
				<h2>11. Contact</h2>
				<p>
					For any privacy-related questions: <span aria-hidden>📧</span>{" "}
					<a href="mailto:shahmeet8210@gmail.com" className="text-indigo-400 underline-offset-2 hover:underline">
						shahmeet8210@gmail.com
					</a>
				</p>
				<p className="pt-2">
					See also our <Link to="/terms">Terms of Service</Link>.
				</p>
			</section>
		</LegalDocumentShell>
	);
}
