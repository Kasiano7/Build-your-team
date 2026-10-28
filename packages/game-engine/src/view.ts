import type { Auction, Character, ContentPack, PackMeta, RoomState, RoomView } from '@byt/shared';
import { opts } from './context';
import { characterIndex } from './team';

/**
 * Client-safe projection: strips RNG state, pool contents and processed action
 * ids. Mystery mode hides the rating and stats of the player on the block
 * until the auction closes; sealed offers stay secret until then too.
 */
export function toRoomView(state: RoomState, pack: ContentPack, serverNow: number): RoomView {
  const index = characterIndex(pack);
  const ids = new Set<string>();
  if (state.auction) ids.add(state.auction.characterId);
  for (const p of state.participants) {
    for (const id of [...p.team.starters, ...p.team.bench]) if (id) ids.add(id);
  }
  for (const h of state.history) ids.add(h.characterId);
  for (const o of state.mercato?.offers ?? []) ids.add(o.give).add(o.take);
  for (const s of state.mercato?.sales ?? []) ids.add(s.characterId);
  const characters: Record<string, Character> = {};
  for (const id of ids) {
    const c = index.get(id);
    if (c) characters[id] = c;
  }
  let auction: Auction | null = state.auction;
  if (auction && auction.stage !== 'closed') {
    if (opts(state.settings).mystery) {
      const c = characters[auction.characterId];
      if (c) characters[auction.characterId] = { ...c, overall: 0, attributes: {}, masked: true };
    }
    if (auction.style === 'sealed') {
      auction = { ...auction, highBid: null, bids: auction.bids.map((b) => ({ ...b, id: '', amount: 0 })) };
    }
  }
  return {
    code: state.code,
    version: state.version,
    status: state.status,
    settings: state.settings,
    participants: state.participants,
    poolSize: state.pool.length,
    auctionCount: state.auctionCount,
    auction,
    history: state.history,
    voting: state.voting,
    result: state.result,
    mercato: state.mercato ?? null,
    series: state.series ?? null,
    characters,
    serverNow,
  };
}

export function toPackMeta(pack: ContentPack): PackMeta {
  const { characters: _characters, ...meta } = pack;
  return meta;
}
