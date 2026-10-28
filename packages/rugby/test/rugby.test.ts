import { describe, expect, it } from 'vitest';
import type { RoomState } from '@byt/shared';
import { rugbyRealPack as pack, builtInRugbyPacks } from '../src';
import {
  addParticipant,
  advance,
  buildSettings,
  compatibility,
  createRoomState,
  getCharacter,
  getFormation,
  nextDeadline,
  startGame,
  validatePack,
  type Outcome,
} from '../../game-engine/src';

function unwrap(o: Outcome): RoomState {
  if (!o.ok) throw new Error(`Expected ok, got ${o.code} ${JSON.stringify(o.details ?? {})}`);
  return o.state;
}

describe('rugby content pack', () => {
  it('passes pack validation', () => {
    expect(validatePack(pack)).toEqual([]);
    expect(builtInRugbyPacks).toContain(pack);
    expect(pack.universeId).toBe('rugby');
  });

  it('is labelled as real players with estimated, non-official ratings', () => {
    expect(pack.dataset.id).toBe('rugby-real');
    expect(pack.dataset.fictional).toBe(false);
    expect(pack.dataset.label).toMatch(/estimées.*non officielles/);
    expect(pack.dataset.license).toMatch(/Aucune donnée de jeu vidéo/);
  });

  it('has unique character ids and 6 stats per player', () => {
    const ids = pack.characters.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of pack.characters) expect(Object.keys(c.attributes)).toEqual(['VIT', 'PUI', 'PLA', 'JEU', 'MAI', 'END']);
  });

  it('formations: 7 slots for sevens, 15 numbered slots for the XV', () => {
    expect(getFormation(pack, 'rg-seven').slots).toHaveLength(7);
    expect(getFormation(pack, 'rg-xv').slots.map((s) => s.id)).toEqual(Array.from({ length: 15 }, (_, i) => String(i + 1)));
  });

  it('plays a full classic draft with 4 participants', () => {
    let now = 1_000_000;
    const ctx = () => ({ pack, now });
    let s = createRoomState({ code: 'RUGBYX', settings: buildSettings(pack, { mode: 'classic', maxParticipants: 4 }), host: { id: 'p1', nickname: 'A' }, seed: 15, ctx: ctx() });
    expect(s.settings.budget).toBe(500);
    expect(s.participants[0]!.team.starters).toHaveLength(15);
    expect(s.participants[0]!.team.bench).toHaveLength(4);
    for (const id of ['p2', 'p3', 'p4']) s = unwrap(addParticipant(s, id, id, ctx()));
    s = unwrap(startGame(s, 'p1', ctx()));
    for (let i = 0; i < 5000 && s.status === 'drafting'; i++) {
      now = Math.max(now, nextDeadline(s)!);
      s = unwrap(advance(s, ctx()));
    }
    expect(s.status).toBe('voting');
    for (const p of s.participants) {
      expect(p.team.starters.every(Boolean)).toBe(true);
      const f = getFormation(pack, p.team.formationId);
      p.team.starters.forEach((id, i) => expect(compatibility(pack, getCharacter(pack, id!), f.slots[i]!)).toBeGreaterThan(0));
    }
  });
});
