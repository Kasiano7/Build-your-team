/**
 * Simulated matches and tournament, deterministic from the room RNG.
 * Team strength = average overall of the starters (the same team rating the
 * vote screen shows), plus noise. Each universe has its own scoring model.
 *
 *  2 teams → one final · 3 teams → round robin · 4 teams → semi-finals,
 *  third-place match and final · motorsport → one Grand Prix with every team.
 */
import type { ContentPack, Participant, RoomState, SimMatch, SimulationResult } from '@byt/shared';
import { nextRandom } from './rng';
import { getCharacter, teamRating } from './team';

class Rng {
  constructor(public state: number) {}
  next(): number {
    const r = nextRandom(this.state);
    this.state = r.state;
    return r.value;
  }
  normal(mean = 0, sd = 1): number {
    const u = Math.max(1e-9, this.next());
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  poisson(lambda: number): number {
    const l = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > l && k < 30);
    return k - 1;
  }
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

interface Played {
  scoreA: number;
  scoreB: number;
  /** Knockout decider (penalties, overtime…) when the score is level. */
  winner?: 'a' | 'b';
  note?: string;
}

type Model = (diff: number, rng: Rng, knockout: boolean) => Played;

const MODELS: Record<string, { label: string; play: Model }> = {
  football: {
    label: 'buts',
    play: (d, rng, ko) => {
      const a = rng.poisson(1.35 * Math.exp(d / 11));
      const b = rng.poisson(1.35 * Math.exp(-d / 11));
      if (a === b && ko) return { scoreA: a, scoreB: b, winner: rng.next() < sigmoid(d / 6) ? 'a' : 'b', note: 'tirs au but' };
      return { scoreA: a, scoreB: b };
    },
  },
  basketball: {
    label: 'points',
    play: (d, rng) => {
      let a = Math.round(rng.normal(106 + d * 1.4, 9));
      let b = Math.round(rng.normal(106 - d * 1.4, 9));
      let note: string | undefined;
      while (a === b) {
        a += Math.round(rng.normal(9 + d * 0.2, 3));
        b += Math.round(rng.normal(9 - d * 0.2, 3));
        note = 'prolongation';
      }
      return { scoreA: a, scoreB: b, note };
    },
  },
  rugby: {
    label: 'points',
    play: (d, rng, ko) => {
      const side = (k: number) => {
        const tries = rng.poisson(2.6 * Math.exp((k * d) / 12));
        let conv = 0;
        for (let i = 0; i < tries; i++) if (rng.next() < 0.72) conv++;
        return tries * 5 + conv * 2 + rng.poisson(2.1) * 3;
      };
      const a = side(1);
      const b = side(-1);
      if (a === b && ko) return { scoreA: a, scoreB: b, winner: rng.next() < sigmoid(d / 6) ? 'a' : 'b', note: 'mort subite' };
      return { scoreA: a, scoreB: b };
    },
  },
  arena: {
    label: 'manches',
    play: (d, rng) => {
      let a = 0;
      let b = 0;
      while (a < 3 && b < 3) {
        if (rng.next() < sigmoid(d / 6)) a++;
        else b++;
      }
      return { scoreA: a, scoreB: b };
    },
  },
};

function play(model: Model, teamA: Participant, teamB: Participant, ratings: Map<string, number>, rng: Rng, round: string, knockout: boolean): SimMatch {
  const diff = ratings.get(teamA.id)! - ratings.get(teamB.id)!;
  const r = model(diff, rng, knockout);
  const winnerId = r.scoreA > r.scoreB ? teamA.id : r.scoreB > r.scoreA ? teamB.id : r.winner ? (r.winner === 'a' ? teamA.id : teamB.id) : null;
  return { round, aId: teamA.id, bId: teamB.id, scoreA: r.scoreA, scoreB: r.scoreB, winnerId, ...(r.note ? { note: r.note } : {}) };
}

const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

/** Motorsport: one Grand Prix. Driver pace = driver + 0.6 × constructor + 0.25 × principal + noise. */
function race(state: RoomState, pack: ContentPack, rng: Rng, ratings: Map<string, number>): SimulationResult {
  const entries: { teamId: string; pace: number }[] = [];
  for (const p of state.participants) {
    const chars = p.team.starters.filter((x): x is string => !!x).map((id) => getCharacter(pack, id));
    const role = (r: string) => chars.filter((c) => c.roles[0] === r);
    const ecu = role('ECU')[0]?.overall ?? 70;
    const dir = role('DIR')[0]?.overall ?? 70;
    const drivers = role('PIL');
    for (const d of drivers.length ? drivers : [{ overall: ratings.get(p.id)! }]) {
      entries.push({ teamId: p.id, pace: d.overall + 0.6 * ecu + 0.25 * dir + rng.normal(0, 4) });
    }
  }
  entries.sort((a, b) => b.pace - a.pace);
  const points: Record<string, number> = Object.fromEntries(state.participants.map((p) => [p.id, 0]));
  entries.forEach((e, i) => (points[e.teamId] = (points[e.teamId] ?? 0) + (F1_POINTS[i] ?? 0)));
  const ranking = [...state.participants]
    .sort((a, b) => points[b.id]! - points[a.id]! || ratings.get(b.id)! - ratings.get(a.id)! || a.seat - b.seat)
    .map((p) => p.id);
  return { kind: 'race', scoreLabel: 'points', matches: [], ranking, championId: ranking[0]!, points };
}

export function simulate(state: RoomState, pack: ContentPack): { result: SimulationResult; rngState: number } {
  const rng = new Rng(state.rngState ^ 0x9e3779b9);
  const ratings = new Map(state.participants.map((p) => [p.id, teamRating(pack, p.team)]));
  if (pack.universeId === 'motorsport') {
    const result = race(state, pack, rng, ratings);
    return { result, rngState: rng.state >>> 0 };
  }
  const model = MODELS[pack.universeId] ?? MODELS.basketball!;
  const teams = [...state.participants].sort((a, b) => ratings.get(b.id)! - ratings.get(a.id)! || a.seat - b.seat);
  const matches: SimMatch[] = [];
  let ranking: string[];

  if (teams.length === 2) {
    const m = play(model.play, teams[0]!, teams[1]!, ratings, rng, 'Finale', true);
    matches.push(m);
    ranking = [m.winnerId!, m.winnerId === teams[0]!.id ? teams[1]!.id : teams[0]!.id];
  } else if (teams.length === 3) {
    const table = new Map(teams.map((t) => [t.id, { pts: 0, diff: 0 }]));
    for (const [i, j] of [[0, 1], [1, 2], [0, 2]] as const) {
      const m = play(model.play, teams[i]!, teams[j]!, ratings, rng, 'Poule', false);
      matches.push(m);
      const ta = table.get(m.aId)!;
      const tb = table.get(m.bId)!;
      ta.diff += m.scoreA - m.scoreB;
      tb.diff += m.scoreB - m.scoreA;
      if (m.winnerId === m.aId) ta.pts += 3;
      else if (m.winnerId === m.bId) tb.pts += 3;
      else {
        ta.pts += 1;
        tb.pts += 1;
      }
    }
    ranking = teams
      .map((t) => t.id)
      .sort((a, b) => table.get(b)!.pts - table.get(a)!.pts || table.get(b)!.diff - table.get(a)!.diff || ratings.get(b)! - ratings.get(a)!);
  } else {
    const s1 = play(model.play, teams[0]!, teams[3]!, ratings, rng, 'Demi-finale', true);
    const s2 = play(model.play, teams[1]!, teams[2]!, ratings, rng, 'Demi-finale', true);
    const byId = (id: string) => teams.find((t) => t.id === id)!;
    const loser = (m: SimMatch) => (m.winnerId === m.aId ? m.bId : m.aId);
    const third = play(model.play, byId(loser(s1)), byId(loser(s2)), ratings, rng, 'Petite finale', true);
    const final = play(model.play, byId(s1.winnerId!), byId(s2.winnerId!), ratings, rng, 'Finale', true);
    matches.push(s1, s2, third, final);
    ranking = [final.winnerId!, loser(final), third.winnerId!, loser(third)];
  }
  return { result: { kind: 'matches', scoreLabel: model.label, matches, ranking, championId: ranking[0]! }, rngState: rng.state >>> 0 };
}
