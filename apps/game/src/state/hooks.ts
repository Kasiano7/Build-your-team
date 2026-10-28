import { useEffect, useState, useSyncExternalStore } from 'react';
import { gameClient, teamOf, type GameSnapshot } from './game-client';

export function useGame(): GameSnapshot {
  return useSyncExternalStore(gameClient.subscribe, gameClient.getSnapshot, gameClient.getSnapshot);
}

/** Current participant's team, if playing (duo: the team this person belongs to). */
export function useMe() {
  const g = useGame();
  return g.view && g.participantId ? teamOf(g.view, g.participantId) : null;
}

/** Server-synchronised clock, re-rendering every `intervalMs`. */
export function useServerNow(intervalMs = 100, active = true): number {
  const [now, setNow] = useState(() => gameClient.serverNow());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(gameClient.serverNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);
  return now;
}
