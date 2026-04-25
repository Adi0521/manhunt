"use client";

import { useEffect, useRef } from "react";
import supabase, { hasSupabaseEnv } from "@/app/utils/supabase";

export default function LocationPublisher() {
  const locationRef = useRef<[number, number] | null>(null);
  const nameRef = useRef<string | null>(null);

  useEffect(() => {
    nameRef.current = localStorage.getItem("mh_name");
    if (!nameRef.current) return;

    if (!navigator.geolocation) return;

    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        locationRef.current = [pos.coords.latitude, pos.coords.longitude];
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    const interval = setInterval(async () => {
      const name = nameRef.current;
      const loc = locationRef.current;
      if (!name || !loc || !hasSupabaseEnv || !supabase) return;
      await supabase
        .from("locations")
        .upsert({ user: name, lat: loc[0], lng: loc[1], updated_at: new Date().toISOString() }, { onConflict: "user" });
    }, 20000);

    return () => {
      navigator.geolocation.clearWatch(watcher);
      clearInterval(interval);
    };
  }, []);

  return null;
}
