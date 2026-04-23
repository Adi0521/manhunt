"use client"

import { useState, useEffect, useRef } from "react";

import supabase, { hasSupabaseEnv } from "./utils/supabase";

import RealtimeStream from "./realtime/realtime-stream";
import PointsStream from "./realtime/realtime-points";
import CurrentChallengeStream from "./realtime/realtime-currentchallenge";
import AllTasksStream from "./realtime/realtime-alltasks";
import CurrentTimeoutStream from "./realtime/realtime-timeout";
import PointsStreamSelf from "./realtime-self/realtime-points";
import AllTasksStreamSelf from "./realtime-self/realtime-alltasks";

import generateChallenge from "./utils/manhunt";

import { Button } from "@/components/ui/button";
import { toast } from "sonner"

export default function HomePage() {

  const [playerName, setPlayerName] = useState<string>("");
  const [hunts, setHunts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentChallenge, setCurrentChallenge] = useState<[string, number]>(["", 0]);
  const [pastChallenges, setPastChallenges] = useState<[string, number, number][]>([]);
  const [currentPoints, setCurrentPoints] = useState<number>(0);
  const [timeOutStatus, setTimeOutStatus] = useState<number>(0);
  const [lastVetoTime, setLastVetoTime] = useState<Date>(new Date());
  const [timeOutElapsedTime, setTimeOutElapsedTime] = useState<number>(0);
  const [huntTime, setHuntTime] = useState<number>();

  const timeOutStatusRef = useRef<{ current: number }>({ current: timeOutStatus });

  const [everyonePoints, setEveryonePoints] = useState<[string, number][]>([]);
  const [otherCurrentChallenge, setOtherCurrentChallenge] = useState<[string, number]>(["", 0]);
  const [otherChallenges, setOtherChallenges] = useState<[string, number, number][]>([]);

  if (!hasSupabaseEnv || !supabase) {
    return (
      <div className="min-h-screen bg-stone-300 dark:bg-neutral-900 text-slate-900 dark:text-slate-100">
        <div className="w-full bg-slate-800 dark:bg-[rgb(20,77,128)] text-white" style={{ height: "40px" }}>
          <h1 className="absolute l-0 m-2">Manhunt</h1>
        </div>
        <div className="max-w-xl mx-auto mt-32 p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700">
          <h2 className="text-xl font-semibold">Supabase not configured</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to use the game.
          </p>
        </div>
      </div>
    );
  }

  const sb = supabase as NonNullable<typeof supabase>;

  function initializeStuff(name: string) {
    setPlayerName(name);

    let recentRunId = 0;

    sb
      .from("hunts")
      .select()
      .then(async ({ data }) => {
        const datasorted = data?.sort((a, b) => {
          if (!a.id || !b.id) return 0;
          return a.id - b.id;
        });

        setHunts(datasorted ?? []);
        setLoading(false);

        if (datasorted && datasorted.length > 0) {
          recentRunId = datasorted[datasorted.length - 1].id;

          const { data: huntData } = await sb
            .from("hunts")
            .select()
            .eq('id', recentRunId);

          if (huntData && huntData[0] && huntData[0].status && huntData[0].status == 1) {
            setTimeOutStatus(1);

            const currentTime = new Date();

            let usePlayer = name;
            if (!huntData[0].runners?.includes(name)) {
              usePlayer = huntData[0].runners?.[0] ?? name;
            }

            let { data } = await sb
              .from("tasks")
              .select()
              .eq('user', usePlayer);

            data = data?.sort((a, b) => {
              if (!a.id || !b.id) return 0;
              return a.id - b.id;
            }) ?? null;

            if (data && data.length > 0) {
              const lastVetoTime1 = new Date(data[data.length - 1].created_at);
              const timeDiff = Math.floor((currentTime.valueOf() - lastVetoTime1.valueOf()) / 1000);
              setLastVetoTime(lastVetoTime1);
              setTimeOutElapsedTime(timeDiff);
            }
          }

          if (huntData && huntData[0] && huntData[0].runners && huntData[0].runners[0]) {
            sb
              .from("drawntasks")
              .select()
              .eq('user', huntData[0].runners[0])
              .then(({ data }) => {
                if (data && data.length > 0) {
                  setOtherCurrentChallenge([data[data.length-1].task, data[data.length-1].points]);
                }
              });

            sb
              .from("tasks")
              .select()
              .eq('user', huntData[0].runners[0])
              .then(({ data }) => {
                const datasorted = data?.sort((a, b) => {
                  if (!a.id || !b.id) return 0;
                  return a.id - b.id;
                });
                if (datasorted && datasorted.length > 0) {
                  for (let i = 0; i < datasorted.length; i++) {
                    setOtherChallenges((prev) => [...prev, [datasorted[i].task, datasorted[i].points, datasorted[i].status]]);
                  }
                }
              });
          }
        }
      });

    sb
      .from("points")
      .select()
      .eq('user', name)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setCurrentPoints(data[0].points);
        }
      });

    sb
      .from("points")
      .select()
      .then(({ data }) => {
        if (data && data.length > 0) {
          setEveryonePoints(data.map((item: any) => [item.user, item.points]));
        } else {
          setEveryonePoints([]);
        }
      });

    sb
      .from("tasks")
      .select()
      .eq('user', name)
      .then(({ data }) => {
        const datasorted = data?.sort((a, b) => {
          if (!a.id || !b.id) return 0;
          return a.id - b.id;
        });
        if (datasorted && datasorted.length > 0) {
          for (let i = 0; i < datasorted.length; i++) {
            setPastChallenges((prev) => [...prev, [datasorted[i].task, datasorted[i].points, datasorted[i].status]]);
          }
        }
      });

    sb
      .from("drawntasks")
      .select()
      .eq('user', name)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setCurrentChallenge([data[data.length-1].task, data[data.length-1].points]);
        }
      });
  }

  useEffect(() => {
    timeOutStatusRef.current.current = timeOutStatus;
  }, [timeOutStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (timeOutStatusRef.current.current === 1) {
        const currentTime = new Date();
        const timeDiff = Math.floor((currentTime.valueOf() - lastVetoTime.valueOf()) / 1000);
        if (timeDiff >= 5 * 60) {
          setTimeOutStatus(0);
          setTimeOutElapsedTime(0);
          revokeVeto();
        }
        setTimeOutElapsedTime(timeDiff);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [lastVetoTime]);

  useEffect(() => {
    const interval = setInterval(() => {
      setHunts((prevHunts) => {
        if (prevHunts.length > 0 && prevHunts[prevHunts.length - 1].created_at) {
          const startTime = new Date(prevHunts[prevHunts.length - 1].created_at);
          const timeDiff = Math.floor((new Date().valueOf() - startTime.valueOf()) / 1000);
          setHuntTime(timeDiff);
        }
        return prevHunts;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const name = localStorage.getItem("mh_name");
    if (!name) {
      window.location.href = "/auth";
      return;
    }
    initializeStuff(name);
  }, []);

  async function saveDrawnTasks(user: string, task: string, points: number) {
    await sb.from('drawntasks').insert({ user, task, points });
  }

  async function deleteDrawnTasks(user: string) {
    await sb.from('drawntasks').delete().eq('user', user);
  }

  async function revokeVeto() {
    const recentRunId = hunts[hunts.length - 1].id;
    await sb.from('hunts').update({ status: 0 }).eq('id', recentRunId);
    location.reload();
  }

  function makeChallenge() {
    const challenge = generateChallenge();
    setCurrentChallenge([challenge[0] as string, challenge[1] as number]);
    for (const runner of hunts[hunts.length - 1].runners) {
      saveDrawnTasks(runner, challenge[0] as string, challenge[1] as number);
    }
  }

  async function upsertPoints(user: string, newPoints: number) {
    const { data } = await sb.from('points').select().eq('user', user);
    let oldPoints = 0;
    if (!data || data.length === 0) {
      await sb.from('points').insert({ user, points: 0 });
    } else {
      oldPoints = data[0].points;
    }
    await sb.from('points').update({ points: newPoints + oldPoints }).eq('user', user);
  }

  async function saveTask(user: string, task: string, points: number, status: number) {
    await sb.from('tasks').insert({ user, task, points, status });
  }

  function completeChallenge() {
    if (currentChallenge[0] === "") { alert("No challenge to complete"); return; }
    setCurrentPoints((prev) => prev + currentChallenge[1]);
    toast("Challenge completed!");
    for (const runner of hunts[hunts.length - 1].runners) {
      upsertPoints(runner, currentChallenge[1]);
      saveTask(runner, currentChallenge[0], currentChallenge[1], 1);
      deleteDrawnTasks(runner);
    }
    setCurrentChallenge(["", 0]);
  }

  function skipChallenge() {
    if (currentChallenge[0] === "") { alert("No challenge to complete"); return; }
    setCurrentPoints(currentPoints - 1);
    toast("Challenge skipped!");
    for (const runner of hunts[hunts.length - 1].runners) {
      upsertPoints(runner, -1);
      saveTask(runner, currentChallenge[0], currentChallenge[1], 2);
      deleteDrawnTasks(runner);
    }
    setCurrentChallenge(["", 0]);
  }

  async function vetoChallenge() {
    if (currentChallenge[0] === "") { alert("No challenge to complete"); return; }
    setPastChallenges([...pastChallenges, [currentChallenge[0], currentChallenge[1], 0]]);
    setCurrentChallenge(["", 0]);
    toast("Challenge vetoed. You must wait 5 minutes to generate a new one.");
    for (const runner of hunts[hunts.length - 1].runners) {
      saveTask(runner, currentChallenge[0], currentChallenge[1], 0);
      deleteDrawnTasks(runner);
    }
    const recentRunId = hunts[hunts.length - 1].id;
    await sb.from('hunts').update({ status: 1 }).eq('id', recentRunId);
    setTimeOutStatus(1);
    location.reload();
  }

  const isRunner = hunts.length > 0 && hunts[hunts.length - 1].runners?.includes(playerName);
  const isHunterOrSpectator = hunts.length > 0 && !hunts[hunts.length - 1].runners?.includes(playerName);

  return (
    <>
      <div className="w-full bg-slate-800 dark:bg-[rgb(20,77,128)] text-white" style={{ height: "40px" }}>
        <h1 className="absolute l-0 m-2">Manhunt • {playerName}</h1>
        <div className="absolute right-0 top-0 flex gap-2 p-2">
          <Button
            className="h-6 bg-slate-600 dark:bg-slate-700 dark:text-slate-200"
            style={{ height: "30px" }}
            onClick={() => { window.location.href = "/map"; }}
          >
            Map
          </Button>
          <Button
            className="h-6 bg-blue-400 dark:bg-slate-800 dark:text-slate-200"
            style={{ height: "30px" }}
            onClick={() => { window.location.href = "/auth"; }}
          >
            Menu
          </Button>
        </div>
      </div>
      <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] bg-stone-300 dark:bg-neutral-900">
        <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">

          {hunts[hunts.length-1] == undefined ? (
            <h1 className="text-5xl font-bold">Loading...</h1>
          ) : !hunts[hunts.length-1].runners ? (
            <>
              <h1 className="text-5xl font-bold">Complete!</h1>
              <h1 className="font-bold">Runners</h1>
              {hunts.length >= 2 && hunts[hunts.length-2]?.runners?.map((runner: string, index: number) => (
                runner === playerName ? (
                  <h2 key={index} className="m-0">You</h2>
                ) : (
                  <h2 key={index} className="m-0">{runner}</h2>
                )
              ))}
              <h1 className="font-bold">have completed their run.</h1>
            </>
          ) : null}

          <div className={(hunts[hunts.length-1] == undefined || !hunts[hunts.length-1].runners) ? 'hidden' : undefined}>
            {(hunts.length == 0 || !hunts[0]) ? (
              <h1>No hunts</h1>
            ) : (
              <>
                <CurrentTimeoutStream timeOutStatusRef={timeOutStatusRef} timeOutElapsedTime={timeOutElapsedTime} />

                {!loading && (
                  <>
                    <RealtimeStream serverData={hunts ?? []} />
                    {isHunterOrSpectator && (huntTime ?? 0) < (60*30) && (
                      <>
                        <PointsStream pointsArr={everyonePoints ?? []} />
                        <CurrentChallengeStream theChallenge={otherCurrentChallenge ?? []} />
                        <AllTasksStream theChallenge={otherChallenges ?? []} />
                      </>
                    )}
                  </>
                )}

                {isRunner && (huntTime ?? 0) < (60*30) && (
                  <>
                    <PointsStreamSelf selfPoints={currentPoints} user={playerName} challenge={currentChallenge} timeOutStatus={timeOutStatus} onChallengeChange={setCurrentChallenge}/>
                    {timeOutStatus == 0 && (
                      <>
                        {currentChallenge[0] !== "" ? (
                          <>
                            {(huntTime ?? 0) > (60*3) && (
                              <div className="flex gap-[24px] flex-wrap items-center justify-center">
                                <Button className="bg-green-400" onClick={completeChallenge}>Complete</Button>
                                <Button className="bg-yellow-400" onClick={skipChallenge}>Skip</Button>
                                <Button className="bg-red-400" onClick={vetoChallenge}>Veto</Button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center">
                            <Button className="bg-blue-400" onClick={makeChallenge}>Generate Challenge</Button>
                          </div>
                        )}
                      </>
                    )}

                    <h1 className="text-2xl font-bold text-center m-4 mt-8">Past Challenges</h1>
                    <AllTasksStreamSelf theChallenge={pastChallenges} user={playerName}/>
                  </>
                )}
              </>
            )}
          </div>

        </main>
        <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center" />
      </div>
    </>
  );
}
