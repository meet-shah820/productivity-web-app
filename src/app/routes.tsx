import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Quests from "./pages/Quests";
import Goals from "./pages/Goals";
import FocusMode from "./pages/FocusMode";
import Skills from "./pages/Skills";
import Analytics from "./pages/Analytics";
import Profile from "./pages/Profile";
import Achievements from "./pages/Achievements";
import Settings from "./pages/Settings";
import Pricing from "./pages/Pricing";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import CookiePolicy from "./pages/legal/CookiePolicy";
import RefundPolicy from "./pages/legal/RefundPolicy";
import { ProtectedLayout } from "./components/ProtectedLayout";
import Streak from "./pages/Streak";
import Leaderboard from "./pages/Leaderboard";

function RedirectToPrivacy() {
	return <Navigate to="/privacy" replace />;
}

function RedirectToTerms() {
	return <Navigate to="/terms" replace />;
}

export const router = createBrowserRouter([
  {
    path: "/auth",
    Component: Auth
  },
  {
    path: "/auth/callback",
    Component: AuthCallback
  },
  { path: "/privacy", Component: Privacy },
  { path: "/terms", Component: Terms },
  { path: "/legal/privacy", Component: RedirectToPrivacy },
  { path: "/legal/terms", Component: RedirectToTerms },
  { path: "/legal/cookies", Component: CookiePolicy },
  { path: "/legal/refunds", Component: RefundPolicy },
  {
    path: "/",
    Component: ProtectedLayout,
    children: [
      {
        path: "/",
        Component: Layout,
        children: [
          { index: true, Component: Dashboard },
          { path: "quests", Component: Quests },
          { path: "goals", Component: Goals },
          { path: "focus", Component: FocusMode },
          { path: "skills", Component: Skills },
          { path: "analytics", Component: Analytics },
          { path: "streak", Component: Streak },
          { path: "leaderboard", Component: Leaderboard },
          { path: "profile", Component: Profile },
          { path: "achievements", Component: Achievements },
          { path: "pricing", Component: Pricing },
          { path: "settings", Component: Settings },
        ],
      },
    ],
  },
]);