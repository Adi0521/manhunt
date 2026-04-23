"use client"

import { useState, useEffect } from "react";

import supabase, { hasSupabaseEnv } from "../utils/supabase";

import type { Session } from '@supabase/supabase-js'

import { toast } from "sonner"


export default function AllTasksStream({ theChallenge }: { theChallenge: [string, number, number][]}) { 

    const [allChallenges, setAllChallenges] = useState<[string, number, number][]>(theChallenge);

    const [ptask, setPtask] = useState<string>("");

    useEffect(() => {
        setAllChallenges(prev => prev.length === 0 ? theChallenge : prev);
    }, [theChallenge]);

    useEffect(() => {
        const sb = supabase;
        if (!hasSupabaseEnv || !sb) return;

        const channel = sb.channel("realtimestream:alltasks-stream").on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "tasks"
        }, (payload: { new: any }) => {
            console.log({payload});

            console.log(payload.new);

            console.log("<" + ptask + "> <" + String(payload.new.task) + ">");

            
            setAllChallenges(prevChallenges => {
                if (
                    prevChallenges.length === 0 ||
                    prevChallenges[prevChallenges.length - 1][0] !== payload.new.task
                ) {
                    // toast("Runners completed a task!")
                    return [...prevChallenges, [payload.new.task, payload.new.points, payload.new.status]];
                }
                return prevChallenges;
            });


        }).subscribe();

        return () => {
            sb.removeChannel(channel);
        }

    }, []);

    return (
        <div>
            <h1 className="text-2xl font-bold text-center">Runners' past challenge</h1>
            

            {[...allChallenges].reverse().map((challenge, index) => (
                <div key={index} 
                    className={
                        (challenge[2] == 1
                            ? "bg-green-400"
                            : challenge[2] == 2
                            ? "bg-yellow-500"
                            : "bg-red-400") +
                        " p-4 rounded-md text-center m-4"
                    }
                >
                        <h2>{challenge[0]}</h2>
                        <h2 className="font-bold">{challenge[1]} points</h2>
                </div>
            ))}
        </div>
    );
}