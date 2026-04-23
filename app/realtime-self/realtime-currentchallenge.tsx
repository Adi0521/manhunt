"use client"

import { useState, useEffect } from "react";

import supabase, { hasSupabaseEnv } from "../utils/supabase";

import type { Session } from '@supabase/supabase-js'


export default function CurrentChallengeStreamSelf({ theChallenge, user }: { theChallenge: [string, number], user: string }) { 

    const [currentChallenge, setCurrentChallenge] = useState<[string, number]>(theChallenge);

    useEffect(() => {
        setCurrentChallenge(theChallenge);
    }, [theChallenge]);
    

    useEffect(() => {
        const sb = supabase;
        if (!hasSupabaseEnv || !sb) return;

        const channel = sb.channel("realtimestream:drawntasks-stream-self-self2").on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "drawntasks"
        }, (payload: { new: any}) => {
            console.log({payload});

            console.log(payload.new);

            // setCurrentChallenge([payload.new.task, payload.new.points]);

            // alert(currentChallenge[0] + " has been drawn!");

        }).subscribe();

        return () => {
            sb.removeChannel(channel);
        }
    }, []);

    // useEffect(() => {
    //     const channel = supabase.channel("realtimestream:self-drawntasks-stream").on("postgres_changes", {
    //         event: "INSERT",
    //         schema: "public",
    //         table: "drawntasks"
    //     }, (payload: { new: any }) => {
    //         console.log({payload});

    //         console.log(payload.new);

    //         setCurrentChallenge([payload.new.task, payload.new.points]);

    //         // alert(currentChallenge[0] + " has been drawn!");

    //     }).subscribe();

    //     return () => {
    //         supabase.removeChannel(channel);
    //     }

    // }, []);


    // useEffect(() => {
    //     const channel = supabase.channel("realtimestream:drawntasks-stream-delete-self").on("postgres_changes", {
    //         event: "DELETE",
    //         schema: "public",
    //         table: "drawntasks"
    //     }, (payload: { old: any }) => {

    //         console.log({payload});

    //         console.log(payload.old);
    //         // The deleted row data is in payload.old, not payload.new
    //         // setCurrentChallenge(["", 0]);
    //     }).subscribe();

    //     return () => {
    //         supabase.removeChannel(channel);
    //     }
    // }, []);

    return (
        <div className="m-4 mt-10">
            {currentChallenge[0] != "" &&
            (<>
                <div className={"bg-blue-400 p-4 pt-2 rounded-md text-center mb-4"}>
                    <h2>{currentChallenge[0]}</h2>
                    <h2 className="font-bold">{currentChallenge[1]} points</h2>
                </div>

            </>)}
        </div>
    );
}