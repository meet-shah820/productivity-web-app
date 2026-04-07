import { useEffect, useMemo, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Target,
  Flag,
  Focus,
  Zap,
  BarChart3,
  User,
  Trophy,
  Settings,
  Menu,
  X,
  Bell,
  Palette,
  Calendar,
  CreditCard,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { motion, AnimatePresence } from "motion/react";
import { getDashboard, getRecentHistory, PROFILE_UPDATED_EVENT, RANK_UPDATED_EVENT } from "../utils/api";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Quests", href: "/quests", icon: Target },
  { name: "Goals", href: "/goals", icon: Flag },
  { name: "Focus Mode", href: "/focus", icon: Focus },
  { name: "Skills", href: "/skills", icon: Zap },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Streak", href: "/streak", icon: Calendar },
  { name: "Profile", href: "/profile", icon: User },
  { name: "Achievements", href: "/achievements", icon: Trophy },
  { name: "Pricing", href: "/pricing", icon: CreditCard },
  { name: "Settings", href: "/settings", icon: Settings },
];

type NotifItem = {
  id: string;
  type: string;
  message: string;
  at?: string;
  occurredAt?: string;
  xp?: number;
  xpChange?: number;
  questId?: string;
  achievementId?: string;
};

function notifTimeLabel(it: NotifItem) {
  const raw = it.at ?? it.occurredAt;
  if (!raw) return "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

const NOTIF_LAST_SEEN_KEY = "notif_last_seen_at";

function notifEpochMs(it: NotifItem): number {
  const raw = it.at ?? it.occurredAt;
  if (!raw) return 0;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function readLastSeenNotifMs(): number {
  try {
    const raw = localStorage.getItem(NOTIF_LAST_SEEN_KEY);
    if (!raw) return 0;
    const ms = Number(raw);
    return Number.isFinite(ms) ? ms : 0;
  } catch {
    return 0;
  }
}

function writeLastSeenNotifMs(ms: number) {
  try {
    localStorage.setItem(NOTIF_LAST_SEEN_KEY, String(ms));
  } catch {
    // ignore storage errors
  }
}

export function Layout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [notifOpen, setNotifOpen] = useState(false);
  const [dash, setDash] = useState<any>(null);
  const [recent, setRecent] = useState<NotifItem[]>([]);
  const [lastSeenNotifMs, setLastSeenNotifMs] = useState<number>(() => readLastSeenNotifMs());
  useEffect(() => {
    let cancelled = false;
    async function loadHeaderData() {
      try {
        const d = await getDashboard();
        if (!cancelled) setDash(d);
      } catch {}
      try {
        const r = await getRecentHistory();
        if (!cancelled) setRecent(r.items || []);
      } catch {}
    }
    void loadHeaderData();
    const onProfileUpdated = () => {
      void loadHeaderData();
    };
    const onRankUpdated = () => {
      void loadHeaderData();
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
    window.addEventListener(RANK_UPDATED_EVENT, onRankUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
      window.removeEventListener(RANK_UPDATED_EVENT, onRankUpdated);
    };
  }, []);
  const user = useMemo(() => {
    if (!dash) {
      return { name: "Player", avatar: "", level: 1, currentXP: 0, maxXP: 100, rank: "E" };
    }
    const u = dash.user;
    const display = String(u.displayName || "").trim();
    const name = display || "Player";
    return {
      name,
      avatar: u.avatarDataUrl || "",
      level: u.level,
      currentXP: u.xp,
      maxXP: u.nextLevelXp,
      rank: u.rank ?? "E",
    };
  }, [dash]);

  function handleNotificationClick(it: NotifItem) {
    switch (it.type) {
      case "quest":
        if (it.questId) {
          navigate(`/quests?highlightQuest=${encodeURIComponent(it.questId)}`);
        } else {
          navigate("/quests");
        }
        break;
      case "achievement":
        if (it.achievementId) {
          navigate(`/achievements?highlight=${encodeURIComponent(it.achievementId)}`);
        } else {
          navigate("/achievements");
        }
        break;
      case "level":
        navigate("/?highlightLevel=1");
        break;
      case "focus":
        navigate("/focus?highlight=1");
        break;
      default:
        navigate("/");
    }
    setNotifOpen(false);
    // Mark as seen when interacting with a notification.
    const latest = recent.reduce((m, x) => Math.max(m, notifEpochMs(x)), 0);
    if (latest > 0) {
      setLastSeenNotifMs(latest);
      writeLastSeenNotifMs(latest);
    }
  }

  const xpPercentage = (user.currentXP / user.maxXP) * 100;
  const latestNotifMs = useMemo(() => recent.reduce((m, x) => Math.max(m, notifEpochMs(x)), 0), [recent]);
  const hasUnreadNotifications = latestNotifMs > Math.max(0, lastSeenNotifMs);

  return (
    <div className="h-screen flex overflow-hidden bg-[#0B0F1A]">
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 80 }}
        className="hidden lg:flex flex-col bg-[#111827] border-r border-purple-500/20 relative overflow-hidden"
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 via-transparent to-blue-500/5 pointer-events-none" />

        <div className="relative z-10 flex-1 flex flex-col">
          {/* Logo */}
          <div className="h-20 flex items-center px-6 border-b border-purple-500/20">
            <motion.div
              initial={false}
              animate={{ opacity: sidebarOpen ? 1 : 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/50">
                <Zap className="w-6 h-6 text-white" />
              </div>
              {sidebarOpen && (
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  LevelUp
                </span>
              )}
            </motion.div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-6 space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                end={item.href === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative ${
                    isActive
                      ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white shadow-lg shadow-purple-500/20"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <item.icon
                      className={`w-5 h-5 relative z-10 ${
                        isActive ? "text-indigo-400" : ""
                      }`}
                    />
                    {sidebarOpen && (
                      <span className="relative z-10 text-sm">{item.name}</span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Toggle Button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mx-3 mb-6 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </motion.aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed inset-y-0 left-0 w-72 bg-[#111827] border-r border-purple-500/20 z-50 lg:hidden"
            >
              <div className="h-full flex flex-col">
                <div className="h-20 flex items-center justify-between px-6 border-b border-purple-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/50">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                      LevelUp
                    </span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="flex-1 px-3 py-6 space-y-1">
                  {navigation.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      end={item.href === "/"}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                          isActive
                            ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white shadow-lg shadow-purple-500/20"
                            : "text-gray-400 hover:text-white hover:bg-white/5"
                        }`
                      }
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="text-sm">{item.name}</span>
                    </NavLink>
                  ))}
                </nav>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-20 bg-[#111827]/50 backdrop-blur-xl border-b border-purple-500/20 flex items-center justify-between px-4 lg:px-8 relative z-50">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-blue-500/5 pointer-events-none" />

          <div className="flex items-center gap-4 relative z-10">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-4 relative z-10">
            {/* XP Bar */}
            <div className="hidden md:flex flex-col items-end min-w-[200px]">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs text-gray-400">Level {user.level}</span>
                <span className="text-xs text-indigo-400 font-medium">
                  {user.currentXP.toLocaleString()} / {user.maxXP.toLocaleString()} XP
                </span>
              </div>
              <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden backdrop-blur-sm border border-purple-500/20">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${xpPercentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent animate-pulse" />
                </motion.div>
              </div>
            </div>

            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="relative text-gray-400 hover:text-white"
              onClick={() => {
                setNotifOpen((v) => {
                  const next = !v;
                  // Mark as seen when opening the panel.
                  if (next && latestNotifMs > 0) {
                    setLastSeenNotifMs(latestNotifMs);
                    writeLastSeenNotifMs(latestNotifMs);
                  }
                  return next;
                });
              }}
            >
              <Bell className="w-5 h-5" />
              {hasUnreadNotifications && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-[#111827]" />
              )}
            </Button>
            {notifOpen && (
              <div className="absolute right-4 top-16 z-50 w-80 p-3 rounded-xl bg-[#111827] border border-purple-500/30 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-white">Notifications</span>
                  <button className="text-xs text-gray-400 hover:text-white" onClick={() => setNotifOpen(false)}>Close</button>
                </div>
                <div className="space-y-2 max-h-80 overflow-auto">
                  {recent.length === 0 ? (
                    <p className="text-xs text-gray-500">No recent activity</p>
                  ) : recent.map((it, idx) => (
                    <button
                      key={it.id || idx}
                      type="button"
                      onClick={() => handleNotificationClick(it)}
                      className="w-full text-left p-2 rounded-lg bg-white/5 border border-purple-500/20 hover:bg-white/10 hover:border-purple-500/40 transition-colors cursor-pointer"
                    >
                      <p className="text-xs text-white leading-snug">{it.message}</p>
                      {typeof it.xp === "number" && it.xp > 0 ? (
                        <p className="text-xs text-indigo-400 mt-0.5">+{it.xp} XP</p>
                      ) : null}
                      {notifTimeLabel(it) ? (
                        <p className="text-[10px] text-gray-500 mt-1">{notifTimeLabel(it)}</p>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* User Avatar */}
            <div className="flex items-center gap-3 pl-4 border-l border-purple-500/20">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-white">{user.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Level {user.level}</span>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/50">
                    {user.rank}
                  </span>
                </div>
              </div>
              <Avatar className="w-10 h-10 border-2 border-purple-500/50 shadow-lg shadow-purple-500/30">
                <AvatarImage src={user.avatar} />
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                  SH
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}