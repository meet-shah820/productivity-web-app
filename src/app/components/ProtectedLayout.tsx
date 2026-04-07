import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getBillingStatus } from "../utils/api";

export function ProtectedLayout() {
	const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
	const location = useLocation();
	if (!token) {
		return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
	}

	const [checked, setChecked] = useState(false);
	const [needsOnboarding, setNeedsOnboarding] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const s = await getBillingStatus();
				if (!cancelled) {
					setNeedsOnboarding(!s.onboarded);
					setChecked(true);
				}
			} catch {
				// If billing status fails, don't block the app.
				if (!cancelled) setChecked(true);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	if (!checked) return null;
	if (needsOnboarding && location.pathname !== "/pricing") {
		return <Navigate to="/pricing?onboarding=1" replace />;
	}
	return <Outlet />;
}

