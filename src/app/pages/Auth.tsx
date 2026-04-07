import { useState } from "react";
import { motion } from "motion/react";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

const API_BASE = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE) || "";

async function postJson(path: string, body: any) {
	const res = await fetch(`${API_BASE}${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		throw new Error("request failed");
	}
	return res.json();
}

export default function Auth() {
	const [mode, setMode] = useState<"login" | "signup">("login");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const googleStartUrl = `${API_BASE}/api/auth/google`;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!username.trim() || !password) {
			setError("Username and password are required");
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const res = await postJson(`/api/auth/${mode}`, { username, password });
			localStorage.setItem("auth_token", res.token);
      localStorage.setItem("last_username", username);
			window.location.href = "/";
		} catch {
			setError("Authentication failed");
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
							placeholder="Password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="bg-[#0B0F1A] border-purple-500/30 text-white"
							name="password"
							autoComplete={mode === "login" ? "current-password" : "new-password"}
							required
							minLength={6}
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
					</form>
				</Card>
			</motion.div>
		</div>
	);
}

