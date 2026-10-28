/**
 * Real basketball players — source list for the "Basket · joueurs réels" dataset.
 *
 * Names, nationalities (national team), positions and teams are public facts
 * (rosters indicative for the 2025-2026 season; later trades are not reflected).
 * The OVERALL value is an ESTIMATE by Build Your Team, not an official or
 * video-game rating. Detailed stats are generated from a position archetype +
 * optional traits (see generate-real-dataset.ts).
 *
 * Traits: S shooting · I inside scoring · A passing · D dribbling · F defence · R rebounding
 *
 * Commercial use of real names requires name/image rights (see docs/DATA_LICENSING.md).
 */
export type Row = [name: string, short: string, nat: string, roles: string, team: string, overall: number, traits?: string];

export const REAL_PLAYERS: Row[] = [
  // Point guards / shooting guards
  ['Shai Gilgeous-Alexander', 'Gilgeous-Alexander', 'CAN', 'PG/SG', 'Oklahoma City Thunder', 96, 'ID'],
  ['Stephen Curry', 'Curry', 'USA', 'PG', 'Golden State Warriors', 92, 'SS'],
  ['Luka Dončić', 'Dončić', 'SVN', 'PG/SG', 'Los Angeles Lakers', 95, 'AR'],
  ['Jalen Brunson', 'Brunson', 'USA', 'PG', 'New York Knicks', 90, 'D'],
  ['Anthony Edwards', 'Edwards', 'USA', 'SG', 'Minnesota Timberwolves', 92, 'SI'],
  ['Donovan Mitchell', 'Mitchell', 'USA', 'SG', 'Cleveland Cavaliers', 90, 'S'],
  ['Devin Booker', 'Booker', 'USA', 'SG', 'Phoenix Suns', 88, 'S'],
  ['Tyrese Haliburton', 'Haliburton', 'USA', 'PG', 'Indiana Pacers', 88, 'A'],
  ['Cade Cunningham', 'Cunningham', 'USA', 'PG', 'Detroit Pistons', 90, 'A'],
  ['Ja Morant', 'Morant', 'USA', 'PG', 'Memphis Grizzlies', 87, 'ID'],
  ['Trae Young', 'Young', 'USA', 'PG', 'Atlanta Hawks', 87, 'A'],
  ['De\'Aaron Fox', 'Fox', 'USA', 'PG', 'San Antonio Spurs', 87, 'D'],
  ['Tyrese Maxey', 'Maxey', 'USA', 'PG/SG', 'Philadelphia 76ers', 88, 'S'],
  ['Jalen Williams', 'J. Williams', 'USA', 'SG/SF', 'Oklahoma City Thunder', 88, 'F'],
  ['Kyrie Irving', 'Irving', 'AUS', 'PG', 'Dallas Mavericks', 87, 'DD'],
  ['James Harden', 'Harden', 'USA', 'PG', 'Los Angeles Clippers', 87, 'AA'],
  ['Jamal Murray', 'Murray', 'CAN', 'PG', 'Denver Nuggets', 87, 'S'],
  ['Damian Lillard', 'Lillard', 'USA', 'PG', 'Portland Trail Blazers', 85, 'S'],
  ['LaMelo Ball', 'Ball', 'USA', 'PG', 'Charlotte Hornets', 86, 'A'],
  ['Darius Garland', 'Garland', 'USA', 'PG', 'Cleveland Cavaliers', 85, 'A'],
  ['Derrick White', 'White', 'USA', 'SG/PG', 'Boston Celtics', 85, 'F'],
  ['Jrue Holiday', 'Holiday', 'USA', 'PG/SG', 'Portland Trail Blazers', 83, 'F'],
  ['Desmond Bane', 'Bane', 'USA', 'SG', 'Orlando Magic', 84, 'S'],
  ['Zach LaVine', 'LaVine', 'USA', 'SG', 'Sacramento Kings', 84, 'S'],
  ['Austin Reaves', 'Reaves', 'USA', 'SG', 'Los Angeles Lakers', 85],
  ['Fred VanVleet', 'VanVleet', 'USA', 'PG', 'Houston Rockets', 82, 'F'],
  ['Dejounte Murray', 'D. Murray', 'USA', 'PG', 'New Orleans Pelicans', 82, 'F'],
  ['Stephon Castle', 'Castle', 'USA', 'SG/PG', 'San Antonio Spurs', 82],
  ['Dylan Harper', 'Harper', 'USA', 'SG', 'San Antonio Spurs', 79, 'D'],

  // Small forwards / power forwards
  ['LeBron James', 'James', 'USA', 'SF/PF', 'Los Angeles Lakers', 91, 'AI'],
  ['Kevin Durant', 'Durant', 'USA', 'SF/PF', 'Houston Rockets', 91, 'SS'],
  ['Giannis Antetokounmpo', 'Antetokounmpo', 'GRE', 'PF', 'Milwaukee Bucks', 95, 'IR'],
  ['Jayson Tatum', 'Tatum', 'USA', 'SF/PF', 'Boston Celtics', 92, 'S'],
  ['Jaylen Brown', 'Brown', 'USA', 'SF', 'Boston Celtics', 88],
  ['Kawhi Leonard', 'Leonard', 'USA', 'SF', 'Los Angeles Clippers', 88, 'F'],
  ['Jimmy Butler', 'Butler', 'USA', 'SF', 'Golden State Warriors', 86, 'F'],
  ['Paul George', 'George', 'USA', 'SF', 'Philadelphia 76ers', 83, 'S'],
  ['Paolo Banchero', 'Banchero', 'USA', 'PF/SF', 'Orlando Magic', 88, 'I'],
  ['Franz Wagner', 'F. Wagner', 'GER', 'SF', 'Orlando Magic', 86, 'D'],
  ['Zion Williamson', 'Williamson', 'USA', 'PF', 'New Orleans Pelicans', 86, 'II'],
  ['Scottie Barnes', 'Barnes', 'CAN', 'SF/PF', 'Toronto Raptors', 86, 'A'],
  ['Pascal Siakam', 'Siakam', 'CMR', 'PF', 'Indiana Pacers', 86, 'I'],
  ['Lauri Markkanen', 'Markkanen', 'FIN', 'PF', 'Utah Jazz', 85, 'S'],
  ['Mikal Bridges', 'Bridges', 'USA', 'SF', 'New York Knicks', 84, 'F'],
  ['OG Anunoby', 'Anunoby', 'GBR', 'SF/PF', 'New York Knicks', 84, 'F'],
  ['Jalen Johnson', 'J. Johnson', 'USA', 'SF/PF', 'Atlanta Hawks', 86, 'R'],
  ['Cooper Flagg', 'Flagg', 'USA', 'SF/PF', 'Dallas Mavericks', 84, 'F'],
  ['Brandon Miller', 'Miller', 'USA', 'SF', 'Charlotte Hornets', 83, 'S'],
  ['Amen Thompson', 'A. Thompson', 'USA', 'SF/SG', 'Houston Rockets', 85, 'F'],
  ['Deni Avdija', 'Avdija', 'ISR', 'SF/PF', 'Portland Trail Blazers', 85],
  ['Trey Murphy III', 'Murphy III', 'USA', 'SF', 'New Orleans Pelicans', 83, 'S'],
  ['Jaden McDaniels', 'McDaniels', 'USA', 'SF/PF', 'Minnesota Timberwolves', 82, 'F'],
  ['DeMar DeRozan', 'DeRozan', 'USA', 'SF', 'Sacramento Kings', 82, 'I'],
  ['Michael Porter Jr.', 'Porter Jr.', 'USA', 'SF/PF', 'Brooklyn Nets', 83, 'S'],
  ['Aaron Gordon', 'Gordon', 'USA', 'PF', 'Denver Nuggets', 83, 'F'],
  ['Jaren Jackson Jr.', 'Jackson Jr.', 'USA', 'PF/C', 'Memphis Grizzlies', 87, 'FF'],
  ['Evan Mobley', 'Mobley', 'USA', 'PF/C', 'Cleveland Cavaliers', 88, 'FR'],
  ['Anthony Davis', 'Davis', 'USA', 'PF/C', 'Dallas Mavericks', 89, 'FR'],

  // Centers
  ['Nikola Jokić', 'Jokić', 'SRB', 'C', 'Denver Nuggets', 97, 'AAAAI'],
  ['Victor Wembanyama', 'Wembanyama', 'FRA', 'C/PF', 'San Antonio Spurs', 94, 'FFS'],
  ['Joel Embiid', 'Embiid', 'USA', 'C', 'Philadelphia 76ers', 89, 'I'],
  ['Karl-Anthony Towns', 'Towns', 'DOM', 'C/PF', 'New York Knicks', 89, 'S'],
  ['Bam Adebayo', 'Adebayo', 'USA', 'C', 'Miami Heat', 87, 'F'],
  ['Domantas Sabonis', 'Sabonis', 'LTU', 'C/PF', 'Sacramento Kings', 87, 'AR'],
  ['Alperen Şengün', 'Şengün', 'TUR', 'C', 'Houston Rockets', 88, 'A'],
  ['Chet Holmgren', 'Holmgren', 'USA', 'C/PF', 'Oklahoma City Thunder', 87, 'F'],
  ['Rudy Gobert', 'Gobert', 'FRA', 'C', 'Minnesota Timberwolves', 85, 'FR'],
  ['Jarrett Allen', 'Allen', 'USA', 'C', 'Cleveland Cavaliers', 84, 'R'],
  ['Myles Turner', 'Turner', 'USA', 'C', 'Milwaukee Bucks', 84, 'F'],
  ['Ivica Zubac', 'Zubac', 'CRO', 'C', 'Los Angeles Clippers', 84, 'R'],
  ['Kristaps Porziņģis', 'Porziņģis', 'LAT', 'C/PF', 'Atlanta Hawks', 84, 'S'],
  ['Jalen Duren', 'Duren', 'USA', 'C', 'Detroit Pistons', 84, 'R'],
  ['Isaiah Hartenstein', 'Hartenstein', 'GER', 'C', 'Oklahoma City Thunder', 82, 'R'],
  ['Nikola Vučević', 'Vučević', 'MNE', 'C', 'Chicago Bulls', 82, 'R'],
  ['Brook Lopez', 'Lopez', 'USA', 'C', 'Los Angeles Clippers', 80, 'F'],
  ['Walker Kessler', 'Kessler', 'USA', 'C', 'Utah Jazz', 81, 'F'],
  ['Deandre Ayton', 'Ayton', 'BAH', 'C', 'Los Angeles Lakers', 81, 'R'],
  ['Clint Capela', 'Capela', 'SUI', 'C', 'Houston Rockets', 78, 'R'],
];
