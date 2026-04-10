import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "../components/ui/card";
import { motion } from "motion/react";
import { getLeaderboard, getLeaderboardWebSocketUrl, type LeaderboardEntry, type LeaderboardResponse } from "../utils/api";
import { Radio, Trophy } from "lucide-react";

function formatXp(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
	return String(Math.round(n));
}

function rowAccent(position: number): string {
	if (position === 1) return "border-amber-400/40 bg-amber-500/10";
	if (position === 2) return "border-slate-300/30 bg-slate-400/10";
	if (position === 3) return "border-amber-700/40 bg-amber-800/15";
	return "border-purple-500/15 bg-white/[0.03]";
}

export default function Leaderboard() {
	const [data, setData] = useState<LeaderboardResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [live, setLive] = useState(false);
	const listRef = useRef<HTMLUListElement>(null);
	const scrolledForUserIdRef = useRef<string | null>(null);

	const load = useCallback(async () => {
		try {
			setError(null);
			const res = await getLeaderboard(50);
			setData(res);
		} catch {
			setError("Failed to load leaderboard");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		const url = getLeaderboardWebSocketUrl();
		if (!url) return;

		let ws: WebSocket | null = null;
		let cancelled = false;

		function connect() {
			if (cancelled) return;
			try {
				ws = new WebSocket(url);
			} catch {
				setLive(false);
				return;
			}

			ws.onopen = () => setLive(true);
			ws.onclose = () => setLive(false);
			ws.onerror = () => setLive(false);
			ws.onmessage = (ev) => {
				try {
					const msg = JSON.parse(String(ev.data)) as { type?: string };
					if (msg.type === "leaderboard_updated") void load();
				} catch {
					/* ignore */
				}
			};
		}

		connect();

		return () => {
			cancelled = true;
			if (ws && ws.readyState === WebSocket.OPEN) ws.close();
			else if (ws) ws.close();
			setLive(false);
		};
	}, [load]);

	const yourId = data?.yourRank?.userId;

	useEffect(() => {
		if (!data?.entries?.length || !yourId) return;
		const inList = data.entries.some((e) => e.userId === yourId);
		if (!inList) {
			scrolledForUserIdRef.current = null;
			return;
		}
		if (scrolledForUserIdRef.current === yourId) return;
		const row = listRef.current?.querySelector<HTMLElement>('[data-current-user="true"]');
		row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
		scrolledForUserIdRef.current = yourId;
	}, [data, yourId]);

	return (
		<div className="min-h-full p-4 md:p-8 max-w-4xl mx-auto">
			<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
				<div className="flex flex-wrap items-center gap-3 mb-2">
					<Trophy className="w-8 h-8 text-amber-400" aria-hidden />
					<h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Leaderboard</h1>
					<span
						className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
							live ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" : "border-white/10 text-white/45 bg-white/5"
						}`}
						title={live ? "Connected — rankings refresh when anyone earns XP or changes rank" : "Reconnecting…"}
					>
						<Radio className={`w-3.5 h-3.5 ${live ? "text-emerald-400" : ""}`} />
						{live ? "Live" : "Offline"}
					</span>
				</div>
				<p className="text-white/55 text-sm md:text-base max-w-2xl">
					Rankings use total XP, then Hunter rank, level, and stat points. When any signed-in player updates progress, this list refreshes
					automatically for everyone connected.
				</p>
			</motion.div>

			{data?.yourRank && (
				<Card className="mb-6 p-4 border border-indigo-500/25 bg-indigo-500/5">
					<p className="text-xs uppercase tracking-wider text-indigo-300/80 mb-1">Your standing</p>
					<p className="text-white text-lg">
						<span className="font-semibold text-indigo-200">#{data.yourRank.position}</span>
						<span className="text-white/50"> / {data.totalUsers}</span>
						<span className="text-white/60"> · {data.yourRank.displayName}</span>
					</p>
					<p className="text-sm text-white/45 mt-1">
						Level {data.yourRank.level} · Rank {data.yourRank.rank} · {formatXp(data.yourRank.xp)} XP · {data.yourRank.statSum} stat pts
					</p>
				</Card>
			)}

			{loading && !data && (
				<p className="text-white/50" role="status">
					Loading rankings…
				</p>
			)}
			{error && <p className="text-red-400">{error}</p>}

			{data && (
				<Card className="border border-purple-500/20 bg-[#0f1424]/80 overflow-hidden">
					<div className="flex gap-2 md:gap-3 px-3 py-2.5 text-xs font-medium text-white/40 border-b border-white/10 items-center">
						<span className="w-7 md:w-9 shrink-0">#</span>
						<span className="flex-1 min-w-0">Player</span>
						<span className="w-8 shrink-0 text-center">Rank</span>
						<span className="w-8 shrink-0 text-right hidden md:block">Lv</span>
						<span className="w-14 shrink-0 text-right">XP</span>
					</div>
					<ul ref={listRef} className="divide-y divide-white/[0.06]">
						{data.entries.map((e: LeaderboardEntry) => {
							const mine = Boolean(yourId && e.userId === yourId);
							const rowClass = mine
								? "border-l-[3px] border-l-indigo-400 bg-indigo-500/[0.14] ring-1 ring-inset ring-indigo-400/35 shadow-[inset_0_0_0_1px_rgba(129,140,248,0.12)]"
								: `border-l-2 ${rowAccent(e.position)}`;
							return (
								<li
									key={e.userId}
									data-current-user={mine ? "true" : undefined}
									className={`flex gap-2 md:gap-3 px-3 py-3 items-center ${rowClass}`}
								>
									<span
										className={`font-mono text-sm tabular-nums w-7 md:w-9 shrink-0 ${
											mine ? "text-indigo-200 font-semibold" : "text-white/70"
										}`}
									>
										{e.position}
									</span>
									<div className="min-w-0 flex-1">
										<p className="text-white font-medium truncate flex items-center gap-2 min-w-0">
											<span className="truncate">{e.displayName}</span>
											{mine && (
												<span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-indigo-500/35 text-indigo-100 border border-indigo-400/40">
													You
												</span>
											)}
										</p>
										<p className={`text-xs truncate ${mine ? "text-indigo-200/50" : "text-white/35"}`}>@{e.username}</p>
									</div>
									<span className="text-amber-300/90 font-semibold text-sm w-8 shrink-0 text-center">{e.rank}</span>
									<span className="text-white/60 text-sm text-right tabular-nums w-8 shrink-0 hidden md:block">{e.level}</span>
									<span className="text-emerald-300/90 text-sm text-right tabular-nums font-medium w-14 shrink-0">{formatXp(e.xp)}</span>
								</li>
							);
						})}
					</ul>
					{data.entries.length === 0 && <p className="p-6 text-white/45 text-center">No players yet.</p>}
					{data.totalUsers > data.entries.length && (
						<p className="px-3 py-2 text-xs text-white/35 border-t border-white/10">
							Showing top {data.entries.length} of {data.totalUsers} players.
						</p>
					)}
				</Card>
			)}
		</div>
	);
}
