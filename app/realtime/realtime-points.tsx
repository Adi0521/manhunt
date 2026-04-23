"use client"

import { useState, useEffect } from "react";

import supabase, { hasSupabaseEnv } from "../utils/supabase";

import type { Session } from '@supabase/supabase-js'

import generateChallenge from "../utils/manhunt";


export default function PointsStream({ pointsArr }: { pointsArr: [string, number][] }) { 

    const [points, setPoints] = useState<[string, number][]>(pointsArr);

    useEffect(() => {
        setPoints(pointsArr);
    }, [pointsArr]);


    useEffect(() => {
        const sb = supabase;
        if (!hasSupabaseEnv || !sb) return;

        const channel = sb.channel("realtimestream:points-stream").on(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "points"
            },
            (payload: { new: any }) => {
                console.log({ payload });
                console.log("JABARI",payload.new, points.length);


                // lets just ignore the payload for now, and get the points

                sb
                    .from("points")
                    .select()
                    .then(({ data }) => {
            
                    if (data && data.length > 0) {
                        setPoints(data.map((item: any) => [item.user, item.points]));
                    } else {
                        setPoints([]);
                    }
            
                    // console.log("Everyone points: ", everyonePoints);
                });


                // console.log("JABARI",points);

                // setPoints(prevPoints => {
                //     const userIndex = prevPoints.findIndex(([user]) => user === payload.new.user);

                //     if (userIndex !== -1) {
                //         const updatedPoints = [...prevPoints];
                //         updatedPoints[userIndex] = [payload.new.user, payload.new.points];
                //         return updatedPoints;
                //     } else {
                //         return [...prevPoints, [payload.new.user, payload.new.points]];
                //     }
                // });

                // let i = 0;
                // let found = false
                // while (i < points.length) {
                //     console.log(points[i][0], payload.new.user);
                //     if (points[i][0] === payload.new.user) {
                //         updatedPoints.push([points[i][0], payload.new.points]);
                //         found = true;
                //     } else {
                //         updatedPoints.push(points[i]);
                //     }
                //     i += 1;
                // }

                // if (!found) {
                //     updatedPoints.push([payload.new.user, payload.new.points]);
                // }

                // console.log("JABARI",updatedPoints);

                // setPoints(updatedPoints);
            }
        ).subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, []);

    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        let isMounted = true;

        const sb = supabase;
        if (!hasSupabaseEnv || !sb) return;

        sb.auth.getSession().then(({ data: { session } }) => {
            if (isMounted) setSession(session);
        });

        const {
            data: { subscription },
        } = sb.auth.onAuthStateChange((_event, session) => {
            if (isMounted) setSession(session);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const seconds_interval = 0.1 * 1000;

    return (
        <div className="m-4">
            <h1 className="text-2xl font-bold text-center">Points</h1>
            <div className="flex flex-col gap-4">
                {points.map((point: [string, number], index: number) => (
                    (point[0] != session?.user.email ?
                        (<div key={index} className="flex items-center justify-between p-4 border-b">
                            <span className="mr-4">{point[0]}</span>
                            <span>{point[1]}</span>
                        </div>) : (
                        <div key={index} className="flex items-center justify-between p-4 border-b">
                            <span className="mr-4">You</span>
                            <span>{point[1]}</span>
                        </div>
                        ))
                ))}
            </div>
        </div>
    );
}