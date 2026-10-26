import type { Character, ContentPack, PackMeta, RoomState, RoomView } from '@byt/shared';
import { characterIndex } from './team';

/** Client-safe projection: strips RNG state, pool contents and processed action ids. */
export function toRoomView(state: RoomState, pack: ContentPack, serverNow: number): RoomView {
  const index = characterIndex(pack);
  const ids = new Set<string>();
  if (state.auction) ids.add(state.auction.characterId);
  for (const p of state.participants) {
    for (const id of [...p.team.starters, ...p.team.bench]) if (id) ids.add(id);
  }
  for (const h of state.history) ids.add(h.characterId);
  const characters: Record<string, Character> = {};
  for (const id of ids) {
    const c = index.get(id);
    if (c) characters[id] = c;
  }
  return {
    code: state.code,
    version: state.version,
    status: state.status,
    settings: state.settings,
    participants: state.participants,
    poolSize: state.pool.length,
    auctionCount: state.auctionCount,
    auction: state.auction,
    history: state.history,
    voting: state.voting,
    result: state.result,
    characters,
    serverNow,
  };
}

export function toPackMeta(pack: ContentPack): PackMeta {
  const { characters: _characters, ...meta } = pack;
  return meta;
}
