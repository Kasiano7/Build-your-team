import { describe, expect, it } from 'vitest';
import { arenaPack, builtInArenaPacks, ARENA_ATTRIBUTES } from '../src';
import { validatePack } from '../../game-engine/src';

describe('Arènes de Solcendre content pack', () => {
  it('passes pack validation', () => {
    expect(validatePack(arenaPack)).toEqual([]);
    expect(builtInArenaPacks).toContain(arenaPack);
  });

  it('is an original, fictional universe', () => {
    expect(arenaPack.universeId).toBe('arena');
    expect(arenaPack.dataset.fictional).toBe(true);
    expect(arenaPack.id).toBe('arena:arena-heroes@1.0.0');
  });

  it('has unique ids and well-formed heroes', () => {
    const ids = arenaPack.characters.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(80);
    const keys = ARENA_ATTRIBUTES.map((a) => a.key);
    for (const c of arenaPack.characters) {
      expect(Object.keys(c.attributes)).toEqual(keys);
      expect(c.overall).toBeGreaterThanOrEqual(65);
      expect(c.overall).toBeLessThanOrEqual(97);
      expect(c.nationality).toMatch(/^[A-Z]{3}$/);
      expect(c.affiliation).toBeTruthy();
    }
  });

  it('slots prefer roles of their own group and stay inside the arena circle', () => {
    const groupOf = new Map(arenaPack.roles.map((r) => [r.id, r.group]));
    for (const f of arenaPack.formations) {
      for (const s of f.slots) {
        for (const r of s.preferredRoles) expect(groupOf.get(r)).toBe(s.group);
        expect(Math.hypot(s.x - 0.5, s.y - 0.5)).toBeLessThanOrEqual(0.4);
      }
    }
  });
});
