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
    const [checkedAsHunter, setCheckedAsHunter] = useState<Set<string>>(new Set());
    const [hunts, setHunts] = useState<any[]>([]);
    const [everyonePoints, setEveryonePoints] = useState<[string, number][]>([]);

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
        setCheckedAsHunter(new Set());
        toast(`New code: ${code}`);
    }

    function handleCodeChange(val: string) {
        const upper = val.toUpperCase().slice(0, 8);
        setGameCode(upper);
        localStorage.setItem("mh_admin_code", upper);
    }

    function toggleHunter(name: string) {
        setCheckedAsHunter((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    }

    async function startRun() {
        if (!hasSupabaseEnv || !supabase) { toast("Supabase not configured."); return; }

        const runners = players.filter((p) => !checkedAsHunter.has(p));
        const hunters = players.filter((p) => checkedAsHunter.has(p));

        if (runners.length === 0 || hunters.length === 0) {
            toast("Need at least one runner and one hunter.");
            return;
        }

        const { error } = await supabase.from("hunts").insert({ runners, hunters, code: gameCode });
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

                    <div className="flex flex-col gap-2">
                        <h2 className="text-xl text-center">Players ({players.length})</h2>
                        <p className="text-xs text-center text-slate-500">Tap a player to toggle Hunter (green) / Runner.</p>
                        {players.length === 0 ? (
                            <p className="text-sm text-center text-slate-400 py-4">Waiting for players to join...</p>
                        ) : (
                            players.map((name) => {
                                const isHunter = checkedAsHunter.has(name);
                                return (
                                    <div
                                        key={name}
                                        className={`p-3 rounded-md w-full text-center cursor-pointer transition-all duration-200 ${
                                            isHunter ? "bg-green-400 dark:bg-green-500 text-black" : "bg-gray-200 dark:bg-gray-700"
                                        }`}
                                        onClick={() => toggleHunter(name)}
                                    >
                                        {name} — {isHunter ? "Hunter" : "Runner"}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <Button onClick={startRun}>Start Hunt</Button>
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
