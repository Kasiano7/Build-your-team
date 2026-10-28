/**
 * Formula 1 universe definitions: roles (driver, constructor, team
 * principal), one attribute set per group, tiers, the pit-lane line-up and
 * game modes. Pure data — the engine, server and UI are the same as for
 * football and basketball.
 */
import type { AttributeDef, FormationDef, FormationSlot, GameModeDef, RoleDef, RoleGroupDef, TierDef } from '@byt/shared';

export const MOTORSPORT_ROLES: RoleDef[] = [
  { id: 'PIL', label: 'Pilote', group: 'PIL' },
  { id: 'ECU', label: 'Écurie', group: 'ECU' },
  { id: 'DIR', label: "Directeur d'écurie", group: 'DIR' },
];

export const MOTORSPORT_GROUPS: RoleGroupDef[] = [
  { id: 'PIL', label: 'Pilotes', attributeSet: 'driver' },
  { id: 'ECU', label: 'Écuries', attributeSet: 'constructor' },
  { id: 'DIR', label: "Directeurs d'écurie", attributeSet: 'principal' },
];

export const DRIVER_ATTRIBUTES: AttributeDef[] = [
  { key: 'QUA', label: 'Qualif' },
  { key: 'RYT', label: 'Rythme course' },
  { key: 'DEP', label: 'Dépassement' },
  { key: 'PLU', label: 'Pluie' },
  { key: 'REG', label: 'Régularité' },
  { key: 'EXP', label: 'Expérience' },
];

export const CONSTRUCTOR_ATTRIBUTES: AttributeDef[] = [
  { key: 'MOT', label: 'Moteur' },
  { key: 'AER', label: 'Aéro' },
  { key: 'CHA', label: 'Châssis' },
  { key: 'FIA', label: 'Fiabilité' },
  { key: 'STR', label: 'Stratégie' },
  { key: 'STA', label: 'Arrêts aux stands' },
];

export const PRINCIPAL_ATTRIBUTES: AttributeDef[] = [
  { key: 'LEA', label: 'Leadership' },
  { key: 'STR', label: 'Stratégie' },
  { key: 'TEC', label: 'Technique' },
  { key: 'POL', label: 'Politique' },
  { key: 'DEV', label: 'Développement' },
  { key: 'GES', label: 'Gestion' },
];

export const MOTORSPORT_TIERS: TierDef[] = [
  { id: 'bronze', label: 'Fond de grille', minOverall: 0, style: 'bronze' },
  { id: 'silver', label: 'Milieu de grille', minOverall: 76, style: 'silver' },
  { id: 'gold', label: 'Points réguliers', minOverall: 82, style: 'gold' },
  { id: 'elite', label: 'Vainqueur de GP', minOverall: 87, style: 'elite' },
  { id: 'icon', label: 'Champion', minOverall: 92, style: 'icon' },
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
 * Coordinates in a pit-lane / garage scene: x left→right, y depth from the
 * viewer (0, pit wall side) to the back of the garage (1).
 */
export const MOTORSPORT_FORMATIONS: FormationDef[] = [
  {
    id: 'f1-team',
    label: 'Écurie complète',
    slots: [
      slot('P1', 'P1', 'PIL', ['PIL'], 0.3, 0.25),
      slot('P2', 'P2', 'PIL', ['PIL'], 0.7, 0.25),
      slot('ECU', 'ÉCU', 'ECU', ['ECU'], 0.5, 0.6),
      slot('DIR', 'DIR', 'DIR', ['DIR'], 0.5, 0.88),
    ],
  },
];

export const MOTORSPORT_MODES: GameModeDef[] = [
  {
    id: 'quick',
    label: 'Rapide',
    description: '4 recrues · 2 pilotes, 1 écurie, 1 directeur',
    defaultBudget: 200,
    allowedBudgets: [150, 200, 300],
    formationIds: ['f1-team'],
    defaultFormationId: 'f1-team',
    benchSize: 0,
    formationChangeAllowed: false,
  },
  {
    id: 'classic',
    label: 'Classique',
    description: '2 pilotes, 1 écurie, 1 directeur + 2 pilotes de réserve',
    defaultBudget: 300,
    allowedBudgets: [250, 300, 400],
    formationIds: ['f1-team'],
    defaultFormationId: 'f1-team',
    benchSize: 2,
    formationChangeAllowed: false,
  },
];
