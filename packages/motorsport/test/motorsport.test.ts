import { describe, expect, it } from 'vitest';
import { builtInMotorsportPacks, motorsportRealPack } from '../src';
import { validatePack } from '../../game-engine/src';

describe('Formula 1 content pack', () => {
  it('passes structural validation', () => {
    expect(validatePack(motorsportRealPack)).toEqual([]);
    expect(builtInMotorsportPacks).toContain(motorsportRealPack);
  });

  it('has 22 drivers, 11 constructors and 11 team principals', () => {
    const count = (role: string) => motorsportRealPack.characters.filter((c) => c.roles[0] === role).length;
    expect(count('PIL')).toBe(22);
    expect(count('ECU')).toBe(11);
    expect(count('DIR')).toBe(11);
    expect(motorsportRealPack.characters).toHaveLength(44);
  });

  it('uses unique ids and links every driver and principal to a constructor', () => {
    const ids = motorsportRealPack.characters.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const teams = new Set(motorsportRealPack.characters.filter((c) => c.roles[0] === 'ECU').map((c) => c.name));
    for (const c of motorsportRealPack.characters) {
      if (c.roles[0] !== 'ECU') expect(teams.has(c.affiliation ?? '')).toBe(true);
    }
  });

  it('gives each character the stats of its group attribute set', () => {
    const groupOf = new Map(motorsportRealPack.roles.map((r) => [r.id, r.group]));
    for (const c of motorsportRealPack.characters) {
      const group = motorsportRealPack.roleGroups.find((g) => g.id === groupOf.get(c.roles[0]!))!;
      const keys = motorsportRealPack.attributeSets[group.attributeSet]!.map((a) => a.key);
      expect(Object.keys(c.attributes).sort()).toEqual([...keys].sort());
    }
  });

  it('is labelled as real names with estimated, non-official ratings', () => {
    expect(motorsportRealPack.universeId).toBe('motorsport');
    expect(motorsportRealPack.dataset.fictional).toBe(false);
    expect(motorsportRealPack.dataset.label).toMatch(/non officielles/);
  });
});
