import type { Character, PackMeta, TierDef } from '@byt/shared';
import type { TierStyle } from './tokens';

export interface CharacterDescription {
  tier: TierDef;
  tierStyle: TierStyle;
  primaryRole: string;
  primaryRoleLabel: string;
  secondaryRoles: string[];
  group: string;
  stats: { key: string; label: string; value: number }[];
}

/** Resolve tier, roles and the attribute set of a character from its content pack. */
export function describeCharacter(pack: PackMeta, c: Character): CharacterDescription {
  const tier = [...pack.tiers].sort((a, b) => b.minOverall - a.minOverall).find((t) => c.overall >= t.minOverall) ?? pack.tiers[0]!;
  const primary = c.roles[0] ?? '';
  const role = pack.roles.find((r) => r.id === primary);
  const group = role?.group ?? '';
  const setKey = pack.roleGroups.find((g) => g.id === group)?.attributeSet ?? Object.keys(pack.attributeSets)[0]!;
  const defs = pack.attributeSets[setKey] ?? [];
  return {
    tier,
    tierStyle: tier.style,
    primaryRole: primary,
    primaryRoleLabel: role?.label ?? primary,
    secondaryRoles: c.roles.slice(1),
    group,
    stats: defs.map((d) => ({ key: d.key, label: d.label, value: c.attributes[d.key] ?? 0 })),
  };
}
