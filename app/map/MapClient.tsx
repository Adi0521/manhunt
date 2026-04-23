"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer, useMapEvents } from "react-leaflet";
import type { LeafletMouseEvent } from "leaflet";
import supabase, { hasSupabaseEnv } from "../utils/supabase";

type Point = [number, number];

type PlayerLocation = {
  user: string;
  lat: number;
  lng: number;
};

function MapClickHandler({ enabled, onAddPoint }: { enabled: boolean; onAddPoint: (p: Point) => void }) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      if (enabled) onAddPoint([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export default function MapClient() {
  const [playerName, setPlayerName] = useState<string>("");
  const [currentLocation, setCurrentLocation] = useState<Point | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [boundary, setBoundary] = useState<Point[]>([]);
  const [players, setPlayers] = useState<PlayerLocation[]>([]);
  const [hunt, setHunt] = useState<any>(null);
  const [mapKey] = useState(() => Math.random().toString(36).slice(2));
  const locationRef = useRef<Point | null>(null);

  useEffect(() => {
    const name = localStorage.getItem("mh_name");
    if (!name) { window.location.href = "/auth"; return; }
    setPlayerName(name);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setPermissionError("Geolocation is not supported by this browser.");
      return;
    }
    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        const point: Point = [pos.coords.latitude, pos.coords.longitude];
        setCurrentLocation(point);
        locationRef.current = point;
        setPermissionError(null);
      },
      (err) => setPermissionError(err.message || "Unable to access location."),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  useEffect(() => {
    if (!hasSupabaseEnv || !supabase) return;
    supabase
      .from("hunts")
      .select()
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const sorted = [...data].sort((a, b) => a.id - b.id);
        const latest = sorted[sorted.length - 1];
        if (latest?.runners) {
          setHunt(latest);
          if (Array.isArray(latest.boundary) && latest.boundary.length >= 3) {
            setBoundary(latest.boundary as Point[]);
          }
        }
      });
  }, []);

  useEffect(() => {
    if (!hasSupabaseEnv || !supabase) return;

    supabase
      .from("locations")
      .select()
      .then(({ data }) => {
        if (data) setPlayers(data as PlayerLocation[]);
      });

    const channel = supabase
      .channel("locations-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const old = payload.old as PlayerLocation;
          setPlayers((prev) => prev.filter((p) => p.user !== old.user));
        } else {
          const loc = payload.new as PlayerLocation;
          setPlayers((prev) => {
            const rest = prev.filter((p) => p.user !== loc.user);
            return [...rest, loc];
          });
        }
      })
      .subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!playerName || !hasSupabaseEnv || !supabase) return;
    const interval = setInterval(async () => {
      const loc = locationRef.current;
      if (!loc) return;
      await supabase!
        .from("locations")
        .upsert({ user: playerName, lat: loc[0], lng: loc[1], updated_at: new Date().toISOString() }, { onConflict: "user" });
    }, 5000);
    return () => clearInterval(interval);
  }, [playerName]);

  const mapCenter = useMemo(() => currentLocation ?? [51.505, -0.09], [currentLocation]);

  const insideBoundary = useMemo(() => {
    if (!currentLocation || boundary.length < 3) return null;
    return pointInPolygon(currentLocation, boundary);
  }, [boundary, currentLocation]);

  const boundaryStatus =
    insideBoundary === null ? "No boundary set." : insideBoundary ? "In bounds" : "Out of bounds";
  const boundaryStatusColor =
    insideBoundary === null ? "text-slate-500" : insideBoundary ? "text-emerald-600" : "text-rose-600";

  function playerColor(user: string) {
    if (!hunt) return "#94a3b8";
    if (hunt.runners?.includes(user)) return "#ef4444";
    if (hunt.hunters?.includes(user)) return "#3b82f6";
    return "#94a3b8";
  }

  function playerRole(user: string) {
    if (!hunt) return "Spectator";
    if (hunt.runners?.includes(user)) return "Runner";
    if (hunt.hunters?.includes(user)) return "Hunter";
    return "Spectator";
  }

  const allPlayers = useMemo(() => {
    if (!playerName) return players;
    if (players.some((p) => p.user === playerName)) return players;
    return currentLocation
      ? [...players, { user: playerName, lat: currentLocation[0], lng: currentLocation[1] }]
      : players;
  }, [players, playerName, currentLocation]);

  return (
    <div className="min-h-screen bg-stone-200 dark:bg-neutral-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h1 className="text-3xl font-semibold">Manhunt Map</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Live player tracking — runners in red, hunters in blue.
            </p>
          </div>
          <button
            className="rounded-lg px-4 py-2 bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 text-sm"
            onClick={() => (window.location.href = "/")}
          >
            Back to game
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="h-[70vh] rounded-3xl overflow-hidden border border-slate-300 dark:border-slate-700 shadow-sm">
            <MapContainer
              key={mapKey}
              center={mapCenter as [number, number]}
              zoom={16}
              scrollWheelZoom
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {boundary.length >= 3 && (
                <Polygon
                  positions={boundary as [number, number][]}
                  pathOptions={{ color: "#16a34a", fillColor: "rgba(16,163,127,0.15)", weight: 3 }}
                />
              )}

              {allPlayers.map((p) => {
                const isSelf = p.user === playerName;
                const color = isSelf ? "#1d4ed8" : playerColor(p.user);
                const fill = isSelf ? "#60a5fa" : playerColor(p.user);
                return (
                  <CircleMarker
                    key={p.user}
                    center={[p.lat, p.lng]}
                    radius={isSelf ? 12 : 10}
                    pathOptions={{ color, fillColor: fill, fillOpacity: isSelf ? 0.9 : 0.75 }}
                  >
                    <Popup>
                      {isSelf ? `You (${p.user})` : p.user}
                      <br />
                      {playerRole(p.user)}
                    </Popup>
                  </CircleMarker>
                );
              })}

              <MapClickHandler enabled={false} onAddPoint={() => {}} />
            </MapContainer>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Your Status</h2>
              <div className="mt-4 flex flex-col gap-3">
                <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">GPS</div>
                  <div className="mt-2 text-base font-medium">
                    {permissionError
                      ? <span className="text-rose-500">{permissionError}</span>
                      : currentLocation
                      ? `${currentLocation[0].toFixed(5)}, ${currentLocation[1].toFixed(5)}`
                      : "Waiting for GPS..."}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Boundary</div>
                  <div className={`mt-2 text-base font-semibold ${boundaryStatusColor}`}>{boundaryStatus}</div>
                </div>
                <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Your role</div>
                  <div className="mt-2 text-base font-medium">
                    {playerName ? playerRole(playerName) : "—"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Players</h2>
              <div className="mt-4 space-y-2">
                {allPlayers.length === 0 ? (
                  <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 p-4 text-sm text-slate-500">
                    No players on map yet.
                  </div>
                ) : (
                  allPlayers.map((p) => {
                    const isSelf = p.user === playerName;
                    const color = isSelf ? "#1d4ed8" : playerColor(p.user);
                    return (
                      <div
                        key={p.user}
                        className="rounded-2xl bg-slate-100 dark:bg-slate-800 p-3 text-sm flex items-center gap-2"
                      >
                        <span
                          className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="flex-1 truncate">{isSelf ? `You (${p.user})` : p.user}</span>
                        <span className="text-xs text-slate-500">{playerRole(p.user)}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
