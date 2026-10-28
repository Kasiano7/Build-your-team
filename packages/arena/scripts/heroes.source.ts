/**
 * "Arènes de Solcendre" — source list of ORIGINAL heroes (invented universe).
 *
 * Every realm, place and hero name below is invented for Build Your Team and
 * does not reference any existing franchise, game, film or book. Overall
 * values are design choices; detailed stats are generated from a role
 * archetype + optional traits + a deterministic jitter (see generate-heroes.ts).
 *
 * Traits: F force · A agilité · R arcane · D défense · V vitalité · E esprit
 */
export type Row = [name: string, short: string, realm: string, roles: string, overall: number, traits?: string];

/** Invented realms: 3-letter code → display name (used as `affiliation`). */
export const REALMS: Record<string, string> = {
  SOL: 'Cité libre de Solcendre',
  ORV: "Sylves d'Orvanne",
  KHE: 'Sultanat de Kheyrân',
  HVE: 'Jarlats de Hvessa',
  TZA: 'Empire de Tzalmec',
  OSE: "Archipel d'Ōsenka",
  KOU: 'Royaume de Kounama',
  MOR: 'Duché de Morvaille',
  CAL: 'Sérénissime de Calvèze',
  IRK: "Steppes d'Irkhane",
  DRE: 'Principauté de Drevna',
};

