/**
 * Rugby union universe definitions: roles, groups, attribute set, tiers,
 * line-ups (pitch positions) and game modes. Pure data — the engine,
 * server and UI are the same as for football.
 */
import type { AttributeDef, FormationDef, FormationSlot, GameModeDef, RoleDef, RoleGroupDef, ThemeDef, TierDef } from '@byt/shared';

export const RUGBY_ROLES: RoleDef[] = [
  { id: 'PIL', label: 'Pilier', group: 'AV' },
  { id: 'TAL', label: 'Talonneur', group: 'AV' },
  { id: '2L', label: 'Deuxième ligne', group: 'AV' },
  { id: '3L', label: 'Troisième ligne aile', group: 'AV' },
  { id: 'N8', label: 'Numéro 8', group: 'AV' },
  { id: 'DM', label: 'Demi de mêlée', group: 'DE' },
  { id: 'DO', label: "Demi d'ouverture", group: 'DE' },
  { id: 'CEN', label: 'Centre', group: 'TQ' },
  { id: 'AIL', label: 'Ailier', group: 'TQ' },
  { id: 'ARR', label: 'Arrière', group: 'TQ' },
];

export const RUGBY_GROUPS: RoleGroupDef[] = [
  { id: 'AV', label: 'Avants', attributeSet: 'rugby' },
  { id: 'DE', label: 'Demis', attributeSet: 'rugby' },
  { id: 'TQ', label: 'Trois-quarts', attributeSet: 'rugby' },
];

export const RUGBY_ATTRIBUTES: AttributeDef[] = [
  { key: 'VIT', label: 'Vitesse' },
  { key: 'PUI', label: 'Puissance' },
  { key: 'PLA', label: 'Plaquage' },
  { key: 'JEU', label: 'Jeu au pied' },
  { key: 'MAI', label: 'Mains / passe' },
  { key: 'END', label: 'Endurance' },
];

/** Ratings are estimated on a ~76-96 scale (international players only). */
export const RUGBY_TIERS: TierDef[] = [
  { id: 'bronze', label: 'Remplaçant', minOverall: 0, style: 'bronze' },
  { id: 'silver', label: 'International', minOverall: 80, style: 'silver' },
  { id: 'gold', label: 'Titulaire', minOverall: 83, style: 'gold' },
  { id: 'elite', label: 'Mondial', minOverall: 87, style: 'elite' },
  { id: 'icon', label: 'Légende', minOverall: 92, style: 'icon' },
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
 * Coordinates: x left→right, y from your own try line (0, near the viewer)
 * to the opponents' (1). Forwards are up front (far), the full-back is the
 * last line of defence (near).
 */
export const RUGBY_FORMATIONS: FormationDef[] = [
  {
    id: 'rg-seven',
    label: 'Rugby à 7',
    slots: [
      slot('PIL', 'PIL', 'AV', ['PIL', 'TAL'], 0.25, 0.84),
      slot('TAL', 'TAL', 'AV', ['TAL'], 0.5, 0.86),
      slot('3L', '3L', 'AV', ['3L', 'N8', '2L'], 0.75, 0.84),
      slot('DM', 'DM', 'DE', ['DM'], 0.5, 0.62),
      slot('DO', 'DO', 'DE', ['DO'], 0.25, 0.42),
      slot('CEN', 'CEN', 'TQ', ['CEN'], 0.75, 0.42),
      slot('AIL', 'AIL', 'TQ', ['AIL', 'ARR'], 0.5, 0.18),
    ],
  },
  {
    id: 'rg-xv',
    label: 'XV de départ',
    slots: [
      // Front row (1-2-3)
      slot('1', 'PIL', 'AV', ['PIL'], 0.3, 0.92),
      slot('2', 'TAL', 'AV', ['TAL'], 0.5, 0.93),
      slot('3', 'PIL', 'AV', ['PIL'], 0.7, 0.92),
      // Second row (4-5)
      slot('4', '2L', 'AV', ['2L'], 0.38, 0.77),
      slot('5', '2L', 'AV', ['2L'], 0.62, 0.77),
      // Back row (6-7-8)
      slot('6', '3L', 'AV', ['3L', 'N8'], 0.12, 0.76),
      slot('7', '3L', 'AV', ['3L', 'N8'], 0.88, 0.76),
      slot('8', 'N8', 'AV', ['N8', '3L'], 0.5, 0.6),
      // Half-backs (9-10)
      slot('9', 'DM', 'DE', ['DM'], 0.2, 0.58),
      slot('10', 'DO', 'DE', ['DO'], 0.3, 0.4),
      // Three-quarters (11-15)
      slot('11', 'AIL', 'TQ', ['AIL'], 0.08, 0.4),
      slot('12', 'CEN', 'TQ', ['CEN'], 0.52, 0.4),
      slot('13', 'CEN', 'TQ', ['CEN'], 0.72, 0.4),
      slot('14', 'AIL', 'TQ', ['AIL'], 0.92, 0.4),
      slot('15', 'ARR', 'TQ', ['ARR'], 0.5, 0.14),
    ],
  },
];

export const RUGBY_MODES: GameModeDef[] = [
  {
    id: 'quick',
    label: 'Rapide',
    description: '7 joueurs · rugby à 7 : 3 avants, 2 demis, 2 trois-quarts',
    defaultBudget: 200,
    allowedBudgets: [150, 200, 300],
    formationIds: ['rg-seven'],
    defaultFormationId: 'rg-seven',
    benchSize: 0,
    formationChangeAllowed: false,
  },
  {
    id: 'classic',
    label: 'Classique',
    description: '15 titulaires + 4 remplaçants · XV de départ (numéros 1 à 15)',
    defaultBudget: 500,
    allowedBudgets: [400, 500, 800],
    formationIds: ['rg-xv'],
    defaultFormationId: 'rg-xv',
    benchSize: 4,
    formationChangeAllowed: false,
  },
];

/** Thematic drafts (the engine refuses a theme that cannot fill every team: themeShortfall). */
export const RUGBY_THEMES: ThemeDef[] = [
  { id: 'elite', label: 'Élite', description: 'Uniquement les joueurs notés 85 et plus.', filter: { minOverall: 85 } },
  { id: 'outsiders', label: 'Outsiders', description: 'Aucun joueur au-dessus de 82 : place aux bonnes affaires.', filter: { maxOverall: 82 } },
  { id: 'six-nations', label: 'Six Nations', description: 'Joueurs de France, Angleterre, Irlande, Écosse, Galles et Italie.', filter: { nationalities: ['FRA', 'ENG', 'IRL', 'SCO', 'WAL', 'ITA'] } },
  { id: 'hemisphere-sud', label: 'Hémisphère Sud', description: 'Joueurs de Nouvelle-Zélande, Afrique du Sud, Australie, Argentine, Fidji, Japon…', filter: { nationalities: ['NZL', 'RSA', 'AUS', 'ARG', 'FIJ', 'SAM', 'TGA', 'JPN'] } },
  { id: 'xv-de-france', label: 'XV de France', description: 'Uniquement des joueurs français (2 équipes).', filter: { nationalities: ['FRA'] } },
];
