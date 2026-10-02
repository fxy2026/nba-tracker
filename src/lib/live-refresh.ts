// Share the live countdown lifecycle without changing either refresh transport.
// Hidden/offline tabs do no polling; returning to an active tab refreshes once.
export function startLiveRefresh({
  interval,
  remaining,
  onCountdown,
  onRefresh,
}: {
  interval: number;
  remaining: { current: number };
  onCountdown: (seconds: number) => void;
  onRefresh: () => void;
}): () => void {
  let timer: ReturnType<typeof setInterval> | undefined;
  const isActive = () => document.visibilityState === "visible" && navigator.onLine !== false;

  const stop = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  };

  const start = () => {
    remaining.current = interval;
    timer = setInterval(() => {
      // Also guard the callback in case a queued tick precedes the event.
      if (!isActive()) {
        stop();
        return;
      }
      remaining.current--;
      if (remaining.current <= 0) {
        remaining.current = interval;
        onRefresh();
      }
      onCountdown(remaining.current);
    }, 1000);
  };

  const sync = () => {
    if (!isActive()) {
      stop();
    } else if (timer === undefined) {
      start();
      onCountdown(interval);
      onRefresh();
    }
  };

  // Initial data is already loaded by the page; don't duplicate that request.
  if (isActive()) start();
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("online", sync);
  window.addEventListener("offline", sync);

  return () => {
    stop();
    document.removeEventListener("visibilitychange", sync);
    window.removeEventListener("online", sync);
    window.removeEventListener("offline", sync);
  };
}
