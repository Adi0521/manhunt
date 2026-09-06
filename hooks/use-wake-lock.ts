"use client";

import { useEffect, useState } from "react";

export type WakeLockStatus = "idle" | "held" | "denied" | "unsupported";

type WakeLockSentinel = {
  release: () => Promise<void>;
  addEventListener: (type: string, listener: () => void) => void;
};

// Module-level singleton: several components can ask for the screen to stay
// awake, but the browser only ever needs one sentinel.
let sentinel: WakeLockSentinel | null = null;
let pending = false;
let holders = 0;
let listening = false;
let status: WakeLockStatus = "idle";
const listeners = new Set<(s: WakeLockStatus) => void>();

function supported() {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

function setStatus(next: WakeLockStatus) {
  if (status === next) return;
  status = next;
  listeners.forEach((l) => l(next));
}

export function currentStatus(): WakeLockStatus {
  if (!supported()) return "unsupported";
  return status;
}

async function acquire() {
  if (!supported() || holders === 0 || sentinel || pending) return;
  // A lock can only be taken while the page is visible; visibilitychange
  // retries once we come back.
  if (document.visibilityState !== "visible") return;
  pending = true;
  try {
    const lock = (await (navigator as any).wakeLock.request("screen")) as WakeLockSentinel;
    if (holders === 0) {
      await lock.release().catch(() => {});
      return;
    }
    sentinel = lock;
    // The browser drops the lock on its own when the tab is hidden.
    lock.addEventListener("release", () => {
      if (sentinel === lock) sentinel = null;
      setStatus("idle");
    });
    setStatus("held");
  } catch {
    sentinel = null;
    setStatus("denied");
  } finally {
    pending = false;
  }
}

async function release() {
  const lock = sentinel;
  sentinel = null;
  setStatus("idle");
  if (lock) await lock.release().catch(() => {});
}

function onVisibility() {
  if (document.visibilityState === "visible") void acquire();
}

function addHolder() {
  holders += 1;
  if (!listening) {
    document.addEventListener("visibilitychange", onVisibility);
    listening = true;
  }
  void acquire();
}

function removeHolder() {
  holders = Math.max(0, holders - 1);
  if (holders === 0) {
    if (listening) {
      document.removeEventListener("visibilitychange", onVisibility);
      listening = false;
    }
    void release();
  }
}

/**
 * Keeps the screen from auto-locking while `enabled` is true. Pass `false` to
 * observe the status without requesting a lock of your own.
 */
export function useWakeLock(enabled: boolean): WakeLockStatus {
  const [value, setValue] = useState<WakeLockStatus>("idle");

  useEffect(() => {
    const listener = () => setValue(currentStatus());
    listeners.add(listener);
    setValue(currentStatus());
    return () => { listeners.delete(listener); };
  }, []);

  useEffect(() => {
    if (!enabled || !supported()) return;
    addHolder();
    return () => removeHolder();
  }, [enabled]);

  return value;
}
