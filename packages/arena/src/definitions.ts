/**
 * "Arènes de Solcendre" universe definitions: roles, groups, attribute set,
 * tiers, party formations (positions in a circular stone arena) and game
 * modes. Pure data — the engine, server and UI are the same as for football.
 *
 * Original Build Your Team universe: every realm, hero and name is invented.
 */
import type { AttributeDef, FormationDef, FormationSlot, GameModeDef, RoleDef, RoleGroupDef, TierDef } from '@byt/shared';

export const ARENA_ROLES: RoleDef[] = [
  { id: 'GAR', label: 'Gardien', group: 'FRONT' },
  { id: 'LAM', label: 'Lame', group: 'FRONT' },
  { id: 'ARC', label: 'Archer', group: 'DIST' },
  { id: 'MAG', label: 'Arcaniste', group: 'DIST' },
  { id: 'SOI', label: 'Soigneur', group: 'SOUT' },
  { id: 'AUG', label: 'Augure', group: 'SOUT' },
];

export const ARENA_GROUPS: RoleGroupDef[] = [
  { id: 'FRONT', label: 'Avant-garde', attributeSet: 'arena' },
  { id: 'DIST', label: 'Distance', attributeSet: 'arena' },
  { id: 'SOUT', label: 'Soutien', attributeSet: 'arena' },
];

export const ARENA_ATTRIBUTES: AttributeDef[] = [
  { key: 'FOR', label: 'Force' },
  { key: 'AGI', label: 'Agilité' },
  { key: 'ARN', label: 'Arcane' },
  { key: 'DEF', label: 'Défense' },
  { key: 'VIT', label: 'Vitalité' },
  { key: 'ESP', label: 'Esprit' },
];

export const ARENA_TIERS: TierDef[] = [
  { id: 'bronze', label: 'Novice', minOverall: 0, style: 'bronze' },
  { id: 'silver', label: 'Aguerri', minOverall: 70, style: 'silver' },
  { id: 'gold', label: 'Champion', minOverall: 78, style: 'gold' },
  { id: 'elite', label: 'Héros', minOverall: 85, style: 'elite' },
  { id: 'icon', label: 'Mythe', minOverall: 91, style: 'icon' },
];

const slot = (id: string, label: string, group: string, preferredRoles: string[], x: number, y: number): FormationSlot => ({
  id,
  label,
  group,
  preferredRoles,
  x,
  y,
});

/**
 * Coordinates inside a circular arena: x left→right, y from the side nearest
 * the viewer (0) to the far side facing the opponents (1). Every slot stays
 * within ~0.35 of the centre so it sits inside the drawn circle.
 */
export const ARENA_FORMATIONS: FormationDef[] = [
  {
    id: 'ar-party',
    label: 'Compagnie',
    slots: [
      slot('GAR', 'GAR', 'FRONT', ['GAR'], 0.36, 0.76),
      slot('LAM', 'LAM', 'FRONT', ['LAM'], 0.64, 0.76),
      slot('ARC', 'ARC', 'DIST', ['ARC'], 0.24, 0.46),
      slot('MAG', 'MAG', 'DIST', ['MAG'], 0.76, 0.46),
      slot('SOU', 'SOU', 'SOUT', ['SOI', 'AUG'], 0.5, 0.2),
    ],
  },
  {
    id: 'ar-warband',
    label: 'Bande de guerre',
    slots: [
      slot('GAR', 'GAR', 'FRONT', ['GAR'], 0.5, 0.8),
      slot('LAM', 'LAM', 'FRONT', ['LAM'], 0.74, 0.66),
      slot('ARC', 'ARC', 'DIST', ['ARC'], 0.24, 0.52),
      slot('MAG', 'MAG', 'DIST', ['MAG'], 0.62, 0.4),
      slot('SOU', 'SOU', 'SOUT', ['SOI', 'AUG'], 0.38, 0.2),
    ],
  },
  {
    id: 'ar-wall',
    label: 'Mur de boucliers',
    slots: [
      slot('GAR1', 'GAR', 'FRONT', ['GAR'], 0.28, 0.72),
      slot('LAM', 'LAM', 'FRONT', ['LAM'], 0.5, 0.82),
      slot('GAR2', 'GAR', 'FRONT', ['GAR'], 0.72, 0.72),
      slot('TIR', 'TIR', 'DIST', ['ARC', 'MAG'], 0.5, 0.48),
      slot('SOI', 'SOI', 'SOUT', ['SOI'], 0.5, 0.2),
    ],
  },
  {
    id: 'ar-volley',
    label: 'Pluie de traits',
    slots: [
      slot('AVG', 'AVG', 'FRONT', ['GAR', 'LAM'], 0.5, 0.8),
      slot('ARC1', 'ARC', 'DIST', ['ARC'], 0.2, 0.52),
      slot('MAG', 'MAG', 'DIST', ['MAG'], 0.5, 0.54),
      slot('ARC2', 'ARC', 'DIST', ['ARC'], 0.8, 0.52),
      slot('SOU', 'SOU', 'SOUT', ['SOI', 'AUG'], 0.5, 0.2),
    ],
  },
  {
    id: 'ar-sanctum',
    label: 'Cercle sacré',
    slots: [
      slot('GAR', 'GAR', 'FRONT', ['GAR'], 0.36, 0.76),
      slot('LAM', 'LAM', 'FRONT', ['LAM'], 0.64, 0.76),
      slot('TIR', 'TIR', 'DIST', ['MAG', 'ARC'], 0.5, 0.5),
      slot('SOI', 'SOI', 'SOUT', ['SOI'], 0.3, 0.24),
      slot('AUG', 'AUG', 'SOUT', ['AUG'], 0.7, 0.24),
    ],
  },
];

export const ARENA_MODES: GameModeDef[] = [
  {
    id: 'quick',
    label: 'Rapide',
    description: '5 héros · gardien, lame, archer, arcaniste, soutien',
    defaultBudget: 200,
    allowedBudgets: [150, 200, 300],
    formationIds: ['ar-party'],
    defaultFormationId: 'ar-party',
    benchSize: 0,
    formationChangeAllowed: false,
  },
  {
    id: 'classic',
    label: 'Classique',
    description: '5 héros + 3 réservistes · bande de guerre, mur de boucliers, pluie de traits, cercle sacré',
    defaultBudget: 300,
    allowedBudgets: [250, 300, 400],
    formationIds: ['ar-warband', 'ar-wall', 'ar-volley', 'ar-sanctum'],
    defaultFormationId: 'ar-warband',
    benchSize: 3,
    formationChangeAllowed: true,
  },
];
