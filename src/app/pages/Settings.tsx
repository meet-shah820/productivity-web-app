import { useEffect, useState, useRef, useCallback, type ChangeEvent } from "react";
import { motion } from "motion/react";
import { User, Bell, Lock, LogOut } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import { Textarea } from "../components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import {
  changePassword,
  getSettings,
  resetAll,
  saveSettings,
  getProfile,
  patchProfile,
  PROFILE_UPDATED_EVENT,
} from "../utils/api";

export default function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileSnapshot = useRef<{
    displayName: string;
    username: string;
    email: string;
    bio: string;
    serverAvatar: string;
  } | null>(null);

  const [profileHandle, setProfileHandle] = useState("shadow_hunter");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [serverAvatar, setServerAvatar] = useState("");
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [active, setActive] = useState<"profile" | "notifications" | "security">("profile");
  const [notif, setNotif] = useState({
    questReminders: true,
    levelUp: true,
    achievementUnlocked: true,
    streakReminders: true,
    weeklySummary: false,
  });
  const [savingNotif, setSavingNotif] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  // If true, username will be auto-generated from display name until the user edits username directly.
  const [usernameAuto, setUsernameAuto] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getSettings();
        setNotif({ ...notif, ...(res.notifications || {}) });
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfileFields = useCallback(async () => {
    try {
      const p = await getProfile();
      const u = p.user;
      setProfileHandle(u.username);
      setDisplayName(u.displayName || "");
      setUsername(u.username);
      setUsernameAuto(!String(u.username || "").trim());
      setEmail(u.email || "");
      setBio(u.bio || "");
      setServerAvatar(u.avatarDataUrl || "");
      setLocalAvatar(null);
      setAvatarRemoved(false);
      setProfileMsg(null);
      profileSnapshot.current = {
        displayName: u.displayName || "",
        username: u.username,
        email: u.email || "",
        bio: u.bio || "",
        serverAvatar: u.avatarDataUrl || "",
      };
    } catch {
      setProfileMsg("Could not load profile.");
    }
  }, []);

  const toUsernameFromDisplayName = (name: string) => {
    const base = String(name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32);
    if (base.length >= 3) return base;
    return "shadow_hunter";
  };

  useEffect(() => {
    void loadProfileFields();
  }, [loadProfileFields]);

  useEffect(() => {
    const refresh = () => {
      void loadProfileFields();
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, refresh);
  }, [loadProfileFields]);

  const avatarDisplaySrc = avatarRemoved && !localAvatar ? "" : localAvatar || serverAvatar;
  const avatarInitials = (() => {
    const d = displayName.trim();
    const base = d || username.replace(/_/g, " ");
    const parts = base.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (base.replace(/[^a-z0-9]/gi, "").slice(0, 2) || "SH").toUpperCase();
  })();

  const handleAvatarFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\/(jpeg|png|gif)$/i.test(f.type)) {
      setProfileMsg("Use JPG, PNG, or GIF.");
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setProfileMsg("Max file size is 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLocalAvatar(reader.result as string);
      setAvatarRemoved(false);
      setProfileMsg(null);
    };
    reader.readAsDataURL(f);
  };

  const handleSaveProfile = async () => {
    setProfileMsg(null);
    const u = username.trim();
    if (u.length < 3 || u.length > 32) {
      setProfileMsg("Username must be 3–32 characters.");
      return;
    }
    setProfileSaving(true);
    try {
      const payload: Parameters<typeof patchProfile>[0] = {
        username: u,
        displayName: displayName.trim(),
        email: email.trim(),
        bio: bio.trim(),
      };
      if (avatarRemoved) payload.clearAvatar = true;
      else if (localAvatar) payload.avatarDataUrl = localAvatar;

      const res = await patchProfile(payload);
      localStorage.setItem("last_username", res.user.username);
      setProfileHandle(res.user.username);
      setServerAvatar(res.user.avatarDataUrl || "");
      setLocalAvatar(null);
      setAvatarRemoved(false);
      profileSnapshot.current = {
        displayName: res.user.displayName || "",
        username: res.user.username,
        email: res.user.email || "",
        bio: res.user.bio || "",
        serverAvatar: res.user.avatarDataUrl || "",
      };
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT));
      setProfileMsg("Saved.");
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCancelProfile = () => {
    setProfileMsg(null);
    const s = profileSnapshot.current;
    if (!s) return;
    setDisplayName(s.displayName);
    setUsername(s.username);
    setUsernameAuto(!String(s.username || "").trim());
    setEmail(s.email);
    setBio(s.bio);
    setServerAvatar(s.serverAvatar);
    setLocalAvatar(null);
    setAvatarRemoved(false);
    setProfileHandle(s.username);
  };

  const handleSaveNotif = async () => {
    setSavingNotif(true);
    try {
      await saveSettings({ notifications: notif });
    } finally {
      setSavingNotif(false);
    }
  };

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (!pw.current || !pw.next || !pw.confirm) {
      setPwMsg("Fill all password fields.");
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwMsg("New password and confirm do not match.");
      return;
    }
    const username = profileHandle || localStorage.getItem("last_username") || "shadow_hunter";
    setPwSaving(true);
    try {
      await changePassword({ username, currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg("Password updated.");
    } catch {
      setPwMsg("Password update failed.");
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="min-h-full p-4 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400">Manage your account and preferences</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-[#111827] border-purple-500/20 p-4">
            <nav className="space-y-1">
              <button
                onClick={() => setActive("profile")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  active === "profile"
                    ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <User className="w-5 h-5" />
                <span className="text-sm font-medium">Profile</span>
              </button>
              <button
                onClick={() => setActive("notifications")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  active === "notifications"
                    ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Bell className="w-5 h-5" />
                <span className="text-sm font-medium">Notifications</span>
              </button>
              <button
                onClick={() => setActive("security")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  active === "security"
                    ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Lock className="w-5 h-5" />
                <span className="text-sm font-medium">Security</span>
              </button>
            </nav>
          </Card>
        </motion.div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Profile Settings */}
          {active === "profile" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-[#111827] border-purple-500/20 p-6">
              <h2 className="text-xl font-bold text-white mb-6">Profile Settings</h2>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif"
                className="hidden"
                onChange={handleAvatarFile}
              />

              {/* Avatar */}
              <div className="flex flex-wrap items-center gap-6 mb-6">
                <Avatar className="w-24 h-24 border-4 border-purple-500/50">
                  <AvatarImage src={avatarDisplaySrc || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-2xl">
                    {avatarInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-purple-500/30 text-white hover:bg-white/5"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Change Avatar
                    </Button>
                    {(serverAvatar || localAvatar) && !avatarRemoved && (
                      <Button
                        type="button"
                        variant="outline"
                        className="border-red-500/40 text-red-300 hover:bg-red-500/10"
                        onClick={() => {
                          setLocalAvatar(null);
                          setAvatarRemoved(true);
                          setProfileMsg(null);
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">JPG, PNG or GIF. Max size of 2MB</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      value={displayName}
                      onChange={(e) => {
                        const next = e.target.value;
                        setDisplayName(next);
                        if (usernameAuto) {
                          setUsername(toUsernameFromDisplayName(next));
                        }
                      }}
                      placeholder="How your name appears in the app"
                      maxLength={64}
                      className="bg-[#1F2937] border-purple-500/30 text-white placeholder:text-gray-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => {
                        const cleaned = e.target.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
                        setUsername(cleaned);
                        // If the user clears username, resume auto-generation from display name.
                        setUsernameAuto(cleaned.length === 0);
                      }}
                      placeholder="shadow_hunter"
                      maxLength={32}
                      className="bg-[#1F2937] border-purple-500/30 text-white placeholder:text-gray-500"
                    />
                    <p className="text-xs text-gray-500">Letters, numbers, underscores only (3–32).</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="bg-[#1F2937] border-purple-500/30 text-white placeholder:text-gray-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Short intro visible on your profile"
                    maxLength={500}
                    rows={4}
                    className="bg-[#1F2937] border-purple-500/30 text-white placeholder:text-gray-500 min-h-[100px]"
                  />
                  <p className="text-xs text-gray-500 text-right">{bio.length}/500</p>
                </div>

                {profileMsg && (
                  <p className={`text-sm ${profileMsg === "Saved." ? "text-green-400" : "text-amber-400"}`}>
                    {profileMsg}
                  </p>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-purple-500/30 text-white hover:bg-white/5"
                    onClick={handleCancelProfile}
                    disabled={profileSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                    onClick={handleSaveProfile}
                    disabled={profileSaving}
                  >
                    {profileSaving ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
          )}

          {/* Notification Settings */}
          {active === "notifications" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-[#111827] border-purple-500/20 p-6">
              <h2 className="text-xl font-bold text-white mb-6">
                Notification Preferences
              </h2>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-white mb-1">
                      Quest Reminders
                    </h3>
                    <p className="text-xs text-gray-400">
                      Get notified about incomplete daily quests
                    </p>
                  </div>
                  <Switch checked={notif.questReminders} onCheckedChange={(v) => setNotif({ ...notif, questReminders: v })} />
                </div>

                <Separator className="bg-purple-500/20" />

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-white mb-1">
                      Level Up Notifications
                    </h3>
                    <p className="text-xs text-gray-400">
                      Celebrate when you reach a new level
                    </p>
                  </div>
                  <Switch checked={notif.levelUp} onCheckedChange={(v) => setNotif({ ...notif, levelUp: v })} />
                </div>

                <Separator className="bg-purple-500/20" />

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-white mb-1">
                      Achievement Unlocked
                    </h3>
                    <p className="text-xs text-gray-400">
                      Get notified when you unlock achievements
                    </p>
                  </div>
                  <Switch checked={notif.achievementUnlocked} onCheckedChange={(v) => setNotif({ ...notif, achievementUnlocked: v })} />
                </div>

                <Separator className="bg-purple-500/20" />

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-white mb-1">
                      Streak Reminders
                    </h3>
                    <p className="text-xs text-gray-400">
                      Daily reminder to maintain your streak
                    </p>
                  </div>
                  <Switch checked={notif.streakReminders} onCheckedChange={(v) => setNotif({ ...notif, streakReminders: v })} />
                </div>

                <Separator className="bg-purple-500/20" />

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-white mb-1">
                      Weekly Summary
                    </h3>
                    <p className="text-xs text-gray-400">
                      Receive a weekly progress summary
                    </p>
                  </div>
                  <Switch checked={notif.weeklySummary} onCheckedChange={(v) => setNotif({ ...notif, weeklySummary: v })} />
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSaveNotif}
                    disabled={savingNotif}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-80"
                  >
                    {savingNotif ? "Saving..." : "Save Preferences"}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
          )}

          {/* Security */}
          {active === "security" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-[#111827] border-purple-500/20 p-6">
              <h2 className="text-xl font-bold text-white mb-6">Security</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current">Current Password</Label>
                  <Input id="current" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} className="bg-[#1F2937] border-purple-500/30 text-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new">New Password</Label>
                  <Input id="new" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} className="bg-[#1F2937] border-purple-500/30 text-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm Password</Label>
                  <Input id="confirm" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className="bg-[#1F2937] border-purple-500/30 text-white" />
                </div>
                {pwMsg && <p className="text-sm text-gray-400">{pwMsg}</p>}
                <div className="flex justify-end">
                  <Button onClick={handleChangePassword} disabled={pwSaving} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-80">
                    {pwSaving ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
          )}

          {/* Danger Zone */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/30 p-6">
              <h2 className="text-xl font-bold text-red-400 mb-6">Danger Zone</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-black/20 border border-red-500/20">
                  <div>
                    <h3 className="text-sm font-medium text-white mb-1">
                      Reset All Progress
                    </h3>
                    <p className="text-xs text-gray-400">
                      Permanently delete all your data and start over
                    </p>
                  </div>
                  <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                        onClick={() => {
                          setResetError(null);
                        }}
                      >
                        Reset
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset all progress?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete your goals, quests, streaks, and history. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      {resetError && (
                        <p className="text-sm text-red-400">
                          {resetError}
                        </p>
                      )}
                      <AlertDialogFooter>
                        <AlertDialogCancel
                          disabled={resetBusy}
                          onClick={() => setResetError(null)}
                        >
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          disabled={resetBusy}
                          className="bg-red-600 hover:bg-red-700"
                          onClick={async (e) => {
                            // Prevent Radix from auto-closing while we run the async reset.
                            e.preventDefault();
                            setResetBusy(true);
                            setResetError(null);
                            try {
                              await resetAll();
                              window.location.reload();
                            } catch (err) {
                              setResetError(err instanceof Error ? err.message : "Reset failed. Please try again.");
                              setResetBusy(false);
                            }
                          }}
                        >
                          {resetBusy ? "Resetting..." : "Yes, reset"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-black/20 border border-red-500/20">
                  <div>
                    <h3 className="text-sm font-medium text-white mb-1">
                      Delete Account
                    </h3>
                    <p className="text-xs text-gray-400">
                      Permanently delete your account and all data
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Logout */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Button
              variant="outline"
              className="w-full border-purple-500/30 text-white hover:bg-white/5"
              onClick={() => {
                localStorage.removeItem("auth_token");
                window.location.href = "/auth";
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Log Out
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
