import { Link } from "react-router-dom";

const linkClass =
	"text-indigo-400 hover:text-indigo-300 underline-offset-2 hover:underline transition-colors";

export function LegalFooterLinks({ className = "" }: { className?: string }) {
	return (
		<nav
			className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-gray-500 ${className}`}
			aria-label="Legal"
		>
			<Link to="/privacy" className={linkClass}>
				Privacy Policy
			</Link>
			<span className="text-gray-600" aria-hidden>
				·
			</span>
			<Link to="/terms" className={linkClass}>
				Terms of Service
			</Link>
			<span className="text-gray-600" aria-hidden>
				·
			</span>
			<Link to="/legal/cookies" className={linkClass}>
				Cookie Policy
			</Link>
			<span className="text-gray-600" aria-hidden>
				·
			</span>
			<Link to="/legal/refunds" className={linkClass}>
				Refunds
			</Link>
		</nav>
	);
}
