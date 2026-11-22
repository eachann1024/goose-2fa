import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const readyListeners = new Set<() => void>();
let seconds = wallSeconds();
let tick: ReturnType<typeof setTimeout> | undefined;
let frame = 0;
let ready = false;
let pluginOut = false;

function wallSeconds() {
  return Math.floor(Date.now() / 1000);
}

function clockSnapshot() {
  return listeners.size === 0 ? wallSeconds() : seconds;
}

function setReady(next: boolean) {
  if (ready === next) return;
  ready = next;
  readyListeners.forEach((notify) => notify());
}

function pause() {
  clearTimeout(tick);
  cancelAnimationFrame(frame);
  setReady(false);
}

function refresh() {
  clearTimeout(tick);
  const now = Date.now();
  const next = Math.floor(now / 1000);
  if (next !== seconds) {
    seconds = next;
    listeners.forEach((notify) => notify());
  }
  if (listeners.size && !pluginOut && !document.hidden) {
    tick = setTimeout(refresh, 1000 - (now % 1000));
  }
}

function resume() {
  pause();
  if (pluginOut || document.hidden || listeners.size === 0) return;
  refresh();
  // Let the current progress paint before re-enabling transitions.
  frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => setReady(true));
  });
}

export function resumeOtpClock() {
  pluginOut = false;
  resume();
}

export function pauseOtpClock() {
  pluginOut = true;
  pause();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    seconds = wallSeconds();
    document.addEventListener("visibilitychange", resume);
    resume();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    pause();
    document.removeEventListener("visibilitychange", resume);
  };
}

function subscribeNever() {
  return () => {};
}

export function useOtpStep(period: number, timeBased: boolean, counter: number) {
  const snapshot = useCallback(
    () => timeBased ? Math.floor(clockSnapshot() / period) : counter,
    [period, timeBased, counter],
  );
  return useSyncExternalStore(timeBased ? subscribe : subscribeNever, snapshot);
}

function remainingSeconds(period: number) {
  return period - (clockSnapshot() % period);
}

export function useOtpLow(period: number, timeBased: boolean) {
  const snapshot = useCallback(() => timeBased && remainingSeconds(period) <= 5, [period, timeBased]);
  return useSyncExternalStore(timeBased ? subscribe : subscribeNever, snapshot);
}

function subscribeReady(listener: () => void) {
  readyListeners.add(listener);
  return () => { readyListeners.delete(listener); };
}

function readySnapshot() {
  return ready;
}

export function useOtpCountdown(period: number) {
  const snapshot = useCallback(() => remainingSeconds(period), [period]);
  const remaining = useSyncExternalStore(subscribe, snapshot);
  const timerReady = useSyncExternalStore(subscribeReady, readySnapshot);
  return { remaining, timerReady };
}
