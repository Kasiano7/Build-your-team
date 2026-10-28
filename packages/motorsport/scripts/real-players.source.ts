/**
 * Formula 1 — source list for the "Formule 1 · pilotes et écuries réels" dataset.
 *
 * Names, nationalities (racing licence for drivers, team licence for
 * constructors), teams, power-unit suppliers and team principals are public
 * facts (2026 season grid as entered; later changes are not reflected).
 * The OVERALL value is an ESTIMATE by Build Your Team, not an official or
 * video-game rating. Detailed stats are generated from a role archetype +
 * optional traits (see generate-real-dataset.ts). No logos, no liveries.
 *
 * Traits (uppercase +5, lowercase −6):
 *   drivers       Q qualifying · R race pace · D overtaking · W wet · C consistency · E experience
 *   constructors  M engine · A aero · H chassis · F reliability · S strategy · P pit stops
 *   principals    L leadership · S strategy · T technical · P politics · D development · G management
 *
 * Commercial use of real names requires name/image rights (see docs/DATA_LICENSING.md).
 */
export type PersonRow = [name: string, short: string, nat: string, team: string, overall: number, traits?: string];
export type TeamRow = [name: string, short: string, nat: string, powerUnit: string, overall: number, traits?: string];

/** The 11 constructors of 2026. `nat` = country of the team licence. */
export const CONSTRUCTORS: TeamRow[] = [
  ['Mercedes', 'Mercedes', 'GER', 'Mercedes', 92, 'M'],
  ['McLaren', 'McLaren', 'GBR', 'Mercedes', 90, 'AH'],
  ['Ferrari', 'Ferrari', 'ITA', 'Ferrari', 88, 'P'],
  ['Red Bull Racing', 'Red Bull', 'AUT', 'Red Bull Ford', 86, 'P'],
  ['Alpine', 'Alpine', 'FRA', 'Mercedes', 78, 'M'],
  ['Williams', 'Williams', 'GBR', 'Mercedes', 78, 'S'],
  ['Haas', 'Haas', 'USA', 'Ferrari', 77, 'F'],
  ['Racing Bulls', 'RB', 'ITA', 'Red Bull Ford', 76],
  ['Audi', 'Audi', 'GER', 'Audi', 74],
  ['Aston Martin', 'Aston M.', 'GBR', 'Honda', 74, 'Af'],
  ['Cadillac', 'Cadillac', 'USA', 'Ferrari', 68, 'f'],
];

/** The 22 race drivers of the 2026 season. */
export const DRIVERS: PersonRow[] = [
  ['Max Verstappen', 'Verstappen', 'NED', 'Red Bull Racing', 96, 'RWD'],
  ['Isack Hadjar', 'Hadjar', 'FRA', 'Red Bull Racing', 83, 'De'],
  ['George Russell', 'Russell', 'GBR', 'Mercedes', 92, 'Q'],
  ['Andrea Kimi Antonelli', 'Antonelli', 'ITA', 'Mercedes', 88, 'Qe'],
  ['Lando Norris', 'Norris', 'GBR', 'McLaren', 92, 'Q'],
  ['Oscar Piastri', 'Piastri', 'AUS', 'McLaren', 91, 'C'],
  ['Charles Leclerc', 'Leclerc', 'MON', 'Ferrari', 92, 'QQ'],
  ['Lewis Hamilton', 'Hamilton', 'GBR', 'Ferrari', 89, 'WEE'],
  ['Fernando Alonso', 'Alonso', 'ESP', 'Aston Martin', 87, 'DEE'],
  ['Lance Stroll', 'Stroll', 'CAN', 'Aston Martin', 76, 'W'],
  ['Carlos Sainz', 'Sainz', 'ESP', 'Williams', 87, 'C'],
  ['Alexander Albon', 'Albon', 'THA', 'Williams', 84, 'C'],
  ['Liam Lawson', 'Lawson', 'NZL', 'Racing Bulls', 79, 'D'],
  ['Arvid Lindblad', 'Lindblad', 'GBR', 'Racing Bulls', 76, 'ee'],
  ['Pierre Gasly', 'Gasly', 'FRA', 'Alpine', 84, 'C'],
  ['Franco Colapinto', 'Colapinto', 'ARG', 'Alpine', 76, 'De'],
  ['Esteban Ocon', 'Ocon', 'FRA', 'Haas', 81, 'C'],
  ['Oliver Bearman', 'Bearman', 'GBR', 'Haas', 81, 'De'],
  ['Nico Hülkenberg', 'Hülkenberg', 'GER', 'Audi', 81, 'E'],
  ['Gabriel Bortoleto', 'Bortoleto', 'BRA', 'Audi', 80, 'e'],
  ['Sergio Pérez', 'Pérez', 'MEX', 'Cadillac', 81, 'RE'],
  ['Valtteri Bottas', 'Bottas', 'FIN', 'Cadillac', 80, 'QE'],
];

/** The person leading each team in 2026 (team principal or equivalent). */
export const PRINCIPALS: PersonRow[] = [
  ['Toto Wolff', 'Wolff', 'AUT', 'Mercedes', 91, 'P'],
  ['Andrea Stella', 'Stella', 'ITA', 'McLaren', 90, 'TS'],
  ['Adrian Newey', 'Newey', 'GBR', 'Aston Martin', 86, 'TTTp'],
  ['Frédéric Vasseur', 'Vasseur', 'FRA', 'Ferrari', 85, 'G'],
  ['Laurent Mekies', 'Mekies', 'FRA', 'Red Bull Racing', 84, 'T'],
  ['James Vowles', 'Vowles', 'GBR', 'Williams', 84, 'D'],
  ['Flavio Briatore', 'Briatore', 'ITA', 'Alpine', 82, 'PPt'],
  ['Mattia Binotto', 'Binotto', 'ITA', 'Audi', 81, 'T'],
  ['Ayao Komatsu', 'Komatsu', 'JPN', 'Haas', 80, 'T'],
  ['Alan Permane', 'Permane', 'GBR', 'Racing Bulls', 79, 'S'],
  ['Graeme Lowdon', 'Lowdon', 'GBR', 'Cadillac', 78, 'G'],
];
