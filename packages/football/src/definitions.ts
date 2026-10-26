/**
 * Football universe definitions: roles, groups, attribute sets, tiers,
 * formations and game modes. Pure data — the engine stays generic.
 */
import type { AttributeDef, FormationDef, FormationSlot, GameModeDef, RoleDef, RoleGroupDef, TierDef } from '@byt/shared';

export const FOOTBALL_ROLES: RoleDef[] = [
  { id: 'GK', label: 'Gardien', group: 'GK' },
  { id: 'CB', label: 'Défenseur central', group: 'DEF' },
  { id: 'LB', label: 'Latéral gauche', group: 'DEF' },
  { id: 'RB', label: 'Latéral droit', group: 'DEF' },
  { id: 'CDM', label: 'Milieu défensif', group: 'MID' },
  { id: 'CM', label: 'Milieu central', group: 'MID' },
  { id: 'CAM', label: 'Milieu offensif', group: 'MID' },
  { id: 'LM', label: 'Milieu gauche', group: 'MID' },
  { id: 'RM', label: 'Milieu droit', group: 'MID' },
  { id: 'LW', label: 'Ailier gauche', group: 'ATT' },
  { id: 'RW', label: 'Ailier droit', group: 'ATT' },
  { id: 'ST', label: 'Avant-centre', group: 'ATT' },
];

export const FOOTBALL_GROUPS: RoleGroupDef[] = [
  { id: 'GK', label: 'Gardien', attributeSet: 'goalkeeper' },
  { id: 'DEF', label: 'Défenseur', attributeSet: 'outfield' },
  { id: 'MID', label: 'Milieu', attributeSet: 'outfield' },
  { id: 'ATT', label: 'Attaquant', attributeSet: 'outfield' },
];

export const OUTFIELD_ATTRIBUTES: AttributeDef[] = [
  { key: 'PAC', label: 'Vitesse' },
  { key: 'SHO', label: 'Tir' },
  { key: 'PAS', label: 'Passe' },
  { key: 'DRI', label: 'Dribble' },
  { key: 'DEF', label: 'Défense' },
  { key: 'PHY', label: 'Physique' },
];

export const GOALKEEPER_ATTRIBUTES: AttributeDef[] = [
  { key: 'DIV', label: 'Plongeon' },
  { key: 'HAN', label: 'Prise de balle' },
  { key: 'KIC', label: 'Jeu au pied' },
  { key: 'REF', label: 'Réflexes' },
  { key: 'SPD', label: 'Vitesse' },
  { key: 'POS', label: 'Placement' },
];

export const FOOTBALL_TIERS: TierDef[] = [
  { id: 'bronze', label: 'Espoir', minOverall: 0, style: 'bronze' },
  { id: 'silver', label: 'Confirmé', minOverall: 65, style: 'silver' },
  { id: 'gold', label: 'Titulaire', minOverall: 75, style: 'gold' },
  { id: 'elite', label: 'Élite', minOverall: 83, style: 'elite' },
  { id: 'icon', label: 'Légende', minOverall: 88, style: 'icon' },
];

const slot = (id: string, label: string, group: string, preferredRoles: string[], x: number, y: number): FormationSlot => ({
  id,
  label,
  group,
  preferredRoles,
  x,
  y,
});

const GK = slot('GK', 'GB', 'GK', ['GK'], 0.5, 0.06);
const BACK_FOUR = [
  slot('LB', 'DG', 'DEF', ['LB'], 0.13, 0.27),
  slot('LCB', 'DC', 'DEF', ['CB'], 0.37, 0.22),
  slot('RCB', 'DC', 'DEF', ['CB'], 0.63, 0.22),
  slot('RB', 'DD', 'DEF', ['RB'], 0.87, 0.27),
];

export const FOOTBALL_FORMATIONS: FormationDef[] = [
  {
    id: 'quick-5',
    label: 'Rapide · 1-1-1-2',
    slots: [
      GK,
      slot('DEF', 'DEF', 'DEF', ['CB', 'LB', 'RB'], 0.5, 0.28),
      slot('MID', 'MIL', 'MID', ['CM', 'CDM', 'CAM', 'LM', 'RM'], 0.5, 0.53),
      slot('LATT', 'ATT', 'ATT', ['ST', 'LW'], 0.3, 0.8),
      slot('RATT', 'ATT', 'ATT', ['ST', 'RW'], 0.7, 0.8),
    ],
  },
  {
    id: '4-3-3',
    label: '4-3-3',
    slots: [
      GK,
      ...BACK_FOUR,
      slot('LCM', 'MC', 'MID', ['CM', 'CDM'], 0.26, 0.5),
      slot('CM', 'MC', 'MID', ['CM', 'CDM', 'CAM'], 0.5, 0.45),
      slot('RCM', 'MC', 'MID', ['CM', 'CDM'], 0.74, 0.5),
      slot('LW', 'AG', 'ATT', ['LW', 'LM'], 0.17, 0.79),
      slot('ST', 'BU', 'ATT', ['ST'], 0.5, 0.85),
      slot('RW', 'AD', 'ATT', ['RW', 'RM'], 0.83, 0.79),
    ],
  },
  {
    id: '4-4-2',
    label: '4-4-2',
    slots: [
      GK,
      ...BACK_FOUR,
      slot('LM', 'MG', 'MID', ['LM', 'LW'], 0.12, 0.54),
      slot('LCM', 'MC', 'MID', ['CM', 'CDM'], 0.38, 0.49),
      slot('RCM', 'MC', 'MID', ['CM', 'CDM'], 0.62, 0.49),
      slot('RM', 'MD', 'MID', ['RM', 'RW'], 0.88, 0.54),
      slot('LST', 'BU', 'ATT', ['ST'], 0.37, 0.83),
      slot('RST', 'BU', 'ATT', ['ST'], 0.63, 0.83),
    ],
  },
  {
    id: '4-2-3-1',
    label: '4-2-3-1',
    slots: [
      GK,
      ...BACK_FOUR,
      slot('LDM', 'MDC', 'MID', ['CDM', 'CM'], 0.37, 0.42),
      slot('RDM', 'MDC', 'MID', ['CDM', 'CM'], 0.63, 0.42),
      slot('LAM', 'MOG', 'MID', ['LM', 'LW', 'CAM'], 0.16, 0.65),
      slot('CAM', 'MOC', 'MID', ['CAM', 'CM'], 0.5, 0.63),
      slot('RAM', 'MOD', 'MID', ['RM', 'RW', 'CAM'], 0.84, 0.65),
      slot('ST', 'BU', 'ATT', ['ST'], 0.5, 0.86),
    ],
  },
];

export const FOOTBALL_MODES: GameModeDef[] = [
  {
    id: 'quick',
    label: 'Rapide',
    description: '5 joueurs · 1 GB, 1 DEF, 1 MIL, 2 ATT · ~10 min',
    defaultBudget: 200,
    allowedBudgets: [150, 200, 300],
    formationIds: ['quick-5'],
    defaultFormationId: 'quick-5',
    benchSize: 0,
    formationChangeAllowed: false,
  },
  {
    id: 'classic',
    label: 'Classique',
    description: '11 titulaires + 3 remplaçants · 4-3-3, 4-4-2, 4-2-3-1',
    defaultBudget: 500,
    allowedBudgets: [400, 500, 800],
    formationIds: ['4-3-3', '4-4-2', '4-2-3-1'],
    defaultFormationId: '4-3-3',
    benchSize: 3,
    formationChangeAllowed: true,
  },
];
