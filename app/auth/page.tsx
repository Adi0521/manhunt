"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import supabase, { hasSupabaseEnv } from "../utils/supabase";
import { setPlayerName, setIsAdmin } from "../utils/player";

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "manhunt-admin";

export default function AuthPage() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminPw, setAdminPw] = useState("");

  async function handleJoin() {
    const trimName = name.trim();
    const trimCode = code.trim().toUpperCase();
    if (!trimName) { setError("Enter your name."); return; }
    if (!trimCode) { setError("Enter a game code."); return; }
    if (!hasSupabaseEnv || !supabase) { setError("App not configured."); return; }

    setLoading(true);
    setError(null);

    await supabase
      .from("players")
      .upsert({ name: trimName, game_code: trimCode }, { onConflict: "name,game_code" });

    setPlayerName(trimName);
    setIsAdmin(false);
    window.location.href = "/";
  }

  function handleAdminLogin() {
    if (adminPw === ADMIN_PASSWORD) {
      setPlayerName("Admin");
      setIsAdmin(true);
      window.location.href = "/admin";
    } else {
      setError("Wrong password.");
    }
  }

  return (
    <div className="min-h-screen bg-stone-300 dark:bg-neutral-900 text-slate-900 dark:text-slate-100">
      <div className="w-full bg-slate-800 dark:bg-[rgb(20,77,128)] text-white h-10 flex items-center px-4">
        <h1>Manhunt</h1>
      </div>

      <div className="max-w-sm mx-auto mt-24 flex flex-col gap-4">
        {!showAdmin ? (
          <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 flex flex-col gap-4">
            <h2 className="text-2xl font-semibold text-center">Join Game</h2>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-600 dark:text-slate-400">Your name</label>
              <input
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                placeholder="e.g. Jabari"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-600 dark:text-slate-400">Game code</label>
              <input
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono uppercase tracking-widest"
                placeholder="ABC123"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
            </div>

            {error && <p className="text-sm text-rose-500">{error}</p>}

            <Button onClick={handleJoin} disabled={loading}>
              {loading ? "Joining…" : "Join"}
            </Button>

            <button
              className="text-xs text-slate-400 hover:text-slate-600 text-center mt-1"
              onClick={() => { setShowAdmin(true); setError(null); }}
            >
              Admin access
            </button>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 flex flex-col gap-4">
            <h2 className="text-2xl font-semibold text-center">Admin Login</h2>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-600 dark:text-slate-400">Password</label>
              <input
                type="password"
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                value={adminPw}
                onChange={(e) => setAdminPw(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
              />
            </div>
            {error && <p className="text-sm text-rose-500">{error}</p>}
            <Button onClick={handleAdminLogin}>Enter</Button>
            <button
              className="text-xs text-slate-400 hover:text-slate-600 text-center"
              onClick={() => { setShowAdmin(false); setError(null); }}
            >
              Back to join
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