export const HEROES: Row[] = [
  // Gardiens (GAR)
  ['Bragh Holmskjold', 'Bragh', 'HVE', 'GAR', 95, 'DV'],
  ['Itzal Tecuamani', 'Itzal', 'TZA', 'GAR/LAM', 92, 'F'],
  ['Ombeline de Vaucrest', 'Ombeline', 'MOR', 'GAR', 89, 'D'],
  ['Oumarou Kessendé', 'Oumarou', 'KOU', 'GAR', 87, 'V'],
  ['Ravil Tcherkhane', 'Ravil', 'IRK', 'GAR/LAM', 85, 'F'],
  ['Daromir Velkosz', 'Daromir', 'DRE', 'GAR', 84, 'DD'],
  ['Hakan Seyrûn', 'Hakan', 'KHE', 'GAR', 82],
  ['Tessaly Morne-Écu', 'Tessaly', 'SOL', 'GAR', 81, 'D'],
  ['Gaïus Peravento', 'Gaïus', 'CAL', 'GAR', 79, 'V'],
  ['Rendaï Tsugawara', 'Rendaï', 'OSE', 'GAR', 78, 'D'],
  ['Brannoc Lierre-Dur', 'Brannoc', 'ORV', 'GAR', 76],
  ['Yelka Zorevna', 'Yelka', 'DRE', 'GAR', 74, 'V'],
  ['Mbaye Toroundé', 'Mbaye', 'KOU', 'GAR', 72],
  ['Solveig Ankerhal', 'Solveig', 'HVE', 'GAR', 70, 'D'],
  ['Feyrouz al-Qaram', 'Feyrouz', 'KHE', 'GAR/SOI', 68, 'E'],
  ['Aubin Grisemaille', 'Aubin', 'MOR', 'GAR', 66],

  // Lames (LAM)
  ['Sarnaï Dzöloo', 'Sarnaï', 'IRK', 'LAM', 97, 'AF'],
  ['Isarre Nocteval', 'Isarre', 'SOL', 'LAM/ARC', 93, 'A'],
  ['Tomasz Ryveniec', 'Tomasz', 'DRE', 'LAM', 90, 'F'],
  ['Akemi Haragane', 'Akemi', 'OSE', 'LAM', 88, 'AA'],
  ['Zahir ben-Sahar', 'Zahir', 'KHE', 'LAM', 87, 'A'],
  ['Cuauhtli Ixmaná', 'Cuauhtli', 'TZA', 'LAM', 85, 'F'],
  ['Rodolphe de Malvigne', 'Rodolphe', 'MOR', 'LAM/GAR', 84, 'D'],
  ['Ilvane Coudrier', 'Ilvane', 'ORV', 'LAM', 83, 'A'],
  ['Eskil Ravnstad', 'Eskil', 'HVE', 'LAM', 81, 'FF'],
  ['Nnenna Obakoro', 'Nnenna', 'KOU', 'LAM', 80, 'A'],
  ['Lucan Ferravelli', 'Lucan', 'CAL', 'LAM', 79],
  ['Temür Ögedal', 'Temür', 'IRK', 'LAM', 77, 'F'],
  ['Mireille Fendacier', 'Mireille', 'SOL', 'LAM', 76, 'A'],
  ['Yaotl Chimalpan', 'Yaotl', 'TZA', 'LAM', 74, 'V'],
  ['Haruto Sagiri', 'Haruto', 'OSE', 'LAM/ARC', 72, 'A'],
  ['Vesna Krobatek', 'Vesna', 'DRE', 'LAM', 70],
  ['Dunstan Orgemoule', 'Dunstan', 'ORV', 'LAM', 68, 'F'],
  ['Kassim Ouarzel', 'Kassim', 'KHE', 'LAM', 65],

  // Archers (ARC)
  ['Elowen Fléchebrume', 'Elowen', 'ORV', 'ARC', 94, 'AE'],
  ['Tsetseg Altanbar', 'Tsetseg', 'IRK', 'ARC', 91, 'A'],
  ['Nayeli Ixcatlán', 'Nayeli', 'TZA', 'ARC/LAM', 88],
  ['Ysolde Pertuis', 'Ysolde', 'MOR', 'ARC', 86, 'E'],
  ['Ragnfrid Ulvhorn', 'Ragnfrid', 'HVE', 'ARC', 84, 'F'],
  ['Amara Diallé', 'Amara', 'KOU', 'ARC', 83, 'A'],
  ['Corvin Saltarel', 'Corvin', 'CAL', 'ARC', 82],
  ['Rin Kazehaya', 'Rin', 'OSE', 'ARC', 80, 'AA'],
  ['Bohdan Lutovski', 'Bohdan', 'DRE', 'ARC', 79, 'V'],
  ['Samira Qassân', 'Samira', 'KHE', 'ARC', 77, 'E'],
  ['Faelan Mousseronde', 'Faelan', 'ORV', 'ARC', 76],
  ['Léonce Tirevent', 'Léonce', 'SOL', 'ARC', 74, 'A'],
  ['Chagatai Burkhal', 'Chagatai', 'IRK', 'ARC/LAM', 73, 'F'],
  ['Ines Calavrone', 'Ines', 'CAL', 'ARC', 71],
  ['Ayo Sekundé', 'Ayo', 'KOU', 'ARC', 69, 'A'],
  ['Thyra Vindsund', 'Thyra', 'HVE', 'ARC', 67],
  ['Pernelle Gaudrive', 'Pernelle', 'MOR', 'ARC', 65, 'E'],

  // Arcanistes (MAG)
  ['Azénor Cendrelys', 'Azénor', 'SOL', 'MAG', 96, 'RR'],
  ['Malik Zaffarân', 'Malik', 'KHE', 'MAG', 92, 'R'],
  ['Xochiyotl Amacueyo', 'Xochiyotl', 'TZA', 'MAG', 89, 'E'],
  ['Vasilisa Mrakova', 'Vasilisa', 'DRE', 'MAG/AUG', 87, 'E'],
  ['Seiran Tokimura', 'Seiran', 'OSE', 'MAG', 86, 'R'],
  ['Gwenvaël Brisetorche', 'Gwenvaël', 'ORV', 'MAG', 84],
  ['Adaeze Ndomaré', 'Adaeze', 'KOU', 'MAG', 83, 'R'],
  ['Ottavio Brunalesco', 'Ottavio', 'CAL', 'MAG', 81, 'E'],
  ['Sigrún Eldhjarta', 'Sigrún', 'HVE', 'MAG', 80, 'R'],
  ['Barsoum Elkhaïr', 'Barsoum', 'KHE', 'MAG', 78],
  ['Clémence Sombrevaux', 'Clémence', 'MOR', 'MAG', 77, 'E'],
  ['Altan Gerelkhan', 'Altan', 'IRK', 'MAG', 75, 'R'],
  ['Yūna Akishiro', 'Yūna', 'OSE', 'MAG/SOI', 73, 'E'],
  ['Radek Volchanin', 'Radek', 'DRE', 'MAG', 71],
  ['Tiago Serramor', 'Tiago', 'SOL', 'MAG', 69, 'R'],
  ['Eithne Saulecreuse', 'Eithne', 'ORV', 'MAG', 67],
  ['Bakari Ousmanou', 'Bakari', 'KOU', 'MAG', 65, 'E'],

  // Soigneurs (SOI)
  ['Séraphine Aubeclaire', 'Séraphine', 'SOL', 'SOI', 93, 'EV'],
  ['Imani Kéladou', 'Imani', 'KOU', 'SOI', 89, 'E'],
  ['Citlali Ozomalcan', 'Citlali', 'TZA', 'SOI', 86, 'V'],
  ['Aurèle Mainsauve', 'Aurèle', 'MOR', 'SOI', 84, 'E'],
  ['Ingrid Lysthaven', 'Ingrid', 'HVE', 'SOI/GAR', 82, 'D'],
  ['Nour Saffiyé', 'Nour', 'KHE', 'SOI', 80, 'E'],
  ['Hana Mizuchiyo', 'Hana', 'OSE', 'SOI', 78],
  ['Bryony Cœurdechêne', 'Bryony', 'ORV', 'SOI', 76, 'V'],
  ['Mirela Dobrovan', 'Mirela', 'DRE', 'SOI', 74, 'E'],
  ['Bataar Khöömel', 'Bataar', 'IRK', 'SOI', 71],
  ['Fiorella Santaguzzi', 'Fiorella', 'CAL', 'SOI', 69, 'E'],
  ['Abel Pansevent', 'Abel', 'SOL', 'SOI', 66],

  // Augures (AUG)
  ['Oriane Chantegivre', 'Oriane', 'SOL', 'AUG', 91, 'ER'],
  ['Kaito Yorunagi', 'Kaito', 'OSE', 'AUG/MAG', 88, 'R'],
  ['Djeneba Sorokané', 'Djeneba', 'KOU', 'AUG', 85, 'E'],
  ['Halvard Runeskog', 'Halvard', 'HVE', 'AUG', 83, 'V'],
  ['Shirin Ashkavan', 'Shirin', 'KHE', 'AUG', 81, 'E'],
  ['Teodora Belcastro', 'Teodora', 'CAL', 'AUG', 78],
  ['Mazatl Ocuitec', 'Mazatl', 'TZA', 'AUG/ARC', 76, 'A'],
  ['Gildas Carillonne', 'Gildas', 'MOR', 'AUG', 73, 'E'],
  ['Oyuun Tsagaanbel', 'Oyuun', 'IRK', 'AUG', 70],
  ['Lazar Svetomir', 'Lazar', 'DRE', 'AUG', 67, 'E'],
];
