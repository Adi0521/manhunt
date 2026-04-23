"use client"

import { useState, useEffect } from "react";

import supabase, { hasSupabaseEnv } from "../utils/supabase";

// import type { Session } from '@supabase/supabase-js'


export default function AllTasksStreamSelf({ theChallenge, user }: { theChallenge: [string, number, number][], user: string }) { 

    const [allChallenges, setAllChallenges] = useState<[string, number, number][]>(theChallenge);


    useEffect(() => {
        setAllChallenges(prev => prev.length === 0 ? theChallenge : prev);
    }, [theChallenge]);


    useEffect(() => {
        const sb = supabase;
        if (!hasSupabaseEnv || !sb) return;

        const channel = sb.channel("realtimestream:alltasks-stream45").on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "tasks"
        }, (payload: { new: any }) => {
            console.log({payload});

            console.log(payload.new);

            console.log("I got something new");

            if (user == payload.new.user) {
                console.log("Should have added!");
                setAllChallenges(prevChallenges => [
                    ...prevChallenges,
                    [
                        String(payload.new.task),
                        Number(payload.new.points),
                        Number(payload.new.status)
                    ]
                ]);
            }

        }).subscribe();

        return () => {
            sb.removeChannel(channel);
        }

    }, []);

    return (
        <div>
            {[...allChallenges].reverse().map((challenge, index) => (
            <div
                key={index}
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