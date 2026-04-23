"use client"

import { useState, useEffect } from "react";

import supabase, { hasSupabaseEnv } from "./../utils/supabase";

import type { Session } from '@supabase/supabase-js'

import { Progress } from "@/components/ui/progress";

import generateChallenge from "../utils/manhunt";

type Hunt = {
    id: number;
    created_at: string;
    runners: string[];
    hunters: string[];
}

export default function RealtimeStream({serverData} : {serverData: Hunt[]}) { 

    const [hunts, setHunts] = useState<Hunt[]>(serverData);

    const [huntTime, setHuntTime] = useState<number>();

    const [indexToUse, setIndexToUse] = useState<number>(hunts.length-1);


    useEffect(() => {
        if (!hasSupabaseEnv || !supabase) return;

        supabase.channel("realtimestream:hunts-stream").on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "hunts"
        }, (payload: { new: Hunt }) => {
            console.log({payload});

            setHunts(prevHunts => [...prevHunts, payload.new]);

            setIndexToUse(prevIndex => prevIndex + 1);

            location.reload();

        }).subscribe();

        return () => {
            // supabase.removeChannel("realtime stream");
        }

    }, []);


    

    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        let isMounted = true;

        if (!hasSupabaseEnv || !supabase) return;

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (isMounted) setSession(session);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (isMounted) setSession(session);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const seconds_interval = 0.1 * 1000;

    useEffect(() => {
        const interval = setInterval(() => {

            const sT = hunts[indexToUse].created_at;
            const startTime = new Date(sT);

            if (startTime) {
                // console.log("Interval running inside");

                const currentTime = new Date();
                const timeDiff = Math.floor((currentTime.valueOf() - startTime.valueOf()) / 1000);

                // console.log("Time diff: ", timeDiff);
                setHuntTime(timeDiff);
            }

            // console.log("Interval running");

        }, seconds_interval);
        return () => clearInterval(interval);
    }, [])

    return (

        <div className="-mt-17 text-center text-red-700">
            {hunts.length > 0 && session?.user.email && hunts[hunts.length-1].runners ? (
                hunts[hunts.length - 1].runners.includes(session.user.email) ? (

                    <h1 className="text-5xl font-bold mb-4">Run!</h1>
                ) : hunts[hunts.length - 1].hunters.includes(session.user.email) ? (

                    <h1 className="text-5xl font-bold">Hunt!</h1>
                ) : (
                    <h1 className="text-5xl font-bold">Spectate!</h1>
                )
            ) : null}

            {hunts.length > 0 ? (
                <div>
                    { (huntTime !== undefined && huntTime < 180) ? (
                        <>
                            <h1>Hunting begins in: {String(Math.floor((180-huntTime)/60))}m {String((180-huntTime)%60)}s</h1>
                            <Progress value={huntTime*100/180} />
                        </>
                    ) : huntTime !== undefined && huntTime < 1800 ? (
                        <>
                            <h1>Time until turnover: {String(Math.floor((1800-huntTime)/60))}m {String((1800-huntTime)%60)}s</h1>
                            <Progress value={huntTime*100/1800} />
                        </>
                    ) : huntTime !== undefined ? (
                        <h1>Hunt elapsed</h1>
                    ) :(
                        <h1>Loading time...</h1>
                    )}

                    { huntTime !== undefined && huntTime < 1800 ? (
                        <>
                        <h1 className="mt-8 font-bold">Hunters:</h1>
                            {hunts[hunts.length-1].runners &&
                                <>
                                {hunts[hunts.length-1].hunters.map((hunter, index) => (
                                    hunter === session?.user.email ? (
                                        <h4 key={index}>You</h4>
                                    ) : (
                                        <h4 key={index}>{hunter}</h4>
                                    )
                                ))}
                                </>
                            }
                        <h1 className="font-bold">Runners: </h1>  
                        {hunts[hunts.length-1].runners &&
                        <>
                            {hunts[hunts.length-1].runners.map((runner, index) => (
                                runner === session?.user.email ? (
                                    <h4 key={index}>You</h4> 
                                ) : (
                                    <h4 key={index}>{runner}</h4> 
                                )
                            ))}
                        </>
                        }   
                        </>
                    ) : (
                        <>
                        <h1>Runners</h1>  

                            {hunts[hunts.length-1].runners &&
                                <>
                                    {hunts[hunts.length-1].runners.map((runner: string, index: number) => (
                                        runner === session?.user.email ? (
                                            <h2 key={index} className="m-2">You</h2>
                                        ) : (
                                            <h2 key={index} className="m-2">{runner}</h2> 
                                        )
                                    ))} have completed their run.
                                </>
                            }

                        </>
                    )}           
                </div>
            ) : (
                <h1>No hunts available</h1>
            )}
        </div>
    );
}