import { useEffect, useState, useRef, useCallback, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { User, Bell, Lock, LogOut, CreditCard, ExternalLink } from "lucide-react";
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
  getBillingStatus,
  createBillingPortalSession,
  cancelBillingSubscription,
  resumeBillingSubscription,
  getBillingPaymentHistory,
  BILLING_UPDATED_EVENT,
  type BillingPaymentRow,
} from "../utils/api";
import { toast } from "sonner";

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [active, setActive] = useState<"profile" | "notifications" | "security" | "subscription">("profile");
  const [billingTier, setBillingTier] = useState<string>("free");
  const [billingStatus, setBillingStatus] = useState<string>("");
  const [billingPeriodEnd, setBillingPeriodEnd] = useState<string | null>(null);
  const [billingHasCustomer, setBillingHasCustomer] = useState(false);
  const [billingCancelAtPeriodEnd, setBillingCancelAtPeriodEnd] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [cancelSubOpen, setCancelSubOpen] = useState(false);
  const [cancelSubBusy, setCancelSubBusy] = useState(false);
  const [resumeSubBusy, setResumeSubBusy] = useState(false);
  const [paymentRows, setPaymentRows] = useState<BillingPaymentRow[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
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

  const billingTierNorm = (billingTier || "free").toLowerCase();
  const billingStatusNorm = (billingStatus || "").toLowerCase();

  const hasActivePaidSub =
    ["starter", "pro", "elite"].includes(billingTierNorm) &&
    ["active", "trialing", "past_due"].includes(billingStatusNorm);

  const canOpenBillingPortal =
    billingHasCustomer ||
    (["starter", "pro", "elite"].includes(billingTierNorm) &&
      ["active", "trialing", "past_due"].includes(billingStatusNorm));

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "subscription" || tab === "profile" || tab === "notifications" || tab === "security") {
      setActive(tab);
    }
  }, [searchParams]);

  const loadBilling = useCallback(async () => {
    try {
      const b = await getBillingStatus();
      setBillingTier(b.tier);
      setBillingStatus(b.subscriptionStatus || "");
      setBillingPeriodEnd(b.currentPeriodEnd);
      setBillingHasCustomer(b.hasStripeCustomer);
      setBillingCancelAtPeriodEnd(Boolean(b.cancelAtPeriodEnd));
    } catch {
      setBillingTier("free");
      setBillingStatus("");
      setBillingPeriodEnd(null);
      setBillingHasCustomer(false);
      setBillingCancelAtPeriodEnd(false);
    }
  }, []);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  const loadPaymentHistory = useCallback(async () => {
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      const { payments } = await getBillingPaymentHistory();
      setPaymentRows(payments);
    } catch (e) {
      setPaymentRows([]);
      setPaymentError(e instanceof Error ? e.message : "Could not load payments.");
    } finally {
      setPaymentLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active === "subscription") void loadPaymentHistory();
  }, [active, loadPaymentHistory]);

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
      // If username is still the default reset value, treat it as "not chosen yet"
      // so display name edits can auto-generate a better username.
      setUsernameAuto(String(u.username || "").trim() === "shadow_hunter");
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
    setUsernameAuto(String(s.username || "").trim() === "shadow_hunter");
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
              {(
                [
                  { id: "profile" as const, label: "Profile", Icon: User },
                  { id: "subscription" as const, label: "Subscription", Icon: CreditCard },
                  { id: "notifications" as const, label: "Notifications", Icon: Bell },
                  { id: "security" as const, label: "Security", Icon: Lock },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setActive(id);
                    const next = new URLSearchParams(searchParams);
                    next.set("tab", id);
                    setSearchParams(next, { replace: true });
                  }}
                  className={`grid w-full grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-3 px-4 py-3 rounded-lg text-left text-sm font-medium antialiased transition-colors ${
                    active === id
                      ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {/* Fixed 24px column: flex min-width:auto can crush some SVGs (e.g. Bell) to ~3px */}
                  <span className="flex h-6 w-full max-w-6 items-center justify-center text-current" aria-hidden>
                    <Icon size={18} className="block h-[18px] w-[18px] shrink-0 overflow-visible" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 leading-snug">{label}</span>
                </button>
              ))}
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
                        setUsernameAuto(cleaned.length === 0 || cleaned === "shadow_hunter");
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

          {active === "subscription" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="bg-[#111827] border-purple-500/20 p-6">
              <h2 className="text-xl font-bold text-white mb-2">Subscription</h2>
              <p className="text-sm text-gray-400 mb-6">
                Your plan controls feature access (for example Analytics on Pro and above). Payments run through Stripe.
              </p>

              <div className="space-y-8">
                {/* Current plan */}
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current plan</h3>
                  <div className="p-4 rounded-xl bg-white/5 border border-purple-500/20 space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <p className="text-2xl font-semibold text-white capitalize">{billingTier}</p>
                        {billingStatus ? (
                          <p className="text-sm text-gray-400 mt-1">Subscription status: {billingStatus}</p>
                        ) : (
                          <p className="text-sm text-gray-500 mt-1">No active Stripe subscription on file.</p>
                        )}
                      </div>
                      {billingCancelAtPeriodEnd && hasActivePaidSub ? (
                        <span className="text-xs font-medium px-2 py-1 rounded-md bg-amber-500/20 text-amber-200 border border-amber-500/40">
                          Cancels at period end
                        </span>
                      ) : null}
                    </div>
                    {billingPeriodEnd ? (
                      <p className="text-xs text-gray-500">
                        Current billing period ends{" "}
                        <span className="text-gray-300">
                          {new Date(billingPeriodEnd).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </p>
                    ) : null}
                    <p className="text-xs text-gray-600 pt-1 border-t border-purple-500/10">
                      Billing profile: {billingHasCustomer ? "Linked to Stripe" : "Not linked yet — subscribe once from Pricing."}
                    </p>
                  </div>
                </section>

                {/* Manage Billing: actions + payment history + portal */}
                <section className="space-y-4" aria-labelledby="manage-billing-heading">
                  <h3 id="manage-billing-heading" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Manage Billing
                  </h3>
                  <div className="p-4 rounded-xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 space-y-6">
                    <p className="text-sm text-gray-400">
                      View plans, open Stripe&apos;s customer portal for payment methods and invoices, and review your
                      payment history below.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                        onClick={() => navigate("/pricing")}
                      >
                        View plans
                      </Button>
                      {canOpenBillingPortal ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="border-purple-500/40 text-white hover:bg-white/10 bg-white/5"
                          disabled={portalBusy}
                          onClick={async () => {
                            setPortalBusy(true);
                            try {
                              const { url } = await createBillingPortalSession();
                              window.location.href = url;
                            } catch (e) {
                              setPortalBusy(false);
                              const msg = e instanceof Error ? e.message : "Could not open portal.";
                              toast.error(msg, { duration: 12000 });
                            }
                          }}
                        >
                          {portalBusy ? "Opening…" : "Open billing portal"}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="border-purple-500/20 text-gray-500 cursor-not-allowed opacity-70"
                          disabled
                          title="Subscribe from Pricing so we can link your Stripe customer."
                        >
                          Open billing portal
                        </Button>
                      )}
                      {hasActivePaidSub && !billingCancelAtPeriodEnd ? (
                        <AlertDialog open={cancelSubOpen} onOpenChange={setCancelSubOpen}>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="border-red-500/45 text-red-300 hover:bg-red-500/10"
                            >
                              Cancel subscription
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-[#111827] border-purple-500/30 text-white">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
                              <AlertDialogDescription className="text-gray-400">
                                You can stop renewal at the end of this billing period and keep paid features until then, or end
                                immediately and lose access right away (no automatic refund).
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:justify-end">
                              <AlertDialogCancel
                                className="border-purple-500/30 bg-transparent text-white hover:bg-white/10"
                                disabled={cancelSubBusy}
                              >
                                Keep subscription
                              </AlertDialogCancel>
                              <Button
                                type="button"
                                variant="outline"
                                className="border-purple-500/30 text-white"
                                disabled={cancelSubBusy}
                                onClick={async (e) => {
                                  e.preventDefault();
                                  setCancelSubBusy(true);
                                  try {
                                    await cancelBillingSubscription("period_end");
                                    toast.success("Renewal canceled. You keep access until the end of this billing period.");
                                    setCancelSubOpen(false);
                                    void loadBilling();
                                    void loadPaymentHistory();
                                    window.dispatchEvent(new CustomEvent(BILLING_UPDATED_EVENT));
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Could not cancel.");
                                  } finally {
                                    setCancelSubBusy(false);
                                  }
                                }}
                              >
                                {cancelSubBusy ? "Working…" : "End after this period"}
                              </Button>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700 text-white"
                                disabled={cancelSubBusy}
                                onClick={async (e) => {
                                  e.preventDefault();
                                  setCancelSubBusy(true);
                                  try {
                                    await cancelBillingSubscription("immediately");
                                    toast.success("Subscription ended.");
                                    setCancelSubOpen(false);
                                    void loadBilling();
                                    void loadPaymentHistory();
                                    window.dispatchEvent(new CustomEvent(BILLING_UPDATED_EVENT));
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Could not cancel.");
                                  } finally {
                                    setCancelSubBusy(false);
                                  }
                                }}
                              >
                                End immediately
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="border-gray-600 text-gray-500"
                          disabled
                          title={
                            !hasActivePaidSub
                              ? "Subscribe to a paid plan first."
                              : billingCancelAtPeriodEnd
                                ? "Already canceling at period end — use Resume renewal to keep the plan."
                                : undefined
                          }
                        >
                          Cancel subscription
                        </Button>
                      )}
                    </div>

                    {billingCancelAtPeriodEnd && hasActivePaidSub ? (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
                        <p className="text-sm text-amber-100">
                          Renewal is off; access continues until the end of this period.
                          {billingPeriodEnd
                            ? ` (${new Date(billingPeriodEnd).toLocaleDateString()})`
                            : null}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
                          disabled={resumeSubBusy}
                          onClick={async () => {
                            setResumeSubBusy(true);
                            try {
                              await resumeBillingSubscription();
                              toast.success("Subscription will keep renewing.");
                              void loadBilling();
                              window.dispatchEvent(new CustomEvent(BILLING_UPDATED_EVENT));
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Could not resume.");
                            } finally {
                              setResumeSubBusy(false);
                            }
                          }}
                        >
                          {resumeSubBusy ? "Updating…" : "Resume renewal"}
                        </Button>
                      </div>
                    ) : null}

                    <div className="space-y-3 pt-2 border-t border-purple-500/15">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payment history</h4>
                          <p className="text-xs text-gray-600 mt-1">
                            Successful charges and paid invoices for this account (from Stripe).
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-indigo-300 hover:text-white h-8 shrink-0"
                          disabled={paymentLoading}
                          onClick={() => void loadPaymentHistory()}
                        >
                          {paymentLoading ? "Refreshing…" : "Refresh"}
                        </Button>
                      </div>
                      {paymentError ? (
                        <p className="text-sm text-amber-400">{paymentError}</p>
                      ) : paymentLoading && paymentRows.length === 0 ? (
                        <p className="text-sm text-gray-500">Loading…</p>
                      ) : paymentRows.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          {billingHasCustomer
                            ? "No completed payments yet. After you subscribe, invoices appear here."
                            : "Subscribe once to create a billing profile; your payments will show here."}
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-purple-500/20 bg-[#0B0F1A]/40">
                          <table className="w-full text-sm text-left">
                            <thead>
                              <tr className="border-b border-purple-500/20 text-xs text-gray-500 uppercase tracking-wide">
                                <th className="px-3 py-2 font-medium">Date</th>
                                <th className="px-3 py-2 font-medium">Type</th>
                                <th className="px-3 py-2 font-medium">Description</th>
                                <th className="px-3 py-2 font-medium text-right">Amount</th>
                                <th className="px-3 py-2 font-medium">Receipt</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paymentRows.map((row) => {
                                const href = row.hostedInvoiceUrl || row.receiptUrl;
                                const amount = (row.amount / 100).toLocaleString(undefined, {
                                  style: "currency",
                                  currency: row.currency.toUpperCase(),
                                });
                                return (
                                  <tr
                                    key={`${row.source}-${row.id}`}
                                    className="border-b border-purple-500/10 text-gray-300 last:border-0"
                                  >
                                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-400">
                                      {new Date(row.created).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2.5 text-gray-500 text-xs capitalize whitespace-nowrap">
                                      {row.source === "invoice" ? "Invoice" : "Payment"}
                                    </td>
                                    <td className="px-3 py-2.5 max-w-[200px] sm:max-w-xs truncate" title={row.description}>
                                      {row.description}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-white font-medium tabular-nums">
                                      {amount}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      {href ? (
                                        <a
                                          href={href}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs"
                                        >
                                          View
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      ) : (
                                        <span className="text-gray-600 text-xs">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
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
