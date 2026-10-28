/**
 * Basketball universe definitions: roles, groups, attribute set, tiers,
 * line-ups (half-court positions) and game modes. Pure data — the engine,
 * server and UI are the same as for football.
 */
import type { AttributeDef, FormationDef, FormationSlot, GameModeDef, RoleDef, RoleGroupDef, TierDef } from '@byt/shared';

export const BASKETBALL_ROLES: RoleDef[] = [
  { id: 'PG', label: 'Meneur', group: 'G' },
  { id: 'SG', label: 'Arrière', group: 'G' },
  { id: 'SF', label: 'Ailier', group: 'F' },
  { id: 'PF', label: 'Ailier fort', group: 'F' },
  { id: 'C', label: 'Pivot', group: 'C' },
];

export const BASKETBALL_GROUPS: RoleGroupDef[] = [
  { id: 'G', label: 'Extérieur', attributeSet: 'basketball' },
  { id: 'F', label: 'Ailier', attributeSet: 'basketball' },
  { id: 'C', label: 'Intérieur', attributeSet: 'basketball' },
];

export const BASKETBALL_ATTRIBUTES: AttributeDef[] = [
  { key: 'SHT', label: 'Tir extérieur' },
  { key: 'INS', label: 'Jeu intérieur' },
  { key: 'PAS', label: 'Passe' },
  { key: 'DRI', label: 'Dribble' },
  { key: 'DEF', label: 'Défense' },
  { key: 'REB', label: 'Rebond' },
];

export const BASKETBALL_TIERS: TierDef[] = [
  { id: 'bronze', label: 'Rotation', minOverall: 0, style: 'bronze' },
  { id: 'silver', label: 'Confirmé', minOverall: 70, style: 'silver' },
  { id: 'gold', label: 'Titulaire', minOverall: 78, style: 'gold' },
  { id: 'elite', label: 'All-Star', minOverall: 85, style: 'elite' },
  { id: 'icon', label: 'Légende', minOverall: 91, style: 'icon' },
];

const slot = (id: string, label: string, group: string, preferredRoles: string[], x: number, y: number): FormationSlot => ({
  id,
  label,
  group,
  preferredRoles,
  x,
  y,
});

/** Coordinates on a half court: x left→right, y from the half-court line (0) to the baseline (1). */
export const BASKETBALL_FORMATIONS: FormationDef[] = [
  {
    id: 'bk-standard',
    label: 'Cinq classique',
    slots: [
      slot('PG', 'MEN', 'G', ['PG'], 0.5, 0.15),
      slot('SG', 'ARR', 'G', ['SG'], 0.16, 0.4),
      slot('SF', 'AIL', 'F', ['SF'], 0.84, 0.4),
      slot('PF', 'AF', 'F', ['PF'], 0.31, 0.72),
      slot('C', 'PIV', 'C', ['C'], 0.67, 0.8),
    ],
  },
  {
    id: 'bk-small',
    label: 'Small ball',
    slots: [
      slot('PG', 'MEN', 'G', ['PG'], 0.5, 0.15),
      slot('SG', 'ARR', 'G', ['SG'], 0.15, 0.38),
      slot('SF', 'AIL', 'F', ['SF'], 0.85, 0.38),
      slot('SF2', 'AIL', 'F', ['SF'], 0.3, 0.72),
      slot('PF', 'AF', 'F', ['PF'], 0.68, 0.79),
    ],
  },
  {
    id: 'bk-twin',
    label: 'Twin towers',
    slots: [
      slot('PG', 'MEN', 'G', ['PG'], 0.5, 0.15),
      slot('W', 'AIL', 'F', ['SF'], 0.18, 0.42),
      slot('PF', 'AF', 'F', ['PF'], 0.82, 0.44),
      slot('C1', 'PIV', 'C', ['C'], 0.34, 0.78),
      slot('C2', 'PIV', 'C', ['C'], 0.68, 0.8),
    ],
  },
];

export const BASKETBALL_MODES: GameModeDef[] = [
  {
    id: 'quick',
    label: 'Rapide',
    description: '5 joueurs · meneur, arrière, ailier, ailier fort, pivot',
    defaultBudget: 200,
    allowedBudgets: [150, 200, 300],
    formationIds: ['bk-standard'],
    defaultFormationId: 'bk-standard',
    benchSize: 0,
    formationChangeAllowed: false,
  },
  {
    id: 'classic',
    label: 'Classique',
    description: '5 titulaires + 3 remplaçants · cinq classique, small ball, twin towers',
    defaultBudget: 300,
    allowedBudgets: [250, 300, 400],
    formationIds: ['bk-standard', 'bk-small', 'bk-twin'],
    defaultFormationId: 'bk-standard',
    benchSize: 3,
    formationChangeAllowed: true,
  },
];
