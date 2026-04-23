"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, Polygon, Polyline, TileLayer, useMapEvents } from "react-leaflet";
import type { LeafletMouseEvent } from "leaflet";
import supabase, { hasSupabaseEnv } from "../utils/supabase";
import { toast } from "sonner";

type Point = [number, number];

function MapClickHandler({ enabled, onAddPoint }: { enabled: boolean; onAddPoint: (p: Point) => void }) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      if (enabled) onAddPoint([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

type Props = {
  huntId: number | null;
};

export default function BoundaryMapClient({ huntId }: Props) {
  const [boundaryPoints, setBoundaryPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mapCenter] = useState<Point>([51.505, -0.09]);
  const [mapKey] = useState(() => Math.random().toString(36).slice(2));
  const [gpsCenter, setGpsCenter] = useState<Point | null>(null);

  // Load existing boundary for this hunt
  useEffect(() => {
    if (!huntId || !hasSupabaseEnv || !supabase) return;
    supabase
      .from("hunts")
      .select("boundary")
      .eq("id", huntId)
      .single()
      .then(({ data }) => {
        if (data?.boundary && Array.isArray(data.boundary) && data.boundary.length >= 3) {
          setBoundaryPoints(data.boundary as Point[]);
        }
      });
  }, [huntId]);

  // Get browser location to center the map
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGpsCenter([pos.coords.latitude, pos.coords.longitude]),
      () => {}
    );
  }, []);

  const center = gpsCenter ?? mapCenter;

  async function saveBoundary() {
    if (!huntId || !hasSupabaseEnv || !supabase) {
      toast("No active hunt to save boundary to.");
      return;
    }
    if (boundaryPoints.length < 3) {
      toast("Draw at least 3 points to define a boundary.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("hunts")
      .update({ boundary: boundaryPoints })
      .eq("id", huntId);
    setSaving(false);
    if (error) {
      toast("Failed to save boundary.");
      console.error(error);
    } else {
      toast("Boundary saved!");
      setIsDrawing(false);
    }
  }

  async function clearBoundary() {
    setBoundaryPoints([]);
    setIsDrawing(false);
    if (!huntId || !hasSupabaseEnv || !supabase) return;
    await supabase.from("hunts").update({ boundary: null }).eq("id", huntId);
    toast("Boundary cleared.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button
          className={`rounded-lg px-4 py-2 border text-sm transition ${
            isDrawing
              ? "bg-blue-600 text-white border-blue-700"
              : "bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
          }`}
          onClick={() => {
            setBoundaryPoints([]);
            setIsDrawing(true);
          }}
        >
          Start drawing
        </button>
        <button
          className="rounded-lg px-4 py-2 text-sm bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
          onClick={() => setIsDrawing(false)}
          disabled={!isDrawing}
        >
          Finish drawing
        </button>
        <button
          className="rounded-lg px-4 py-2 text-sm bg-emerald-600 text-white disabled:opacity-50"
          onClick={saveBoundary}
          disabled={saving || boundaryPoints.length < 3}
        >
          {saving ? "Saving…" : "Save boundary"}
        </button>
        <button
          className="rounded-lg px-4 py-2 text-sm bg-rose-500 text-white"
          onClick={clearBoundary}
          disabled={boundaryPoints.length === 0}
        >
          Clear
        </button>
      </div>

      {!huntId && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Start a hunt first before saving a boundary.
        </p>
      )}

      <div className="h-[55vh] rounded-3xl overflow-hidden border border-slate-300 dark:border-slate-700 shadow-sm">
        <MapContainer
          key={mapKey}
          center={center as [number, number]}
          zoom={16}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {boundaryPoints.length > 0 &&
            (isDrawing ? (
              <Polyline
                positions={boundaryPoints as [number, number][]}
                pathOptions={{ color: "#f59e0b", weight: 3 }}
              />
            ) : (
              <Polygon
                positions={boundaryPoints as [number, number][]}
                pathOptions={{ color: "#16a34a", fillColor: "rgba(16,163,127,0.2)", weight: 3 }}
              />
            ))}

          <MapClickHandler
            enabled={isDrawing}
            onAddPoint={(p) => setBoundaryPoints((prev) => [...prev, p])}
          />
        </MapContainer>
      </div>

      <p className="text-xs text-slate-500">
        {boundaryPoints.length === 0
          ? 'Click "Start drawing" then click on the map to place boundary points.'
          : `${boundaryPoints.length} point${boundaryPoints.length === 1 ? "" : "s"} — click "Finish drawing" then "Save boundary" to apply.`}
      </p>
    </div>
  );
}
