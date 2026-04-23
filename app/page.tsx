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
  const [lobbyPlayers, setLobbyPlayers] = useState<string[]>([]);
  const [pairs, setPairs] = useState<any[]>([]);

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
    setPlayerGameCode(code);

    if (code) {
      sb.from("players").select("name").eq("game_code", code).then(({ data }) => {
        setLobbyPlayers(data?.map((p: any) => p.name) ?? []);
      });
      sb.from("pairs").select().eq("game_code", code).then(({ data }) => {
        setPairs(data ?? []);
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
    if (!playerGameCode || !hasSupabaseEnv || !supabase) return;
    const channel = sb.channel("pairs-lobby")
      .on("postgres_changes", { event: "*", schema: "public", table: "pairs" }, () => {
        sb.from("pairs").select().eq("game_code", playerGameCode).then(({ data }) => {
          setPairs(data ?? []);
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "players" }, (payload) => {
        if ((payload.new as any).game_code === playerGameCode) {
          setLobbyPlayers((prev) => prev.includes((payload.new as any).name) ? prev : [...prev, (payload.new as any).name]);
        }
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [playerGameCode]);

  async function sendPairRequest(target: string) {
    if (!playerGameCode) return;
    await sb.from("pairs").delete().eq("requester", playerName).eq("confirmed", false);
    await sb.from("pairs").insert({ requester: playerName, partner: target, game_code: playerGameCode, confirmed: false });
    toast(`Pair request sent to ${target}`);
  }

  async function acceptPairRequest(pairId: number) {
    await sb.from("pairs").update({ confirmed: true }).eq("id", pairId);
    toast("Paired up!");
  }

  async function declinePairRequest(pairId: number) {
    await sb.from("pairs").delete().eq("id", pairId);
  }

  async function unpair() {
    const myPair = pairs.find((p: any) =>
      (p.requester === playerName || p.partner === playerName) && p.confirmed
    );
    if (myPair) await sb.from("pairs").delete().eq("id", myPair.id);
  }

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
                (p.requester === playerName || p.partner === playerName) && p.confirmed
              );
              const incomingRequest = pairs.find((p: any) =>
                p.partner === playerName && !p.confirmed
              );
              const outgoingRequest = pairs.find((p: any) =>
                p.requester === playerName && !p.confirmed
              );
              const pairedSet = new Set(confirmedPairs.flatMap((p: any) => [p.requester, p.partner]));
              const availablePlayers = lobbyPlayers.filter(
                (p: string) => p !== playerName && !pairedSet.has(p)
              );
              return (
                <div className="flex flex-col gap-4 w-full max-w-sm">
                  {hunts.length >= 2 && hunts[hunts.length-2]?.runners && (
                    <div className="text-center mb-2">
                      <h1 className="text-3xl font-bold">Round Complete!</h1>
                      <p className="text-slate-500 text-sm">
                        Runners: {hunts[hunts.length-2].runners.join(" & ")}
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
                      <button
                        className="text-xs text-slate-400 hover:text-slate-600 underline"
                        onClick={unpair}
                      >
                        Change partner
                      </button>
                    </div>
                  ) : incomingRequest ? (
                    <div className="flex flex-col gap-3 items-center bg-blue-50 dark:bg-blue-950 p-4 rounded-xl">
                      <p className="text-center">
                        <strong>{incomingRequest.requester}</strong> wants to be your partner
                      </p>
                      <div className="flex gap-3">
                        <Button className="bg-green-400 hover:bg-green-500 text-black" onClick={() => acceptPairRequest(incomingRequest.id)}>Accept</Button>
                        <Button className="bg-red-400 hover:bg-red-500 text-white" onClick={() => declinePairRequest(incomingRequest.id)}>Decline</Button>
                      </div>
                    </div>
                  ) : outgoingRequest ? (
                    <div className="flex flex-col gap-2 items-center text-center">
                      <p>Waiting for <strong>{outgoingRequest.partner}</strong> to accept…</p>
                      <button
                        className="text-xs text-slate-400 hover:text-slate-600 underline"
                        onClick={() => declinePairRequest(outgoingRequest.id)}
                      >
                        Cancel request
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-center text-sm text-slate-500">Choose your partner:</p>
                      {availablePlayers.length === 0 ? (
                        <p className="text-center text-sm text-slate-400 py-2">No available players yet.</p>
                      ) : (
                        availablePlayers.map((player: string) => (
                          <button
                            key={player}
                            className="p-3 rounded-md bg-gray-200 dark:bg-gray-700 text-center hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                            onClick={() => sendPairRequest(player)}
                          >
                            {player}
                          </button>
                        ))
                      )}
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
                          {pair.requester} & {pair.partner}
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
