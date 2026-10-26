import type { ContentPack } from '@byt/shared';

/**
 * Structural checks run when a pack is registered. Guarantees, among others,
 * that every mode can always be completed by 4 participants (free agents
 * included): each role group holds at least twice the number of slots needed.
 */
export function validatePack(pack: ContentPack): string[] {
  const errors: string[] = [];
  const roleIds = new Set(pack.roles.map((r) => r.id));
  const groupIds = new Set(pack.roleGroups.map((g) => g.id));
  for (const r of pack.roles) if (!groupIds.has(r.group)) errors.push(`role ${r.id}: unknown group ${r.group}`);
  for (const g of pack.roleGroups) {
    if (!pack.attributeSets[g.attributeSet]) errors.push(`group ${g.id}: unknown attribute set ${g.attributeSet}`);
  }

  const seen = new Set<string>();
  for (const c of pack.characters) {
    if (seen.has(c.id)) errors.push(`duplicate character id ${c.id}`);
    seen.add(c.id);
    if (c.roles.length === 0) errors.push(`character ${c.id}: no role`);
    for (const r of c.roles) if (!roleIds.has(r)) errors.push(`character ${c.id}: unknown role ${r}`);
  }

  for (const f of pack.formations) {
    for (const s of f.slots) {
      if (!groupIds.has(s.group)) errors.push(`formation ${f.id} slot ${s.id}: unknown group ${s.group}`);
      for (const r of s.preferredRoles) if (!roleIds.has(r)) errors.push(`formation ${f.id} slot ${s.id}: unknown role ${r}`);
    }
  }

  const groupOf = new Map(pack.roles.map((r) => [r.id, r.group]));
  const perGroup = new Map<string, number>();
  for (const c of pack.characters) {
    const g = groupOf.get(c.roles[0] ?? '');
    if (g) perGroup.set(g, (perGroup.get(g) ?? 0) + 1);
  }
  for (const mode of pack.modes) {
    for (const fid of mode.formationIds) {
      const f = pack.formations.find((x) => x.id === fid);
      if (!f) {
        errors.push(`mode ${mode.id}: unknown formation ${fid}`);
        continue;
      }
      const need = new Map<string, number>();
      for (const s of f.slots) need.set(s.group, (need.get(s.group) ?? 0) + 1);
      for (const [g, n] of need) {
        const have = perGroup.get(g) ?? 0;
        if (have < n * 4 * 2) errors.push(`mode ${mode.id}/${fid}: group ${g} has ${have} characters, needs ≥ ${n * 8}`);
      }
    }
  }
  return errors;
}
