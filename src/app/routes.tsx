import { createBrowserRouter } from "react-router-dom";
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
import { ProtectedLayout } from "./components/ProtectedLayout";
import Streak from "./pages/Streak";
import Leaderboard from "./pages/Leaderboard";

export const router = createBrowserRouter([
  {
    path: "/auth",
    Component: Auth
  },
  {
    path: "/auth/callback",
    Component: AuthCallback
  },
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