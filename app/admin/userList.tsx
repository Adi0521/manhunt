"use client"

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

import supabase, { hasSupabaseEnv } from "../utils/supabase";
import { generateCode } from "../utils/player";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const BoundaryMapClient = dynamic(() => import("./BoundaryMapClient"), { ssr: false });

export default function UserList() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [tab, setTab] = useState<"teams" | "adjustment" | "boundary">("teams");
    const [gameCode, setGameCode] = useState("");
    const [players, setPlayers] = useState<string[]>([]);
    const [hunts, setHunts] = useState<any[]>([]);
    const [everyonePoints, setEveryonePoints] = useState<[string, number][]>([]);
    const [pairs, setPairs] = useState<any[]>([]);
    const [runnerPairId, setRunnerPairId] = useState<number | null>(null);
    const [assigningPlayer, setAssigningPlayer] = useState<string | null>(null);
    const [winPoints, setWinPoints] = useState<number>(15);
    const [rotationMinutes, setRotationMinutes] = useState<number>(30);

    useEffect(() => {
        const admin = localStorage.getItem("mh_is_admin") === "true";
        if (!admin) { window.location.href = "/auth"; return; }
        setIsAdmin(true);
        const saved = localStorage.getItem("mh_admin_code") ?? "";
        setGameCode(saved);
    }, []);

    useEffect(() => {
        if (!hasSupabaseEnv || !supabase) return;
        supabase.from("hunts").select().then(({ data }) => {
            const sorted = data?.sort((a, b) => a.id - b.id) ?? [];
            setHunts(sorted);
        });
        const channel = supabase.channel("hunts-admin-updates")
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "hunts" }, () => {
                supabase!.from("hunts").select().then(({ data }) => {
                    const sorted = data?.sort((a, b) => a.id - b.id) ?? [];
                    setHunts(sorted);
                });
            })
            .subscribe();
        return () => { supabase!.removeChannel(channel); };
    }, []);

    useEffect(() => {
        if (!gameCode || !hasSupabaseEnv || !supabase) return;

        supabase.from("players").select("name").eq("game_code", gameCode).then(({ data }) => {
            if (data) setPlayers(data.map((p: any) => p.name));
        });

        const channel = supabase
            .channel("players-admin")
            .on("postgres_changes", { event: "*", schema: "public", table: "players" }, (payload) => {
                if (payload.eventType === "INSERT" && (payload.new as any).game_code === gameCode) {
                    setPlayers((prev) => prev.includes((payload.new as any).name) ? prev : [...prev, (payload.new as any).name]);
                }
                if (payload.eventType === "DELETE") {
                    setPlayers((prev) => prev.filter((p) => p !== (payload.old as any).name));
                }
            })
            .subscribe();

        return () => { supabase!.removeChannel(channel); };
    }, [gameCode]);

    useEffect(() => {
        if (!gameCode || !hasSupabaseEnv || !supabase) return;
        supabase.from("pairs").select().eq("game_code", gameCode).then(({ data }) => {
            setPairs(data ?? []);
        });
        const channel = supabase.channel("pairs-admin")
            .on("postgres_changes", { event: "*", schema: "public", table: "pairs" }, () => {
                supabase!.from("pairs").select().eq("game_code", gameCode).then(({ data }) => {
                    setPairs(data ?? []);
                });
            })
            .subscribe();
        return () => { supabase!.removeChannel(channel); };
    }, [gameCode]);

    useEffect(() => {
        getPoints();
    }, []);

    async function getPoints() {
        if (!hasSupabaseEnv || !supabase) return;
        supabase.from("points").select("user, points").then(({ data }) => {
            if (data && data.length > 0) {
                const sorted = [...data].sort((a: any, b: any) => a.user.localeCompare(b.user));
                setEveryonePoints(sorted.map((item: any) => [item.user, item.points]));
            } else {
                setEveryonePoints([]);
            }
        });
    }

    function handleNewCode() {
        const code = generateCode();
        setGameCode(code);
        localStorage.setItem("mh_admin_code", code);
        setPlayers([]);
        setPairs([]);
        setRunnerPairId(null);
        toast(`New code: ${code}`);
    }

    function handleCodeChange(val: string) {
        const upper = val.toUpperCase().slice(0, 8);
        setGameCode(upper);
        localStorage.setItem("mh_admin_code", upper);
    }

    async function assignToTeam(pairId: number, player: string) {
        if (!hasSupabaseEnv || !supabase) return;
        await supabase.from("pairs").update({ third: player }).eq("id", pairId);
        setAssigningPlayer(null);
        toast(`${player} added to team.`);
    }

    async function removeFromTeam(pairId: number) {
        if (!hasSupabaseEnv || !supabase) return;
        await supabase.from("pairs").update({ third: null }).eq("id", pairId);
        toast("Player removed from team.");
    }

    function pickRunnersRandomly() {
        const confirmed = pairs.filter((p: any) => p.confirmed);
        if (confirmed.length === 0) { toast("No confirmed pairs yet."); return; }
        const pick = confirmed[Math.floor(Math.random() * confirmed.length)];
        setRunnerPairId(pick.id);
        toast(`Runners: ${pick.requester} & ${pick.partner}`);
    }

    async function startRun() {
        if (!hasSupabaseEnv || !supabase) { toast("Supabase not configured."); return; }

        const confirmed = pairs.filter((p: any) => p.confirmed);
        if (confirmed.length < 2) { toast("Need at least 2 confirmed pairs to start."); return; }
        if (!runnerPairId) { toast("Pick a runner pair first (or use Pick Randomly)."); return; }

        const runnerPair = confirmed.find((p: any) => p.id === runnerPairId);
        if (!runnerPair) { toast("Runner pair not found."); return; }

        const pairMembers = (p: any) => [p.requester, p.partner, ...(p.third ? [p.third] : [])];
        const runners = pairMembers(runnerPair);
        const pairedSet = new Set(confirmed.flatMap(pairMembers));
        const hunters = [
            ...confirmed.filter((p: any) => p.id !== runnerPairId).flatMap(pairMembers),
            ...players.filter((p) => !pairedSet.has(p)),
        ];

        const { error } = await supabase.from("hunts").insert({ runners, hunters, code: gameCode, win_points: winPoints, rotation_minutes: rotationMinutes });
        if (error) {
            console.error(error);
            toast("Failed to start hunt.");
        } else {
            toast("Hunt started!");
            supabase.from("hunts").select().then(({ data }) => {
                const sorted = data?.sort((a, b) => a.id - b.id) ?? [];
                setHunts(sorted);
            });
        }
    }

    async function terminate() {
        if (!hasSupabaseEnv || !supabase) { toast("Supabase not configured."); return; }
        const latest = hunts[hunts.length - 1];
        if (latest?.runners) {
            await supabase.from("hunts").insert({});
            setHunts((prev) => [...prev, { id: null, runners: null, hunters: null, created_at: null }]);
            toast("Hunt terminated.");
        } else {
            toast("Hunt already terminated.");
        }
    }

    async function resumeHunt() {
        if (!hasSupabaseEnv || !supabase) { toast("Supabase not configured."); return; }
        const latest = hunts[hunts.length - 1];
        if (!latest?.paused) { toast("No paused hunt to resume."); return; }
        const { error } = await supabase.from("hunts").insert({
            runners: latest.runners,
            hunters: latest.hunters,
            code: gameCode,
            win_points: latest.win_points ?? winPoints,
            rotation_minutes: latest.rotation_minutes ?? rotationMinutes,
        });
        if (error) {
            toast("Failed to resume hunt.");
        } else {
            toast("Hunt resumed!");
            supabase.from("hunts").select().then(({ data }) => {
                const sorted = data?.sort((a, b) => a.id - b.id) ?? [];
                setHunts(sorted);
            });
        }
    }

    async function modPoints(adjustment: number, user: string, prevpoints: number) {
        if (!hasSupabaseEnv || !supabase) return;
        await supabase.from("points").update({ points: prevpoints + adjustment }).eq("user", user);
        getPoints();
    }

    if (!isAdmin) return null;

    const activeHuntId = hunts.length > 0 && hunts[hunts.length - 1]?.runners ? hunts[hunts.length - 1].id : null;

    return (
        <div className="flex flex-col gap-4 w-full max-w-md">
            <div className="flex bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden">
                {(["teams", "adjustment", "boundary"] as const).map((t) => (
                    <button
                        key={t}
                        className={`flex-1 px-4 py-2 capitalize transition-colors duration-200 focus:outline-none ${
                            tab === t ? "bg-gray-300 dark:bg-green-400 text-black font-bold" : "text-gray-500"
                        }`}
                        onClick={() => setTab(t)}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {tab === "teams" && (
                <>
                    <div className="flex flex-col gap-2 bg-gray-100 dark:bg-gray-800 p-4 rounded-xl">
                        <h2 className="font-semibold">Game Code</h2>
                        <div className="flex gap-2 items-center">
                            <input
                                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-lg font-mono uppercase tracking-widest"
                                value={gameCode}
                                onChange={(e) => handleCodeChange(e.target.value)}
                                placeholder="XXXXXX"
                                maxLength={8}
                            />
                            <button
                                className="px-3 py-2 rounded-lg bg-blue-500 text-white text-sm"
                                onClick={handleNewCode}
                            >
                                Generate
                            </button>
                            <button
                                className="px-3 py-2 rounded-lg bg-slate-300 dark:bg-slate-600 text-sm"
                                onClick={() => { navigator.clipboard.writeText(gameCode); toast("Copied!"); }}
                                disabled={!gameCode}
                            >
                                Copy
                            </button>
                        </div>
                        <p className="text-xs text-slate-500">Share this code with players so they can join.</p>
                    </div>

                    {(() => {
                        const confirmed = pairs.filter((p: any) => p.confirmed);
                        const pairMembers = (p: any) => [p.requester, p.partner, ...(p.third ? [p.third] : [])];
                        const pairedSet = new Set(confirmed.flatMap(pairMembers));
                        const unpaired = players.filter((p) => !pairedSet.has(p));
                        return (
                            <div className="flex flex-col gap-2">
                                <h2 className="text-xl text-center">Pairs ({confirmed.length})</h2>
                                <p className="text-xs text-center text-slate-500">
                                    {assigningPlayer
                                        ? `Tap a pair to add ${assigningPlayer} to it.`
                                        : "Tap a pair to designate as Runners (red). All others become Hunters."}
                                </p>
                                {confirmed.length === 0 ? (
                                    <p className="text-sm text-center text-slate-400 py-4">No pairs yet — players need to pair up in the lobby.</p>
                                ) : (
                                    confirmed.map((pair: any) => {
                                        const isRunners = pair.id === runnerPairId;
                                        const canAddThird = assigningPlayer && !pair.third;
                                        const label = pairMembers(pair).join(" & ");
                                        return (
                                            <div key={pair.id} className="flex flex-col gap-1">
                                                <div
                                                    className={`p-3 rounded-md w-full text-center cursor-pointer transition-all duration-200 ${
                                                        canAddThird
                                                            ? "bg-blue-200 dark:bg-blue-800 ring-2 ring-blue-400"
                                                            : isRunners
                                                            ? "bg-rose-400 dark:bg-rose-500 text-black"
                                                            : "bg-gray-200 dark:bg-gray-700"
                                                    }`}
                                                    onClick={() => {
                                                        if (canAddThird) assignToTeam(pair.id, assigningPlayer!);
                                                        else if (!assigningPlayer) setRunnerPairId(isRunners ? null : pair.id);
                                                    }}
                                                >
                                                    {label} — {isRunners ? "Runners" : "Hunters"}
                                                    {canAddThird && <span className="ml-2 text-blue-700 dark:text-blue-300 text-xs">(tap to add)</span>}
                                                </div>
                                                {pair.third && (
                                                    <button
                                                        className="text-xs text-slate-400 hover:text-red-500 text-center"
                                                        onClick={() => removeFromTeam(pair.id)}
                                                    >
                                                        Remove {pair.third} from this team
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                                {unpaired.length > 0 && (
                                    <div className="mt-2 flex flex-col gap-1">
                                        <p className="text-xs text-center text-slate-500 mb-1">Unpaired players — tap to add to a team:</p>
                                        {unpaired.map((p) => (
                                            <div
                                                key={p}
                                                className={`p-2 rounded-md text-sm flex items-center justify-between cursor-pointer transition-all duration-200 ${
                                                    assigningPlayer === p
                                                        ? "bg-blue-200 dark:bg-blue-800 ring-2 ring-blue-400"
                                                        : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                                                }`}
                                                onClick={() => setAssigningPlayer(assigningPlayer === p ? null : p)}
                                            >
                                                <span>{p}</span>
                                                <span className="text-xs text-slate-400">
                                                    {assigningPlayer === p ? "tap a pair above ↑" : "+ add to team"}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    <Button onClick={pickRunnersRandomly} className="bg-blue-500 hover:bg-blue-600 text-white">
                        Pick Runners Randomly
                    </Button>

                    <div className="flex flex-col gap-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-xl">
                        <h3 className="font-semibold text-sm">Hunt Settings</h3>
                        <div className="flex gap-3">
                            <label className="flex flex-col gap-1 flex-1 text-xs text-slate-500">
                                Win at ___ pts
                                <input
                                    type="number"
                                    min={1}
                                    value={winPoints}
                                    onChange={(e) => setWinPoints(Number(e.target.value))}
                                    className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-sm text-slate-900 dark:text-slate-100"
                                />
                            </label>
                            <label className="flex flex-col gap-1 flex-1 text-xs text-slate-500">
                                Rotation (min)
                                <input
                                    type="number"
                                    min={1}
                                    value={rotationMinutes}
                                    onChange={(e) => setRotationMinutes(Number(e.target.value))}
                                    className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-sm text-slate-900 dark:text-slate-100"
                                />
                            </label>
                        </div>
                    </div>

                    <Button onClick={startRun}>Start Hunt</Button>

                    {hunts[hunts.length - 1]?.paused && (
                        <Button onClick={resumeHunt} className="bg-green-500 hover:bg-green-600 text-white">
                            Resume Hunt (new runners ready)
                        </Button>
                    )}

                    <Button onClick={terminate} className="bg-rose-500 hover:bg-rose-600 text-white">
                        Terminate current hunt
                    </Button>

                    <div className="flex flex-col gap-2">
                        <h1 className="text-2xl text-center">Previous Hunts</h1>
                        {[...hunts].reverse().map((hunt: any) =>
                            hunt.runners ? (
                                <div
                                    key={hunt.id}
                                    className={`p-2 rounded-md w-full text-center ${
                                        hunt.id === hunts[hunts.length - 1]?.id ? "bg-green-400" : "bg-gray-400"
                                    }`}
                                >
                                    {hunt.code && <p className="text-sm font-mono font-bold">Code: {hunt.code}</p>}
                                    <h2 className="font-bold">Runners:</h2>
                                    <ul>{hunt.runners.map((r: string) => <li key={r}>{r}</li>)}</ul>
                                    <h2 className="font-bold mt-2">Hunters:</h2>
                                    <ul>{hunt.hunters?.map((h: string) => <li key={h}>{h}</li>)}</ul>
                                    <h2 className="font-bold mt-2 mb-2">{new Date(hunt.created_at).toLocaleString()}</h2>
                                </div>
                            ) : null
                        )}
                    </div>
                </>
            )}

            {tab === "adjustment" && (
                <div className="flex flex-col gap-4 items-center">
                    <h1 className="text-2xl text-center">Points Adjustment</h1>
                    {everyonePoints.map(([user, points]) => (
                        <div key={user} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded w-full">
                            <span>{user}</span>
                            <div className="flex items-center gap-2 ml-4">
                                <button
                                    className="px-2 py-1 rounded bg-red-200 dark:bg-red-600 text-black dark:text-white"
                                    onClick={() => modPoints(-1, user, points)}
                                >-</button>
                                <span className="px-2">{points}</span>
                                <button
                                    className="px-2 py-1 rounded bg-green-200 dark:bg-green-600 text-black dark:text-white"
                                    onClick={() => modPoints(1, user, points)}
                                >+</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {tab === "boundary" && (
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl text-center">Set Play Boundary</h1>
                    <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-2">
                        Draw the area players must stay within.
                    </p>
                    <BoundaryMapClient huntId={activeHuntId} />
                </div>
            )}
        </div>
    );
}
