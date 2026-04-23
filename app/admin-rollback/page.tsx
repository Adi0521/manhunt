"use client"


import { useState, useEffect, useRef } from "react";

import supabase, { hasSupabaseEnv } from "../utils/supabase";
import type { Session } from '@supabase/supabase-js';

import { Button } from "@/components/ui/button";

import Head from 'next/head';

export default function HomePage() {

    const [input1, setInput1] = useState<string>("");
    const [input2, setInput2] = useState<string>("");

    const [session, setSession] = useState<Session | null>(null)
    
      useEffect(() => {
        if (!hasSupabaseEnv || !supabase) return;

        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            if (session && session.user.email != "skparab1@gmail.com"){
                location.href = "/auth";
            }
        })
    
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            if (session && session.user.email != "skparab1@gmail.com"){
                location.href = "/auth";
            }
        })
    
        return () => subscription.unsubscribe()
      }, [])


    async function handleSubmit(input1: string, input2: string) {
        if (!hasSupabaseEnv || !supabase) {
            alert("Supabase not configured.");
            return;
        }

        const splitRunners = input1.split(",");

        const splitHunters = input2.split(",");


        const { error } = await supabase.from('hunts').insert({ runners: splitRunners, hunters: splitHunters});
        
        setInput1("");
        setInput2("");

        alert("Hunt started");
    }

    async function terminate() {
        if (!hasSupabaseEnv || !supabase) {
            alert("Supabase not configured.");
            return;
        }

        const { error } = await supabase.from('hunts').insert({});
        alert("Hunt terminated");
    }

    return (
        <>
            {(!hasSupabaseEnv || !supabase) ? (
                <div className="min-h-screen bg-stone-300 dark:bg-neutral-900 text-slate-900 dark:text-slate-100">
                    <div className="w-full bg-slate-800 text-white h-10 absolute t-0">
                        <h1 className="absolute l-0 m-2">Manhunt • ADMIN</h1>
                    </div>
                    <div className="max-w-xl mx-auto mt-32 p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700">
                        <h2 className="text-xl font-semibold">Supabase not configured</h2>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
                        </p>
                    </div>
                </div>
            ) : null}

            <div className="w-full bg-slate-800 text-white h-10 absolute t-0">
                <h1 className="absolute l-0 m-2">Manhunt • ADMIN</h1>
            </div>
            <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] bg-stone-300">
                <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
                    <input
                        type="text"
                        className="border-2 border-black border-solid bg-gray-200 rounded-md p-2"
                        placeholder="Enter Running Team Members"
                        value={input1}
                        onChange={e => setInput1(e.target.value)}
                    />

                    <input
                        type="text"
                        className="border-2 border-black border-solid bg-gray-200 rounded-md p-2"
                        placeholder="Enter Hunting Team Members"
                        value={input2}
                        onChange={e => setInput2(e.target.value)}
                    />

                    <Button onClick={() => handleSubmit(input1, input2)}>
                        Submit
                    </Button>

                    <Button onClick={() => terminate()}>
                        Terminate current hunt
                    </Button>
                </main>
                <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
                
                </footer>
            </div>
        </>
    );
}
