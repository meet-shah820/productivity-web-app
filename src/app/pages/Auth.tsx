import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { consumeAuthReturnPath, rememberAuthReturnPathFromSearch } from "../utils/authRedirect";

const API_BASE = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE) || "";

async function postJson(path: string, body?: unknown) {
	const res = await fetch(`${API_BASE}${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
	let data: Record<string, unknown> = {};
	try {
		data = (await res.json()) as Record<string, unknown>;
	} catch {
		/* non-JSON */
	}
	if (!res.ok) {
		const msg = typeof data.error === "string" ? data.error : "request failed";
		throw new Error(msg);
	}
	return data;
}

export default function Auth() {
	const [searchParams] = useSearchParams();

	useEffect(() => {
		rememberAuthReturnPathFromSearch(searchParams);
	}, [searchParams]);

	const [mode, setMode] = useState<"login" | "signup">("login");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const googleStartUrl = `${API_BASE}/api/auth/google`;

	const finishAuth = (token: string, nameForStorage: string) => {
		localStorage.setItem("auth_token", token);
		localStorage.setItem("last_username", nameForStorage);
		const next = consumeAuthReturnPath() || "/";
		window.location.href = next;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!username.trim()) {
			setError("Username is required");
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const res = (await postJson(`/api/auth/${mode}`, { username, password })) as { token?: string };
			if (!res.token) throw new Error("Missing token");
			finishAuth(res.token, username.trim());
		} catch (err) {
			setError(err instanceof Error ? err.message : "Authentication failed");
		} finally {
			setLoading(false);
		}
	};

	const handleGuestSignup = async () => {
		setLoading(true);
		setError(null);
		try {
			const res = (await postJson("/api/auth/guest-signup", {})) as { token?: string; username?: string };
			if (!res.token) throw new Error("Missing token");
			finishAuth(res.token, res.username || "guest");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not start as guest");
		} finally {
			setLoading(false);
		}
	};

	const handleGuestLogin = async () => {
		const existing = localStorage.getItem("auth_token");
		if (!existing) {
			setError("No saved guest session in this browser. Use Guest sign up first.");
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(`${API_BASE}/api/auth/guest-login`, {
				method: "POST",
				headers: { Authorization: `Bearer ${existing}` },
			});
			const data = (await res.json().catch(() => ({}))) as { token?: string; username?: string; error?: string };
			if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Guest session invalid");
			if (!data.token) throw new Error("Missing token");
			finishAuth(data.token, data.username || localStorage.getItem("last_username") || "guest");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not restore guest session");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-[#0B0F1A] relative overflow-hidden p-4">
			<div className="absolute -top-20 -left-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
			<div className="absolute -bottom-20 -right-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
			<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
				<Card className="bg-gradient-to-br from-[#111827] to-[#1F2937] border-purple-500/30 p-8">
					<h1 className="text-2xl font-bold text-white mb-2 text-center">LevelUp</h1>
					<p className="text-gray-400 text-center mb-6">Enter the Gate and begin your ascent</p>
					<div className="flex justify-center gap-2 mb-6">
						<Button variant={mode === "login" ? "default" : "outline"} className={mode === "login" ? "bg-gradient-to-r from-indigo-500 to-purple-500" : "border-purple-500/30 text-white hover:bg-white/5"} onClick={() => setMode("login")}>
							Login
						</Button>
						<Button variant={mode === "signup" ? "default" : "outline"} className={mode === "signup" ? "bg-gradient-to-r from-indigo-500 to-purple-500" : "border-purple-500/30 text-white hover:bg-white/5"} onClick={() => setMode("signup")}>
							Sign Up
						</Button>
					</div>
					<form onSubmit={handleSubmit} className="space-y-4">
						<Input
							placeholder="Username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							className="bg-[#0B0F1A] border-purple-500/30 text-white"
							name="username"
							autoComplete={mode === "login" ? "username" : "username"}
							required
						/>
						<Input
							type="password"
							placeholder="Password (any length)"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="bg-[#0B0F1A] border-purple-500/30 text-white"
							name="password"
							autoComplete={mode === "login" ? "current-password" : "new-password"}
						/>
						{error && <p className="text-sm text-red-400">{error}</p>}
						<Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-indigo-500 to-purple-500">
							{loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
						</Button>
						<div className="relative py-2">
							<div className="absolute inset-0 flex items-center">
								<div className="w-full border-t border-purple-500/20" />
							</div>
							<div className="relative flex justify-center text-xs">
								<span className="bg-gradient-to-br from-[#111827] to-[#1F2937] px-2 text-gray-400">or</span>
							</div>
						</div>
						<Button
							type="button"
							variant="outline"
							className="w-full border-purple-500/30 text-white hover:bg-white/5"
							onClick={() => {
								window.location.href = googleStartUrl;
							}}
						>
							Continue with Google
						</Button>
						<div className="relative py-2">
							<div className="absolute inset-0 flex items-center">
								<div className="w-full border-t border-purple-500/20" />
							</div>
							<div className="relative flex justify-center text-xs">
								<span className="bg-gradient-to-br from-[#111827] to-[#1F2937] px-2 text-gray-400">guest</span>
							</div>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
							<Button
								type="button"
								variant="outline"
								disabled={loading}
								className="border-purple-500/30 text-white hover:bg-white/5"
								onClick={() => void handleGuestSignup()}
							>
								Guest sign up
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={loading}
								className="border-purple-500/30 text-white hover:bg-white/5"
								onClick={() => void handleGuestLogin()}
							>
								Guest login
							</Button>
						</div>
						<p className="text-xs text-gray-500 text-center">
							Guest sign up creates a new trial profile. Guest login continues the last guest session on this device.
						</p>
					</form>
				</Card>
			</motion.div>
		</div>
	);
}

