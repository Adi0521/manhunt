"use client"

import { useState, useEffect } from "react";

import supabase, { hasSupabaseEnv } from "../utils/supabase";

import type { Session } from '@supabase/supabase-js'

import {toast} from "sonner";

export default function CurrentChallengeStream({ theChallenge }: { theChallenge: [string, number]}) { 

    const [currentChallenge, setCurrentChallenge] = useState<[string, number]>(theChallenge);

    useEffect(() => {
        setCurrentChallenge(theChallenge);
    }, [theChallenge]);

    useEffect(() => {
        const sb = supabase;
        if (!hasSupabaseEnv || !sb) return;

        const channel = sb.channel("realtimestream:drawntasks-stream").on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "drawntasks"
        }, (payload: { new: any }) => {
            console.log({payload});

            console.log(payload.new);

            setCurrentChallenge([payload.new.task, payload.new.points]);

            // toast("Runners drew a task!")
            // alert(currentChallenge[0] + " has been drawn!");

        }).subscribe();

        return () => {
            sb.removeChannel(channel);
        }

    }, []);


    useEffect(() => {
        const sb = supabase;
        if (!hasSupabaseEnv || !sb) return;

        const channel = sb.channel("realtimestream:drawntasks-stream-delete").on("postgres_changes", {
            event: "DELETE",
            schema: "public",
            table: "drawntasks"
        }, (payload: { old: any }) => {
            // The deleted row data is in payload.old, not payload.new
            setCurrentChallenge(["", 0]);
        }).subscribe();

        return () => {
            sb.removeChannel(channel);
        }
    }, []);

    return (
        <div className="m-4 mt-10">
            {currentChallenge[0] != "" &&
            (<>
                <h1 className="text-2xl font-bold text-center mt-8">Runners' current challenge</h1>

                <div className={"bg-blue-400 p-4 rounded-md text-center"}>
                    <h2>{currentChallenge[0]}</h2>
                    <h2 className="font-bold">{currentChallenge[1]} points</h2>
                </div>

            </>)}
        </div>
    );
}