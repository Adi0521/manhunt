"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polygon, Polyline, Popup, TileLayer, useMapEvents } from "react-leaflet";
import type { LeafletMouseEvent } from "leaflet";

type Point = [number, number];

type MapClickHandlerProps = {
  enabled: boolean;
  onAddPoint: (point: Point) => void;
};

function MapClickHandler({ enabled, onAddPoint }: MapClickHandlerProps) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      if (!enabled) return;
      onAddPoint([event.latlng.lat, event.latlng.lng]);
    },
  });

  return null;
}

function pointInPolygon(point: Point, polygon: Point[]) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

export default function MapClient() {
  const [currentLocation, setCurrentLocation] = useState<Point | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [boundaryPoints, setBoundaryPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mapKey] = useState(() => Math.random().toString(36).slice(2));

  useEffect(() => {
    if (!navigator.geolocation) {
      setPermissionError("Geolocation is not supported by this browser.");
      return;
    }

    const watcher = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentLocation([position.coords.latitude, position.coords.longitude]);
        setPermissionError(null);
      },
      (error) => {
        setPermissionError(error.message || "Unable to access location.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  const mapCenter = useMemo(() => currentLocation ?? [51.505, -0.09], [currentLocation]);

  const insideBoundary = useMemo(() => {
    if (!currentLocation || boundaryPoints.length < 3) return null;
    return pointInPolygon(currentLocation, boundaryPoints);
  }, [boundaryPoints, currentLocation]);

  const boundaryStatus = insideBoundary === null ? "Define a boundary to check." : insideBoundary ? "In bounds" : "Out of bounds";
  const boundaryStatusColor = insideBoundary === null ? "text-slate-600" : insideBoundary ? "text-emerald-700" : "text-rose-700";

  const handleClearBoundary = () => {
    setBoundaryPoints([]);
    setIsDrawing(false);
  };

  const sideText = boundaryPoints.length === 0 ? "No boundary set." : `${boundaryPoints.length} point${boundaryPoints.length === 1 ? "" : "s"} in boundary.`;

  return (
    <div className="min-h-screen bg-stone-200 dark:bg-neutral-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h1 className="text-3xl font-semibold">Manhunt GPS Boundary</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Use the map to set an allowed play zone and watch your location status.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className={`rounded-lg px-4 py-2 border transition ${
                isDrawing
                  ? "bg-blue-600 text-white border-blue-700"
                  : "bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
              }`}
              onClick={() => {
                setBoundaryPoints([]);
                setIsDrawing(true);
              }}
            >
              Start boundary
            </button>
            <button
              className="rounded-lg px-4 py-2 bg-slate-900 text-white border border-slate-800 dark:bg-slate-100 dark:text-slate-900"
              onClick={() => setIsDrawing(false)}
            >
              Finish boundary
            </button>
            <button className="rounded-lg px-4 py-2 bg-rose-500 text-white border border-rose-600" onClick={handleClearBoundary}>
              Clear boundary
            </button>
          </div>
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

              {currentLocation && (
                <CircleMarker center={currentLocation} radius={10} pathOptions={{ color: "#2563eb", fillColor: "#60a5fa", fillOpacity: 0.8 }}>
                  <Popup>You are here</Popup>
                </CircleMarker>
              )}

              {boundaryPoints.length > 0 &&
                (isDrawing ? (
                  <Polyline positions={boundaryPoints as [number, number][]} pathOptions={{ color: "#f59e0b" }} />
                ) : (
                  <Polygon positions={boundaryPoints as [number, number][]} pathOptions={{ color: "#16a34a", fillColor: "rgba(16,163,127,0.2)", weight: 3 }} />
                ))}

              <MapClickHandler enabled={isDrawing} onAddPoint={(point) => setBoundaryPoints((prev) => [...prev, point])} />
            </MapContainer>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-sm">
              <h2 className="text-xl font-semibold">Status</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{permissionError ?? sideText}</p>
              <div className="mt-4 flex flex-col gap-3">
                <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Location</div>
                  <div className="mt-2 text-base font-medium">
                    {currentLocation ? `${currentLocation[0].toFixed(5)}, ${currentLocation[1].toFixed(5)}` : "Waiting for GPS..."}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Boundary check</div>
                  <div className={`mt-2 text-base font-semibold ${boundaryStatusColor}`}>{boundaryStatus}</div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-sm">
              <h2 className="text-xl font-semibold">Boundary points</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Click the map while boundary mode is active to add points.</p>
              <div className="mt-4 max-h-64 overflow-auto space-y-2">
                {boundaryPoints.length === 0 ? (
                  <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 p-4 text-sm text-slate-500">No points yet.</div>
                ) : (
                  boundaryPoints.map((point, index) => (
                    <div
                      key={`${point[0]}-${point[1]}-${index}`}
                      className="rounded-2xl bg-slate-100 dark:bg-slate-800 p-3 text-sm text-slate-700 dark:text-slate-200"
                    >
                      {index + 1}. {point[0].toFixed(5)}, {point[1].toFixed(5)}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

