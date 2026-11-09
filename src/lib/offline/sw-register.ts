/**
 * Registers the offline shell (F7). Client-only, best-effort: if the browser
 * has no service worker support the app works exactly the same, just without
 * offline reopening.
 */
export function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.register("/sw.js").catch(() => {
    // Offline is a bonus, never a blocker.
  });
}
