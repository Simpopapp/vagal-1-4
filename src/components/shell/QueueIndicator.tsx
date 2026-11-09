import { useEffect, useState } from "react";

import { listQueueByStatus } from "@/lib/db/repo";
import { startQueueWorker, stopQueueWorker } from "@/lib/queue/worker";

/**
 * The quiet collect-mode progress line (PRD D8): "N de M prontas" while the
 * background queue turns marked words into cards. Mounts the worker once per
 * page load and hides itself when there is nothing to say.
 */
export function QueueIndicator() {
  const [pending, setPending] = useState(0);
  const [ready, setReady] = useState(0);

  useEffect(() => {
    let alive = true;

    const refresh = async () => {
      const queued = await listQueueByStatus("pending");
      const { listCards } = await import("@/lib/db/repo");
      const cards = await listCards();
      if (!alive) return;
      setPending(queued.length);
      setReady(cards.length);
    };

    void refresh();
    const stop = startQueueWorker(undefined, () => void refresh());
    const poll = setInterval(() => void refresh(), 5_000);

    return () => {
      alive = false;
      stop();
      stopQueueWorker();
      clearInterval(poll);
    };
  }, []);

  if (pending === 0) return null;

  return (
    <span
      className="hidden rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground sm:inline"
      role="status"
    >
      {ready} pronta{ready === 1 ? "" : "s"} · {pending} na fila
    </span>
  );
}
