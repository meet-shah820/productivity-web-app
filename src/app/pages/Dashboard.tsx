import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  Swords,
  Brain,
  Shield,
  Target,
  Flame,
  TrendingUp,
  Check,
  Clock,
  Award,
  Calendar,
} from "lucide-react";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { getDashboard, getRecentHistory, completeQuest, revertQuest, getStreakCalendar, PROFILE_UPDATED_EVENT, RANK_UPDATED_EVENT } from "../utils/api";

/** Focus hours from API are decimal hours; display with lowercase unit `h` (e.g. 3.5h). */
function formatFocusHours(hours: number): string {
  if (!hours || hours <= 0) return "0h";
  const rounded = Math.round(hours * 10) / 10;
  const s = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
  return `${s}h`;
}

function ymd(d: Date): string {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, delta: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightLevel = searchParams.get("highlightLevel");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    user: {
      username: string;
      displayName?: string;
      avatarDataUrl?: string;
      level: number;
      xp: number;
      nextLevelXp: number;
      stats: any;
      streak: number;
      rank?: string;
    };
    quests: { id: string; title: string; xp: number; isCompleted: boolean; statType: string }[];
    progress: { completed: number; total: number };
    todayProgress?: {
      quests: { completed: number; total: number; percent: number };
      focus: { hours: number; targetHours: number; percentOfTarget: number };
      xp: { gainedToday: number; vsYesterdayPercent: number | null };
    };
  } | null>(null);

  const [activities, setActivities] = useState<
    { id: string; type: "quest" | "level" | "achievement" | "focus"; message: string; xp?: number; at: string }[]
  >([]);

  const [streakCard, setStreakCard] = useState<{ current: number; best: number; daysThisWeek: boolean[] }>({
    current: 0,
    best: 0,
    daysThisWeek: [false, false, false, false, false, false, false],
  });

  const [leveledUp, setLeveledUp] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadDashboard() {
      try {
        const res = await getDashboard();
        if (mounted) {
          setData(res);
          setError(null);
        }
      } catch (e) {
        if (mounted) setError("Failed to load dashboard");
      } finally {
        if (mounted) setLoading(false);
      }
      // Streak card should align with streak calendar: compute current/best + this week's completion flags.
      try {
        const now = new Date();
        const weekStart = startOfWeekMonday(now);
        const weekEnd = addDays(weekStart, 6);
        const sc = await getStreakCalendar(ymd(weekStart), ymd(weekEnd));
        const map = new Map((sc.days || []).map((d) => [d.date, !!d.hasCompletion]));
        const daysThisWeek = Array.from({ length: 7 }, (_, i) => map.get(ymd(addDays(weekStart, i))) === true);
        if (mounted) {
          setStreakCard({
            current: sc.currentStreak?.length ?? 0,
            best: sc.longestStreak?.length ?? 0,
            daysThisWeek,
          });
        }
      } catch {
        // ignore streak card failures; keep defaults
      }
      try {
        const hist = await getRecentHistory();
        if (mounted) setActivities(hist.items || []);
      } catch {
        if (mounted) setActivities([]);
      }
    }
    void loadDashboard();
    const onProfileUpdated = () => {
      void loadDashboard();
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
    return () => {
      mounted = false;
      window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
    };
  }, []);

  useEffect(() => {
    if (highlightLevel !== "1") return;
    const scrollTimer = window.setTimeout(() => {
      document.getElementById("dashboard-level-highlight")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);
    const clearHighlight = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete("highlightLevel");
          return n;
        },
        { replace: true }
      );
    }, 6000);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearHighlight);
    };
  }, [highlightLevel, setSearchParams]);

  const user = useMemo(() => {
    if (!data) {
      return {
        name: "Player",
        avatar: "",
        level: 1,
        currentXP: 0,
        maxXP: 100,
        rank: "E",
        title: "The System's Chosen",
      };
    }
    const dn = String(data.user.displayName || "").trim();
    return {
      name: dn || "Player",
      avatar: data.user.avatarDataUrl || "",
      level: data.user.level,
      currentXP: data.user.xp,
      maxXP: data.user.nextLevelXp,
      rank: data.user.rank ?? "E",
      title: "The System's Chosen",
    };
  }, [data]);

  const stats = useMemo(() => {
    const s = data?.user.stats || {};
    return [
      {
        name: "Strength",
        icon: Swords,
        value: s.strength ?? 0,
        max: 100,
        color: "from-red-500 to-orange-500",
        glow: "shadow-red-500/50",
      },
      {
        name: "Intelligence",
        icon: Brain,
        value: s.intelligence ?? 0,
        max: 100,
        color: "from-blue-500 to-cyan-500",
        glow: "shadow-blue-500/50",
      },
      {
        name: "Agility",
        icon: Shield,
        value: s.agility ?? 0,
        max: 100,
        color: "from-purple-500 to-pink-500",
        glow: "shadow-purple-500/50",
      },
      {
        name: "Vitality",
        icon: Target,
        value: s.vitality ?? 0,
        max: 100,
        color: "from-green-500 to-emerald-500",
        glow: "shadow-green-500/50",
      },
    ];
  }, [data]);

  const dailyQuests = data?.quests || [];

  const todayProgress = useMemo(() => {
    const tp = data?.todayProgress;
    const completed = tp?.quests.completed ?? data?.progress.completed ?? 0;
    const total = tp?.quests.total ?? data?.progress.total ?? 0;
    const questPercent = tp?.quests.percent ?? (total > 0 ? Math.round((completed / total) * 100) : 0);
    const focusHours = tp?.focus.hours ?? 0;
    const focusPercent = tp?.focus.percentOfTarget ?? 0;
    const xpGained = tp?.xp.gainedToday ?? 0;
    const xpVsY = tp?.xp.vsYesterdayPercent ?? null;
    const xpPercentLabel = xpVsY === null ? "—" : `${xpVsY > 0 ? "+" : ""}${xpVsY}%`;
    return {
      questLabel: `${completed}/${total}`,
      questPercent,
      focusLabel: formatFocusHours(focusHours),
      focusPercent,
      xpLabel: `${xpGained.toLocaleString()} XP`,
      xpPercentLabel,
    };
  }, [data]);

  async function handleComplete(questId: string) {
    try {
      const resp = await completeQuest(questId);
      if (resp.leveledUp) {
        setLeveledUp(true);
        setTimeout(() => setLeveledUp(false), 1800);
      }
      // refresh dashboard data
      const fresh = await getDashboard();
      setData(fresh);
      window.dispatchEvent(new CustomEvent(RANK_UPDATED_EVENT));
      try {
        const hist = await getRecentHistory();
        setActivities(hist.items || []);
      } catch {
        setActivities([]);
      }
    } catch {
      // no-op for now
    }
  }

  async function handleUndo(questId: string) {
    try {
      await revertQuest(questId);
      const fresh = await getDashboard();
      setData(fresh);
      // Refresh header XP + notifications (Layout listens to this event)
      window.dispatchEvent(new CustomEvent(RANK_UPDATED_EVENT));
      try {
        const hist = await getRecentHistory();
        setActivities(hist.items || []);
      } catch {
        setActivities([]);
      }
    } catch {}
  }

  return (
    <div className="min-h-full p-4 lg:p-8 space-y-6">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-3xl lg:text-4xl font-bold text-white">
          Welcome back, <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">{user.name}</span>
        </h1>
        <p className="text-gray-400">Continue your journey to greatness</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Profile Card */}
          <motion.div
            id="dashboard-level-highlight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={
              highlightLevel === "1"
                ? "rounded-2xl ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0B0F1A] shadow-lg shadow-amber-500/20"
                : ""
            }
          >
            <Card className="bg-gradient-to-br from-[#111827] to-[#1F2937] border-purple-500/30 shadow-2xl shadow-purple-500/20 overflow-hidden relative">
              {/* Background effects */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />

              <div className="relative z-10 p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <Avatar className="w-24 h-24 border-4 border-purple-500/50 shadow-2xl shadow-purple-500/50">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-2xl">
                      SH
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-2xl font-bold text-white">{user.name}</h2>
                        <span className="px-3 py-1 rounded-lg text-sm font-bold bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/50">
                          Rank {user.rank}
                        </span>
                      </div>
                      <p className="text-sm text-purple-400">{user.title}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Level {user.level}</span>
                        <span className="text-sm text-indigo-400 font-medium">
                          {user.currentXP.toLocaleString()} / {user.maxXP.toLocaleString()} XP
                        </span>
                      </div>
                      <div className="h-3 bg-black/40 rounded-full overflow-hidden backdrop-blur-sm border border-purple-500/30">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(user.currentXP / user.maxXP) * 100}%` }}
                          transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full relative"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-white/30 to-transparent animate-pulse" />
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
              >
                <Card className="bg-[#111827] border-purple-500/20 hover:border-purple-500/40 transition-all hover:shadow-xl hover:shadow-purple-500/20 group">
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg ${stat.glow}`}>
                          <stat.icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-sm text-gray-400">{stat.name}</h3>
                          <p className="text-2xl font-bold text-white">{stat.value}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-purple-500/20">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(stat.value / stat.max) * 100}%` }}
                          transition={{ duration: 1, ease: "easeOut", delay: 0.3 + index * 0.1 }}
                          className={`h-full bg-gradient-to-r ${stat.color} rounded-full`}
                        />
                      </div>
                      <p className="text-xs text-gray-500 text-right">{stat.value}/{stat.max}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Daily Quests */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="bg-[#111827] border-purple-500/20 shadow-xl shadow-purple-500/10">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">Daily Quests</h2>
                  <span className="text-sm text-gray-400">
                    {dailyQuests.filter((q) => q.isCompleted).length}/{dailyQuests.length} Completed
                  </span>
                </div>

                <div className="space-y-3">
                  {dailyQuests.map((quest: any, index: number) => (
                    <motion.div
                      key={quest.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + index * 0.1 }}
                      className={`p-4 rounded-xl border transition-all ${
                        quest.isCompleted
                          ? "bg-green-500/10 border-green-500/30"
                          : "bg-white/5 border-purple-500/20 hover:border-purple-500/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                              quest.isCompleted
                                ? "bg-green-500 border-green-500"
                                : "border-purple-500/50 hover:border-purple-500"
                            }`}
                            onClick={() => !quest.isCompleted && handleComplete(quest.id)}
                          >
                            {quest.isCompleted && <Check className="w-4 h-4 text-white" />}
                          </div>
                          <div className="flex-1">
                            <p className={`font-medium ${quest.isCompleted ? "text-gray-400 line-through" : "text-white"}`}>
                              {quest.title}
                            </p>
                            <p className="text-xs text-gray-500 uppercase">{quest.statType}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {quest.isCompleted && (
                            <Button size="sm" variant="outline" className="border-purple-500/30 text-white hover:bg-white/5"
                              onClick={() => handleUndo(quest.id)}>
                              Undo
                            </Button>
                          )}
                          <span className="text-sm font-bold text-indigo-400">+{quest.xp} XP</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Streak Tracker */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-gradient-to-br from-orange-500/20 to-red-500/20 border-orange-500/30 shadow-xl shadow-orange-500/20">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Streak</h3>
                  <Flame className="w-6 h-6 text-orange-500" />
                </div>
                <div className="text-center py-4">
                  <p className="text-5xl font-bold text-white mb-2">{streakCard.current}</p>
                  <p className="text-sm text-gray-400">Days in a row</p>
                  <p className="text-xs text-orange-400 mt-2">Best: {streakCard.best} days</p>
                </div>
                <div className="flex justify-between gap-1 mt-4">
                  {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                    <div key={index} className="flex-1 text-center">
                      <p className="text-xs text-gray-500 mb-1">{day}</p>
                      <div
                        className={`h-2 rounded-full ${
                          streakCard.daysThisWeek[index]
                            ? "bg-gradient-to-r from-orange-500 to-red-500"
                            : "bg-white/10"
                        }`}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-center">
                  <Button
                    size="sm"
                    className="bg-white/10 hover:bg-white/20 border border-white/10"
                    onClick={() => navigate("/streak")}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    View Calendar
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-[#111827] border-purple-500/20">
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-bold text-white mb-4">Today's Progress</h3>

                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Quests</p>
                      <p className="text-lg font-bold text-white">{todayProgress.questLabel}</p>
                    </div>
                  </div>
                  <span className="text-xs text-cyan-400">{todayProgress.questPercent}%</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Focus Time</p>
                      <p className="text-lg font-bold text-white">{todayProgress.focusLabel}</p>
                    </div>
                  </div>
                  <span className="text-xs text-pink-400">{todayProgress.focusPercent}%</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">XP Gained</p>
                      <p className="text-lg font-bold text-white">{todayProgress.xpLabel}</p>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-400">{todayProgress.xpPercentLabel}</span>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Activity Feed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-[#111827] border-purple-500/20">
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {activities.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2 text-center">
                      No recent activity yet. Complete a quest, focus session, or unlock an achievement to see it here.
                    </p>
                  ) : (
                    activities.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          {activity.type === "quest" && <Target className="w-4 h-4 text-white" />}
                          {activity.type === "level" && <TrendingUp className="w-4 h-4 text-white" />}
                          {activity.type === "achievement" && <Award className="w-4 h-4 text-white" />}
                          {activity.type === "focus" && <Clock className="w-4 h-4 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white">{activity.message}</p>
                          {typeof activity.xp === "number" && activity.xp > 0 ? (
                            <p className="text-xs text-indigo-400">+{activity.xp.toLocaleString()} XP</p>
                          ) : null}
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDistanceToNow(new Date(activity.at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
      {leveledUp && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center bg-black/70 z-50"
        >
          <div className="px-8 py-6 rounded-2xl border border-purple-500/40 bg-gradient-to-br from-[#111827] to-[#1F2937] text-center shadow-2xl shadow-purple-500/30">
            <p className="text-purple-400 font-bold text-sm">System Message</p>
            <h3 className="text-3xl font-extrabold text-white mt-1">Level Up!</h3>
            <p className="text-gray-400 mt-1">You have advanced to Level {user.level}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}