"use client"

import { useState, useEffect } from "react";

import supabase, { hasSupabaseEnv } from "../utils/supabase";

import type { Session } from '@supabase/supabase-js'

import generateChallenge from "../utils/manhunt";

import { toast } from "sonner"

type PointsStreamSelfProps = {
    selfPoints: number;
    user: string;
    challenge: [string, number];
    timeOutStatus: number;
    onChallengeChange?: (challenge: [string, number]) => void;
    onChallengeDrawn?: (drawnAt: Date) => void;
};

export default function PointsStreamSelf({ selfPoints, user, challenge, timeOutStatus, onChallengeChange, onChallengeDrawn }: PointsStreamSelfProps) {
    const [points, setPoints] = useState<number>(selfPoints);
    const [currentChallenge, setCurrentChallenge] = useState<[string, number]>(challenge);

    useEffect(() => {
        setPoints(selfPoints);
    }, [selfPoints]);

    useEffect(() => {
        setCurrentChallenge(challenge);
    }, [challenge]);

    useEffect(() => {
        if (onChallengeChange) {
            onChallengeChange(currentChallenge);
        }
      
    }, [currentChallenge]);

    useEffect(() => {
        const sb = supabase;
        if (!hasSupabaseEnv || !sb) return;

        const channel = sb.channel("realtimestream:points-stream-self").on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "points"
            },
            (payload: { new: any }) => {
                console.log({ payload });
                console.log(payload.new);
                console.log(points);

                if (payload.new.user == user) {
                    setPoints(payload.new.points);
                    setCurrentChallenge(["", 0]);
                }

                toast("Challenge completed! New challenge generated.");
            }
        ).subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, []);

    useEffect(() => {
        const sb = supabase;
        if (!hasSupabaseEnv || !sb) return;

        const channel = sb.channel("realtimestream:drawntasks-stream-self-self").on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "drawntasks"
        }, (payload: { new: any, old: any, eventType: string }) => {
            console.log({payload});

            console.log(payload.new);

            console.log(challenge)

            if (payload.new.user == user && payload.new.task != currentChallenge[0]) {
                setCurrentChallenge([payload.new.task, payload.new.points]);
                if (onChallengeDrawn && payload.new.created_at) {
                    onChallengeDrawn(new Date(payload.new.created_at));
                }
            }

            // alert(currentChallenge[0] + " has been drawn!");

        }).subscribe();

        return () => {
            sb.removeChannel(channel);
        }
    }, []);


    return (
        <>
            <h1 className="text-2xl font-bold text-center m-4">{points} Points</h1>
            { timeOutStatus == 0 && currentChallenge[0] !== "" && (<div className="m-4 mt-10">
                {currentChallenge[0] != "" &&
                (<>
                    <div className={"bg-blue-400 p-4 pt-2 rounded-md text-center mb-4"}>
                        <h2>{currentChallenge[0]}</h2>
                        <h2 className="font-bold">{currentChallenge[1]} points</h2>
                    </div>

                </>)}
            </div>
        )}
        </>
    );
}