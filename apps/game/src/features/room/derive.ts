/**
 * Pure helpers deriving UI hints from the server view. These only DISPLAY
 * rules (e.g. the maximum you may bid); the server re-validates everything.
 */
import { bestSlotFor, getFormation, maxBidFor, minimumNextBid } from '@byt/game-engine';
import type { ContentPack, PackMeta, Participant, RoomState, RoomView, SlotRef } from '@byt/shared';

const cache = new WeakMap<PackMeta, ContentPack>();
/** Engine helpers only need roles/formations: wrap metadata as a pack without catalogue. */
export function enginePack(meta: PackMeta): ContentPack {
  let p = cache.get(meta);
  if (!p) {
    p = { ...meta, characters: [] };
    cache.set(meta, p);
  }
  return p;
}

export function formationOf(meta: PackMeta, formationId: string) {
  return getFormation(enginePack(meta), formationId);
}

export function targetSlotFor(meta: PackMeta, view: RoomView, participant: Participant): SlotRef | null {
  const id = view.auction?.characterId;
  const c = id ? view.characters[id] : undefined;
  if (!c) return null;
  return bestSlotFor(enginePack(meta), participant.team, c);
}

export function maxBid(meta: PackMeta, view: RoomView, participant: Participant): number {
  const id = view.auction?.characterId;
  const c = id ? view.characters[id] : undefined;
  if (!c) return 0;
  return maxBidFor(enginePack(meta), view.settings, participant, c);
}

export function nextMinimum(view: RoomView): number {
  return minimumNextBid({ auction: view.auction, settings: view.settings } as RoomState);
}

export type BidStatus =
  | { kind: 'can_bid'; min: number; max: number }
  | { kind: 'leading' }
  | { kind: 'passed' }
  | { kind: 'not_eligible'; reason: 'no_slot' | 'budget' }
  | { kind: 'waiting' };

export function bidStatus(meta: PackMeta, view: RoomView, me: Participant | null): BidStatus {
  const a = view.auction;
  if (!me || !a || a.stage !== 'open') return { kind: 'waiting' };
  if (a.highBid?.participantId === me.id) return { kind: 'leading' };
  if (a.passed.includes(me.id)) return { kind: 'passed' };
  if (!a.eligible.includes(me.id)) {
    return { kind: 'not_eligible', reason: targetSlotFor(meta, view, me) ? 'budget' : 'no_slot' };
  }
  const min = nextMinimum(view);
  const max = maxBid(meta, view, me);
  if (max < min) return { kind: 'not_eligible', reason: 'budget' };
  return { kind: 'can_bid', min, max };
}

export function filledCount(p: Participant): number {
  return p.team.starters.filter(Boolean).length;
}
