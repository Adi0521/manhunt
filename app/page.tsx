"use client"

import { useState, useEffect, useRef } from "react";

import supabase, { hasSupabaseEnv } from "./utils/supabase";
import { getGameCode } from "./utils/player";

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

  const [showMenu, setShowMenu] = useState(false);

  const [playerGameCode, setPlayerGameCode] = useState<string>("");
  const [pairs, setPairs] = useState<any[]>([]);

  const [showFreezeTeamPicker, setShowFreezeTeamPicker] = useState(false);
  const [frozenSecondsLeft, setFrozenSecondsLeft] = useState(0);

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

    const code = getGameCode() ?? "";

    function loadLobbyData(c: string) {
      sb.from("pairs").select().eq("game_code", c).then(({ data }) => {
        setPairs(data ?? []);
      });
    }

    if (code) {
      setPlayerGameCode(code);
      loadLobbyData(code);
    } else {
      // mh_game_code missing from localStorage — look it up from the players table
      sb.from("players").select("game_code").eq("name", name).maybeSingle().then(({ data }) => {
        const fetchedCode = data?.game_code ?? "";
        if (fetchedCode) {
          localStorage.setItem("mh_game_code", fetchedCode);
          setPlayerGameCode(fetchedCode);
          loadLobbyData(fetchedCode);
        }
      });
    }

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

  useEffect(() => {
    if (!hasSupabaseEnv || !supabase) return;
    const channel = sb.channel("hunts-updates")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "hunts" }, (payload) => {
        const updated = payload.new as any;
        setHunts((prev) => prev.map((h) => h.id === updated.id ? { ...h, ...updated } : h));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hunts" }, () => {
        location.reload();
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const hunt = hunts[hunts.length - 1];
      if (hunt?.frozen_until) {
        const secs = Math.max(0, Math.floor((new Date(hunt.frozen_until).valueOf() - Date.now()) / 1000));
        setFrozenSecondsLeft(secs);
      } else {
        setFrozenSecondsLeft(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [hunts]);

  useEffect(() => {
    if (!playerGameCode || !hasSupabaseEnv || !supabase) return;
    const channel = sb.channel(`pairs-lobby:${playerGameCode}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pairs", filter: `game_code=eq.${playerGameCode}` }, () => {
        sb.from("pairs").select().eq("game_code", playerGameCode).then(({ data }) => {
          setPairs(data ?? []);
        });
      })
      .subscribe();

    const poll = setInterval(() => {
      sb.from("pairs").select().eq("game_code", playerGameCode).then(({ data }) => {
        setPairs(data ?? []);
      });
    }, 4000);

    return () => {
      sb.removeChannel(channel);
      clearInterval(poll);
    };
  }, [playerGameCode]);


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
    const finalPoints = newPoints + oldPoints;
    await sb.from('points').update({ points: finalPoints }).eq('user', user);

    const hunt = hunts[hunts.length - 1];
    const winThreshold = hunt?.win_points ?? 15;
    if (hunt?.runners?.includes(user) && finalPoints >= winThreshold) {
      toast(`${user} wins with ${finalPoints} points!`);
      await sb.from('hunts').insert({});
    }
  }

  async function saveTask(user: string, task: string, points: number, status: number) {
    await sb.from('tasks').insert({ user, task, points, status });
  }

  function completeChallenge() {
    if (currentChallenge[0] === "") { alert("No challenge to complete"); return; }
    const isFreezeChallenge = currentChallenge[0].toLowerCase().includes("selfie with another team");
    setCurrentPoints((prev) => prev + currentChallenge[1]);
    toast("Challenge completed!");
    for (const runner of hunts[hunts.length - 1].runners) {
      upsertPoints(runner, currentChallenge[1]);
      saveTask(runner, currentChallenge[0], currentChallenge[1], 1);
      deleteDrawnTasks(runner);
    }
    setCurrentChallenge(["", 0]);
    if (isFreezeChallenge) setShowFreezeTeamPicker(true);
  }

async function vetoChallenge() {
    if (currentChallenge[0] === "") { alert("No challenge to complete"); return; }
    if (currentChallenge[0].toLowerCase().includes("go drink water")) {
      toast("This challenge cannot be vetoed!");
      return;
    }
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

  async function tagRunners() {
    const hunt = hunts[hunts.length - 1];
    if (!hunt?.runners) return;

    const myPair = pairs.find((p: any) =>
      (p.requester === playerName || p.partner === playerName || p.third === playerName) && p.confirmed
    );
    const taggingTeam: string[] = myPair
      ? [myPair.requester, myPair.partner, ...(myPair.third ? [myPair.third] : [])]
      : [playerName];

    // Challenge #22 "Get tagged" — runner steals up to 3 pts from the tagger who clicked
    const { data: drawnTasks } = await sb.from("drawntasks").select().in("user", hunt.runners);
    const getTaggedActive = drawnTasks?.some((t: any) => t.task?.toLowerCase().includes("get tagged"));
    if (getTaggedActive) {
      const { data: taggerPtsData } = await sb.from("points").select().eq("user", playerName);
      const taggerPts = taggerPtsData?.[0]?.points ?? 0;
      const steal = Math.min(3, taggerPts);
      if (steal > 0) {
        await sb.from("points").update({ points: taggerPts - steal }).eq("user", playerName);
        for (const runner of hunt.runners) {
          await upsertPoints(runner, steal);
        }
        toast(`Runner steals ${steal} pts from you (Get Tagged card)!`);
      }
    }

    const newRunners = taggingTeam;
    const newHunters = [
      ...hunt.runners,
      ...hunt.hunters.filter((h: string) => !taggingTeam.includes(h)),
    ];

    await sb.from("hunts").update({ runners: newRunners, hunters: newHunters, paused: true }).eq("id", hunt.id);
    for (const runner of hunt.runners) {
      await deleteDrawnTasks(runner);
    }
    toast("Runners tagged! Waiting for admin to resume...");
  }

  async function freezeTeam(teamMembers: string[]) {
    const hunt = hunts[hunts.length - 1];
    if (!hunt) return;
    const frozenUntil = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    await sb.from("hunts").update({ frozen_team: teamMembers, frozen_until: frozenUntil }).eq("id", hunt.id);
    setShowFreezeTeamPicker(false);
    toast("That team is frozen for 3 minutes!");
  }

  const currentHunt = hunts.length > 0 ? hunts[hunts.length - 1] : null;
  const isRunner = hunts.length > 0 && hunts[hunts.length - 1].runners?.includes(playerName);
  const isHunter = !!currentHunt?.hunters?.includes(playerName);
  const isHunterOrSpectator = hunts.length > 0 && !hunts[hunts.length - 1].runners?.includes(playerName);
  const huntPaused = !!currentHunt?.paused;
  const isFrozen = !!currentHunt?.frozen_team?.includes(playerName) &&
    !!currentHunt?.frozen_until && new Date() < new Date(currentHunt.frozen_until);

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
            onClick={() => {
              if (playerName) setShowMenu(true);
              else window.location.href = "/auth";
            }}
          >
            Menu
          </Button>
        </div>
      </div>
      <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] bg-stone-300 dark:bg-neutral-900">
        <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">

          {loading ? (
            <h1 className="text-5xl font-bold">Loading...</h1>
          ) : (hunts.length === 0 || !hunts[hunts.length-1]?.runners) ? (
            (() => {
              const confirmedPairs = pairs.filter((p: any) => p.confirmed);
              const myConfirmedPair = pairs.find((p: any) =>
                (p.requester === playerName || p.partner === playerName || p.third === playerName) && p.confirmed
              );
              return (
                <div className="flex flex-col gap-4 w-full max-w-sm">
                  {hunts.length >= 2 && hunts[hunts.length-2]?.runners && (
                    <div className="text-center mb-2">
                      <h1 className="text-3xl font-bold">Round Complete!</h1>
                      <p className="text-slate-500 text-sm">
                        Runners: {hunts[hunts.length-2].runners.join(" + ")}
                      </p>
                    </div>
                  )}

                  <h2 className="text-2xl font-bold text-center">Lobby</h2>

                  {myConfirmedPair ? (
                    <div className="flex flex-col gap-2 items-center">
                      <div className="bg-green-100 dark:bg-green-900 p-4 rounded-xl text-center w-full">
                        <p className="text-xs text-slate-500 mb-1">Your partner</p>
                        <p className="text-xl font-bold">
                          {myConfirmedPair.requester === playerName ? myConfirmedPair.partner : myConfirmedPair.requester}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 items-center text-center py-2">
                      <p className="text-sm text-slate-500">Waiting for admin to assign your partner…</p>
                    </div>
                  )}

                  {confirmedPairs.length > 0 && (
                    <div className="mt-2">
                      <h3 className="text-base font-semibold text-center mb-2">All Pairs</h3>
                      {confirmedPairs.map((pair: any) => (
                        <div
                          key={pair.id}
                          className={`p-2 rounded-md text-center mb-1 text-sm ${
                            pair.requester === playerName || pair.partner === playerName
                              ? "bg-blue-200 dark:bg-blue-800"
                              : "bg-gray-100 dark:bg-gray-800"
                          }`}
                        >
                          {[pair.requester, pair.partner, ...(pair.third ? [pair.third] : [])].join(" + ")}
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-center text-xs text-slate-400 mt-2">
                    Waiting for admin to start the hunt…
                  </p>
                </div>
              );
            })()
          ) : null}

          <div className={(hunts[hunts.length-1] == undefined || !hunts[hunts.length-1].runners) ? 'hidden' : undefined}>
            {huntPaused && (
              <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center px-6">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center max-w-sm w-full flex flex-col gap-3">
                  <h2 className="text-2xl font-bold">Runners Tagged!</h2>
                  <p className="text-slate-500 text-sm">Regroup and wait for the admin to resume the game with the new runner team.</p>
                </div>
              </div>
            )}

            {(hunts.length == 0 || !hunts[0]) ? (
              <h1>No hunts</h1>
            ) : (
              <>
                <CurrentTimeoutStream timeOutStatusRef={timeOutStatusRef} timeOutElapsedTime={timeOutElapsedTime} />

                {!loading && (
                  <>
                    <RealtimeStream serverData={hunts ?? []} />
                    {isHunterOrSpectator && (huntTime ?? 0) < ((currentHunt?.rotation_minutes ?? 30) * 60) && (
                      <>
                        <PointsStream pointsArr={everyonePoints ?? []} />
                        <CurrentChallengeStream theChallenge={otherCurrentChallenge ?? []} />
                        <AllTasksStream theChallenge={otherChallenges ?? []} />

                        {isHunter && (huntTime ?? 0) > (60 * 3) && !huntPaused && (
                          <div className="mt-4 flex flex-col items-center gap-2">
                            {isFrozen ? (
                              <p className="text-blue-500 font-medium text-sm">
                                Frozen — {Math.floor(frozenSecondsLeft / 60)}m {frozenSecondsLeft % 60}s remaining
                              </p>
                            ) : (
                              <Button
                                className="bg-rose-600 hover:bg-rose-700 text-white px-6"
                                onClick={tagRunners}
                              >
                                Tag Runner Team
                              </Button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {isRunner && (huntTime ?? 0) < ((currentHunt?.rotation_minutes ?? 30) * 60) && (
                  <>
                    <PointsStreamSelf selfPoints={currentPoints} user={playerName} challenge={currentChallenge} timeOutStatus={timeOutStatus} onChallengeChange={setCurrentChallenge}/>
                    {timeOutStatus == 0 && (
                      <>
                        {currentChallenge[0] !== "" ? (
                          <>
                            {(huntTime ?? 0) > (60*3) && (
                              <div className="flex gap-[24px] flex-wrap items-center justify-center">
                                <Button className="bg-green-400" onClick={completeChallenge}>Complete</Button>
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

      {showFreezeTeamPicker && (() => {
        const hunt = hunts[hunts.length - 1];
        const runnerSet = new Set(hunt?.runners ?? []);
        const hunterPairs = pairs.filter((p: any) =>
          p.confirmed && !runnerSet.has(p.requester) && !runnerSet.has(p.partner)
        );
        return (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4">
              <h2 className="text-xl font-bold text-center">Freeze which team?</h2>
              <p className="text-sm text-slate-500 text-center">They can't tag you for 3 minutes.</p>
              {hunterPairs.map((p: any) => {
                const members = [p.requester, p.partner, ...(p.third ? [p.third] : [])];
                return (
                  <button
                    key={p.id}
                    className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900 text-center hover:bg-blue-200 dark:hover:bg-blue-800"
                    onClick={() => freezeTeam(members)}
                  >
                    {members.join(" & ")}
                  </button>
                );
              })}
              <button
                className="text-sm text-slate-400 hover:text-slate-600 text-center"
                onClick={() => setShowFreezeTeamPicker(false)}
              >
                Skip
              </button>
            </div>
          </div>
        );
      })()}

      {showMenu && (() => {
        const activeHunt = hunts.length > 0 && hunts[hunts.length - 1]?.runners ? hunts[hunts.length - 1] : null;
        const vetoSecondsLeft = Math.max(0, 300 - timeOutElapsedTime);
        const displayChallenge = isRunner ? currentChallenge : otherCurrentChallenge;
        const leaderboard = [...everyonePoints].sort((a, b) => b[1] - a[1]);
        return (
          <div
            className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-12 px-4"
            onClick={() => setShowMenu(false)}
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm flex flex-col gap-5 p-6 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Menu</h2>
                <button
                  className="text-slate-400 hover:text-slate-600 text-3xl leading-none"
                  onClick={() => setShowMenu(false)}
                >×</button>
              </div>

              {activeHunt && (
                <>
                  <div>
                    <h3 className="font-semibold mb-2 text-sm uppercase tracking-wide text-slate-500">Runners</h3>
                    <p className="font-medium">{activeHunt.runners.join(" & ")}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 text-sm uppercase tracking-wide text-slate-500">Challenge</h3>
                    {timeOutStatus === 1 ? (
                      <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-3">
                        <p className="text-orange-600 dark:text-orange-400 font-medium">Veto cooldown</p>
                        <p className="text-sm text-orange-500">{Math.floor(vetoSecondsLeft / 60)}m {vetoSecondsLeft % 60}s remaining</p>
                      </div>
                    ) : displayChallenge[0] ? (
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                        <p className="text-sm">{displayChallenge[0]}</p>
                        <p className="text-xs text-slate-400 mt-1">{displayChallenge[1]} pts</p>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">No active challenge</p>
                    )}
                  </div>
                </>
              )}

              <div>
                <h3 className="font-semibold mb-2 text-sm uppercase tracking-wide text-slate-500">
                  Leaderboard
                </h3>
                {leaderboard.length === 0 ? (
                  <p className="text-sm text-slate-400">No points yet.</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {leaderboard.map(([name, pts], i) => (
                      <div
                        key={name}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                          name === playerName
                            ? "bg-blue-100 dark:bg-blue-900 font-semibold"
                            : "bg-slate-50 dark:bg-slate-800"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-slate-400 w-5 text-right">{i + 1}.</span>
                          <span>{name}{name === playerName ? " (you)" : ""}</span>
                        </span>
                        <span className="font-mono">{pts} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                className="text-sm text-rose-500 hover:text-rose-700 text-center pt-1 border-t border-slate-200 dark:border-slate-700"
                onClick={() => { window.location.href = "/auth"; }}
              >
                Leave / Switch Game
              </button>
            </div>
          </div>
        );
      })()}
    </>
  );
}
