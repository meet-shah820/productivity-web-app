import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { LegalFooterLinks } from "./LegalFooterLinks";

type LegalDocumentShellProps = {
	title: string;
	children: ReactNode;
	/** Shown under the title (e.g. "Last Updated: …") */
	metaLine?: string;
};

export function LegalDocumentShell({
	title,
	children,
	metaLine = "Last Updated: April 12, 2026",
}: LegalDocumentShellProps) {
	return (
		<div className="min-h-screen bg-[#0B0F1A] text-gray-300">
			<div className="border-b border-purple-500/20 bg-[#111827]/80 backdrop-blur-xl">
				<div className="max-w-3xl mx-auto px-4 py-4">
					<Link
						to="/"
						className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
					>
						<ArrowLeft className="w-4 h-4 shrink-0" />
						Back to app
					</Link>
				</div>
			</div>
			<article className="max-w-3xl mx-auto px-4 py-10 space-y-8">
				<header className="space-y-2">
					<h1 className="text-3xl font-bold text-white">{title}</h1>
					<p className="text-sm text-gray-500">{metaLine}</p>
				</header>
				<div className="space-y-8 text-sm leading-relaxed [&_h2]:text-white [&_h2]:text-base [&_h2]:font-semibold [&_h2]:scroll-mt-24 [&_h3]:text-gray-200 [&_p]:text-gray-300 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_li]:text-gray-300 [&_a]:text-indigo-400 [&_a]:underline-offset-2 [&_a:hover]:underline">
					{children}
				</div>
			</article>
			<div className="max-w-3xl mx-auto px-4 pb-12 border-t border-purple-500/10 pt-8">
				<LegalFooterLinks />
			</div>
		</div>
	);
}
