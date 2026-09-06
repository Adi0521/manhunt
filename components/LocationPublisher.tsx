"use client";

import { useEffect, useRef, useState } from "react";
import supabase, { hasSupabaseEnv, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/utils/supabase";
import { useWakeLock } from "@/hooks/use-wake-lock";

const PUBLISH_INTERVAL_MS = 20000;

export default function LocationPublisher() {
  const locationRef = useRef<[number, number] | null>(null);
  const nameRef = useRef<string | null>(null);
  const [active, setActive] = useState(false);

  // Holds a screen wake lock for as long as this player is in a game, so the
  // phone doesn't auto-lock and freeze the tab mid-round.
  useWakeLock(active);

  useEffect(() => {
    nameRef.current = localStorage.getItem("mh_name");
    if (!nameRef.current) return;
    if (!navigator.geolocation) return;
    setActive(true);

    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        locationRef.current = [pos.coords.latitude, pos.coords.longitude];
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    async function publish() {
      const name = nameRef.current;
      const loc = locationRef.current;
      if (!name || !loc || !hasSupabaseEnv || !supabase) return;
      await supabase
        .from("locations")
        .upsert({ user: name, lat: loc[0], lng: loc[1], updated_at: new Date().toISOString() }, { onConflict: "user" });
    }

    // Fire-and-forget write that survives the page being frozen or unloaded.
    // The normal client would have its request cancelled on the way out.
    function flush() {
      const name = nameRef.current;
      const loc = locationRef.current;
      if (!name || !loc || !SUPABASE_URL || !SUPABASE_ANON_KEY) return;
      fetch(`${SUPABASE_URL}/rest/v1/locations?on_conflict=user`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify([
          { user: name, lat: loc[0], lng: loc[1], updated_at: new Date().toISOString() },
        ]),
        keepalive: true,
      }).catch(() => {});
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flush();
        return;
      }
      // Back in the foreground: the watcher may have been suspended, so grab a
      // fresh fix and publish it right away instead of waiting out the interval.
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          locationRef.current = [pos.coords.latitude, pos.coords.longitude];
          void publish();
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    }

    const interval = setInterval(publish, PUBLISH_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flush);

    return () => {
      navigator.geolocation.clearWatch(watcher);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  return null;
}
