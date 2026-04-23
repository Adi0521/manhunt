"use client"


import { useState, useEffect, useRef } from "react";

import supabase, { hasSupabaseEnv } from "../utils/supabase";
// import adminAuthClient from "../utils/supabase-auth";
import type { Session } from '@supabase/supabase-js';

import { Button } from "@/components/ui/button";

import { toast } from "sonner";

type UserListProps = {
    users: string[];
};

export default function UserList({ users }: UserListProps) {

    const [session, setSession] = useState<Session | null>(null)

    const [hunts, setHunts] = useState<any[]>([]);

    const [tab, setTab] = useState<"teams" | "adjustment">("teams");

    const [everyonePoints, setEveryonePoints] = useState<[string, number][]>([]);

    useEffect(() => {
        if (!hasSupabaseEnv || !supabase) return;

        supabase
            .from("hunts")
            .select()
            .then(async ({ data }) => {
                const datasorted = data?.sort((a, b) => {
                    if (!a.id || !b.id) {
                        return 0;
                    }
                    return a.id - b.id;
                });

                setHunts(datasorted ?? []);
            });
    }, []);

    useEffect(() => {
    if (!hasSupabaseEnv || !supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
    })

    const {
        data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
    })

    return () => subscription.unsubscribe()
    }, [])

    // useEffect(() => {
    //     async function fetchUsers() {
    //         const users = await getUsers();
    //         setUserList(users);
    //     }
    //     fetchUsers();
    // }, []);

    async function getPoints() {
        if (!hasSupabaseEnv || !supabase) return;

        supabase
        .from("points")
        .select("user, points")
        .then(({ data, error }) => {
            if (error) {
            console.error("Error fetching points:", error);
            }
            console.log("Data37: ", data);

            if (data && data.length > 0) {
            const sortedData = data
                .slice()
                .sort((a: any, b: any) => a.user.localeCompare(b.user));
            setEveryonePoints(sortedData.map((item: any) => [item.user, item.points]));
            } else {
            setEveryonePoints([]);
            }
        });
    }

    useEffect(() => {
        getPoints();
    }, []);

    // console.log(getUsers());
    // clientFetchUsers();


    async function startRun(runners : string[], hunters: string[]) {
        if (!hasSupabaseEnv || !supabase) {
            toast("Supabase not configured.");
            return;
        }

        if (runners.length == 0 || hunters.length == 0) {
            toast("Please select at least one runner and one hunter");
            return;
        }

        const { error } = await supabase.from('hunts').insert({ runners, hunters});
        if (error) {
            console.error(error);
        } else {
            toast("Hunt started");
        }

        supabase
            .from("hunts")
            .select()
            .then(async ({ data }) => {
                const datasorted = data?.sort((a, b) => {
                    if (!a.id || !b.id) {
                        return 0;
                    }
                    return a.id - b.id;
                });

                setHunts(datasorted ?? []);
            });
    }

    async function handleSubmit() {

        let runnersArray = [];
        let huntersArray = [];

        let i = 0;
        while (i < users.length) {
            const checkElement = document.getElementById("checkbox"+users[i]);
            const divElement = document.getElementById("div"+users[i]);

            if (!(checkElement as HTMLInputElement)?.checked){
                runnersArray.push(users[i]);
                    
                divElement?.classList.remove("bg-green-200");
                divElement?.classList.add("bg-gray-200");
                divElement?.classList.remove("dark:bg-green-400");
                divElement?.classList.add("dark:bg-gray-800");
                
                (checkElement as HTMLInputElement).checked = true;

            } else {
                huntersArray.push(users[i]);
            }
            i++;
        }

        startRun(runnersArray, huntersArray);
    }

    async function terminate() {
        if (!hasSupabaseEnv || !supabase) {
            toast("Supabase not configured.");
            return;
        }

        if (hunts[hunts.length - 1].runners){
            toast("Hunt terminated");
            
            const { error } = await supabase.from('hunts').insert({});
            setHunts((prev : any) => [...prev, { id: null, runners: null, hunters: null, created_at: null }]);
        } else {
            toast("Hunt already terminated; no effect")
        }
    }

    function handleHighlight(id: string) {
        console.log("highlighting",id);
        const checkElement = document.getElementById("checkbox"+id);
        const divElement = document.getElementById("div"+id);
        if ((checkElement as HTMLInputElement)?.checked){

            divElement?.classList.remove("bg-gray-200");
            divElement?.classList.remove("dark:bg-gray-800");
            divElement?.classList.add("dark:bg-green-400");
            divElement?.classList.add("bg-green-400");

            (checkElement as HTMLInputElement).checked = false;
        } else {
            divElement?.classList.remove("dark:bg-green-400");
            divElement?.classList.remove("bg-green-400");
            divElement?.classList.add("bg-gray-200");
            divElement?.classList.add("dark:bg-gray-800");

            (checkElement as HTMLInputElement).checked = true;
        }
    }


    async function modPoints(adjustment: number, user: string, prevpoints: number){
        if (!hasSupabaseEnv || !supabase) return;

        const { error } = await supabase
            .from("points")
            .update({ points: (prevpoints as number) + adjustment })
            .eq("user", user);
        if (!error) getPoints();
    }


    return (
        <>
            {(!hasSupabaseEnv || !supabase) ? (
                <div className="rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 p-6">
                    <h2 className="text-xl font-semibold">Supabase not configured</h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                        Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
                    </p>
                </div>
            ) : null}
            {(session && session.user.email == "skparab1@gmail.com") ? (
            <>
                <div className="flex flex-col gap-4">
                    <div className="flex mb-4 bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden">
                        <button
                            className={`flex-1 px-4 py-2 transition-colors duration-200 focus:outline-none ${
                                tab === "teams"
                                    ? "bg-gray-300 dark:bg-green-400 text-black font-bold"
                                    : "text-gray-500"
                            }`}
                            style={{ borderRadius: tab === "teams" ? "0.5rem 0 0 0.5rem" : "0.5rem 0 0 0.5rem" }}
                            onClick={() => setTab("teams")}
                        >
                            Teams
                        </button>
                        <button
                            className={`flex-1 px-4 py-2 transition-colors duration-200 focus:outline-none ${
                                tab === "adjustment"
                                    ? "bg-gray-300 dark:bg-green-400 text-black font-bold"
                                    : "text-gray-500"
                            }`}
                            style={{ borderRadius: tab === "adjustment" ? "0 0.5rem 0.5rem 0" : "0.5rem 0 0 0.5rem" }}
                            onClick={() => setTab("adjustment")}
                        >
                            Adjustment
                        </button>
                    </div>

                    {tab === "teams" && (
                        <>
                            <div className="flex flex-col gap-2">
                                <h1 className="text-2xl text-center">Select Runners</h1>
                                {users.map((user: string) => (
                                    <div key={user} id={"div"+user} className="bg-gray-200 p-2 rounded-md w-full transition-all duration-200 text-center dark:bg-gray-800" onClick={() => handleHighlight(user)}>
                                        <input
                                            id={"checkbox"+user}
                                            type="checkbox"
                                            className="m-2 hidden"
                                            onChange={() => handleHighlight(user)}
                                            defaultChecked
                                        />
                                        <label>{user}</label>
                                    </div>
                                ))}
                            </div>

                            <Button onClick={() => handleSubmit()}>
                                Start Hunt
                            </Button>

                            <Button onClick={() => terminate()}>
                                Terminate current hunt
                            </Button>

                            <div className="flex flex-col gap-2">
                                <h1 className="text-2xl text-center">Previous Hunts</h1>
                                {[...hunts].reverse().map((hunt: any) => (
                                    (hunt.runners && (
                                        <div
                                            key={hunt.id}
                                            className={`p-2 rounded-md w-full text-center ${
                                                hunt.id === hunts[hunts.length - 1]?.id ? "bg-green-400" : "bg-gray-400"
                                            }`}
                                        >
                                            <h2 className="font-bold">Runners:</h2>
                                            <ul>
                                                {hunt.runners?.map((runner: string) => (
                                                    <li key={runner}>{runner}</li>
                                                ))}
                                            </ul>
                                            <h2 className="font-bold mt-2">Hunters:</h2>
                                            <ul>
                                                {hunt.hunters?.map((hunter: string) => (
                                                    <li key={hunter}>{hunter}</li>
                                                ))}
                                            </ul>
                                            <h2 className="font-bold mt-2 mb-2">{new Date(hunt.created_at).toLocaleString()}</h2>
                                            <Button onClick={() => startRun(hunt.runners || [], hunt.hunters || [])}>
                                                Run again
                                            </Button>
                                        </div>
                                    ))
                                ))}
                            </div>
                        </>
                    )}

                    {tab === "adjustment" && (
                        <div className="flex flex-col gap-4 items-center">
                            <div className="flex flex-col gap-2">
                            <h1 className="text-2xl text-center">Points Adjustment</h1>
                            {everyonePoints.map(([user, points]) => (
                                <div
                                    key={user}
                                    className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded w-full"
                                >
                                    <span>{user}</span>
                                    <div className="flex items-center gap-2 ml-4">
                                        <button
                                            className="px-2 py-1 rounded bg-red-200 dark:bg-red-600 text-black dark:text-white"
                                            onClick={async () => { modPoints(-1, user, points) }}
                                        >
                                            -
                                        </button>
                                        <span className="px-2">{points}</span>
                                        <button
                                            className="px-2 py-1 rounded bg-green-200 dark:bg-green-600 text-black dark:text-white"
                                            onClick={async () => { modPoints(1, user, points) }}
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            ))}
                            </div>
                        </div>
                    )}
                </div>
            </>
            ) : !session ? (
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl">Authenticating...</h1>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl text-center">You don't have access to this mang</h1>
                    <h1 className="text-2xl text-center">Please contact Jabari</h1>
                    <Button>
                        <a href="/">Forgive me, get me out of this</a>
                    </Button>
                </div>
            )}
        </>
    );
}

