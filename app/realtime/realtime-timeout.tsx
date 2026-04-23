"use client"

import { useState, useEffect } from "react";

import supabase, { hasSupabaseEnv } from "../utils/supabase";

import type { Session } from '@supabase/supabase-js'


type CurrentTimeoutStreamProps = {
    timeOutStatusRef: React.RefObject<{ current: number }>;
    timeOutElapsedTime: number;

};

export default function CurrentTimeoutStream({ timeOutStatusRef, timeOutElapsedTime }: CurrentTimeoutStreamProps) { 


    useEffect(() => {
        const sb = supabase;
        if (!hasSupabaseEnv || !sb) return;

        const channel = sb.channel("realtimestream:timeout-stream").on("postgres_changes", {
            event: "UPDATE",
            schema: "public",
            table: "hunts"
        }, (payload: { new: any }) => {
            console.log({payload});

            console.log(payload.new);

            location.reload();
            // alert(currentChallenge[0] + " has been drawn!");

        }).subscribe();

        return () => {
            sb.removeChannel(channel);
        }

    }, []);


    return (
        <div>
            {timeOutStatusRef.current?.current === 1 && (
            <div className="text-center bg-red-400 p-4 rounded-md mb-19 -mt-16 mb-28">
                <h1>
                5 min timeout initiated for vetoing a challenge.
                Timeout will elapse in {Math.floor((5 * 60 - timeOutElapsedTime) / 60)}m {Math.floor((5 * 60 - timeOutElapsedTime) % 60)}s.
                </h1>
            </div>
            )}
        </div>
    );
}