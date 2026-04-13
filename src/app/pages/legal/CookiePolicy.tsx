import { Link } from "react-router-dom";
import { LegalDocumentShell } from "../../components/legal/LegalDocumentShell";

export default function CookiePolicy() {
	return (
		<LegalDocumentShell title="Cookie Policy" metaLine="Last Updated: April 12, 2026">
			<section className="space-y-3">
				<h2>1. What are cookies?</h2>
				<p>
					Cookies are small text files stored on your device. We also use similar technologies such as local storage and
					session storage where described below.
				</p>
			</section>

			<section className="space-y-3">
				<h2>2. How LevelUp uses cookies</h2>
				<ul>
					<li>
						<strong className="text-gray-200">Strictly necessary:</strong> tokens or keys stored in local storage or
						session storage so you stay signed in, and security-related cookies if added by our hosting stack.
					</li>
					<li>
						<strong className="text-gray-200">Functional:</strong> preferences such as theme or UI settings you choose in
						the app.
					</li>
					<li>
						<strong className="text-gray-200">Analytics (if enabled):</strong> first- or third-party cookies used to
						measure traffic and errors. We only enable non-essential analytics where permitted and, where required, with your
						consent.
					</li>
				</ul>
			</section>

			<section className="space-y-3">
				<h2>3. Third parties</h2>
				<p>
					When you use Stripe Checkout or the Stripe Customer Portal, Stripe may set cookies governed by Stripe&apos;s
					policies. Social login providers may set their own cookies when you authenticate with them.
				</p>
			</section>

			<section className="space-y-3">
				<h2>4. Managing cookies</h2>
				<p>
					You can block or delete cookies through your browser settings. Blocking strictly necessary storage may prevent the
					Service from working (for example, you may not stay signed in). Where we offer a consent banner or settings for
					non-essential cookies, you can change your choices there.
				</p>
			</section>

			<section className="space-y-3">
				<h2>5. Contact</h2>
				<p>
					Questions about this policy can be directed to the operator of the Service. See also our{" "}
					<Link to="/privacy">Privacy Policy</Link>.
				</p>
			</section>
		</LegalDocumentShell>
	);
}
