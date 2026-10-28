/**
 * Simulated tournament reveal (end of game, `endMode` 'sim' or 'vote_sim').
 *  2 teams → a single final · 3 teams → round robin (matches + table)
 *  4 teams → bracket: semi-finals → final, plus the third-place match
 *  motorsport → one Grand Prix classification with points.
 * Matches appear one after another (semis, then the small final, then the
 * final) so the champion lands last; reduced motion shows everything at once.
 */
import { Text, View } from 'react-native';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import type { Participant, RoomView, SimMatch, SimulationResult } from '@byt/shared';
import { colors, fonts, radii } from '@byt/ui';
import { Eyebrow, Panel, PlayerBadge } from '@/components/ui';
import { useReduceMotion } from '@/state/settings';

type TeamRef = Pick<Participant, 'id' | 'nickname' | 'color'>;

const STEP = 650;

export function teamRef(view: RoomView, id: string): TeamRef {
  return view.participants.find((p) => p.id === id) ?? { id, nickname: '?', color: colors.textMute };
}

/** Delay (ms) before each element of the reveal, and when the champion is known. */
export function revealPlan(sim: SimulationResult): { matches: number[]; table: number; champion: number } {
  if (sim.kind === 'race') {
    const n = sim.ranking.length;
    return { matches: [], table: 0, champion: n * STEP + 200 };
  }
  const rounds = sim.matches.map((m) => m.round);
  if (sim.matches.length === 4 && rounds[3] === 'Finale') {
    // Semi-finals, small final, final.
    const matches = [200, 200 + STEP, 200 + STEP * 2.4, 200 + STEP * 3.8];
    return { matches, table: 0, champion: matches[3]! + STEP * 1.4 };
  }
  const matches = sim.matches.map((_, i) => 200 + i * STEP);
  const table = 200 + sim.matches.length * STEP;
  return { matches, table, champion: table + (sim.matches.length > 1 ? STEP * 1.2 : STEP * 0.6) };
}

/** Round-robin table (3 teams): 3 pts a win, 1 a draw, then score difference. */
function roundRobinTable(sim: SimulationResult) {
  const rows = new Map(sim.ranking.map((id) => [id, { id, played: 0, won: 0, drawn: 0, lost: 0, diff: 0, pts: 0 }]));
  for (const m of sim.matches) {
    const a = rows.get(m.aId);
    const b = rows.get(m.bId);
    if (!a || !b) continue;
    a.played++;
    b.played++;
    a.diff += m.scoreA - m.scoreB;
    b.diff += m.scoreB - m.scoreA;
    if (m.winnerId === m.aId) {
      a.won++;
      b.lost++;
      a.pts += 3;
    } else if (m.winnerId === m.bId) {
      b.won++;
      a.lost++;
      b.pts += 3;
    } else {
      a.drawn++;
      b.drawn++;
      a.pts++;
      b.pts++;
    }
  }
  return sim.ranking.map((id) => rows.get(id)!);
}

export function SimulationBoard({ view, sim, scale = 1, compact }: { view: RoomView; sim: SimulationResult; scale?: number; compact?: boolean }) {
  const s = scale;
  const plan = revealPlan(sim);
  const title = sim.kind === 'race' ? 'Grand Prix simulé' : sim.matches.length === 1 ? 'Finale simulée' : 'Tournoi simulé';
  const subtitle =
    sim.kind === 'race'
      ? 'Une course, toutes les écuries · barème 25-18-15-12…'
      : `Force de chaque équipe (note des titulaires) et une part de hasard · scores en ${sim.scoreLabel}`;
  return (
    <Panel style={{ width: '100%', gap: 14 * s, padding: 18 * s }}>
      <View style={{ gap: 4 * s }}>
        <Eyebrow style={{ fontSize: 11 * s }}>{title}</Eyebrow>
        <Text style={{ fontFamily: fonts.body, fontSize: 13 * s, color: colors.textDim }}>{subtitle}</Text>
      </View>
      {sim.kind === 'race' ? (
        <RaceTable view={view} sim={sim} s={s} />
      ) : sim.matches.length === 4 && sim.matches[3]!.round === 'Finale' ? (
        <Bracket view={view} sim={sim} delays={plan.matches} s={s} compact={!!compact} />
      ) : (
        <View style={{ gap: 14 * s }}>
          <View style={{ flexDirection: compact ? 'column' : 'row', flexWrap: 'wrap', gap: 12 * s, justifyContent: 'center' }}>
            {sim.matches.map((m, i) => (
              <MatchCard key={i} view={view} m={m} delay={plan.matches[i]!} s={s} highlight={m.round === 'Finale'} big={sim.matches.length === 1} grow={!compact} />
            ))}
          </View>
          {sim.matches.length === 3 && <RoundRobin view={view} sim={sim} delay={plan.table} s={s} />}
        </View>
      )}
    </Panel>
  );
}

function useEnter(delay: number, kind: 'up' | 'zoom' = 'up') {
  const reduce = useReduceMotion();
  if (reduce) return undefined;
  return kind === 'zoom' ? ZoomIn.delay(delay).springify().damping(13) : FadeInUp.delay(delay).duration(480);
}

function MatchCard({ view, m, delay, s, highlight, big, grow }: { view: RoomView; m: SimMatch; delay: number; s: number; highlight?: boolean; big?: boolean; grow?: boolean }) {
  const entering = useEnter(delay, highlight ? 'zoom' : 'up');
  const a = teamRef(view, m.aId);
  const b = teamRef(view, m.bId);
  const k = big ? 1.35 : 1;
  return (
    <Animated.View
      entering={entering}
      accessible
      accessibilityLabel={`${m.round} : ${a.nickname} ${m.scoreA}, ${b.nickname} ${m.scoreB}${m.note ? `, ${m.note}` : ''}${m.winnerId ? `, vainqueur ${teamRef(view, m.winnerId).nickname}` : ', match nul'}`}
      style={{
        minWidth: 240 * s * k,
        // Only grows along a row of cards (never vertically inside the bracket columns).
        flexGrow: grow ? 1 : 0,
        maxWidth: big ? 560 * s : 420 * s,
        borderRadius: radii.md * s,
        borderWidth: highlight ? 2 : 1,
        borderColor: highlight ? colors.gold : colors.line,
        backgroundColor: highlight ? 'rgba(230,193,112,0.07)' : 'rgba(16,22,29,0.86)',
        paddingHorizontal: 12 * s * k,
        paddingVertical: 10 * s * k,
        gap: 6 * s * k,
      }}
    >
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 10 * s * k, letterSpacing: 1.8, color: highlight ? colors.gold : colors.textMute }}>{m.round.toUpperCase()}</Text>
      <ScoreRow team={a} score={m.scoreA} win={m.winnerId === a.id} decided={!!m.winnerId} s={s * k} />
      <ScoreRow team={b} score={m.scoreB} win={m.winnerId === b.id} decided={!!m.winnerId} s={s * k} />
      {m.note ? <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12 * s * k, color: colors.textDim, fontStyle: 'italic' }}>{m.note}</Text> : null}
    </Animated.View>
  );
}

function ScoreRow({ team, score, win, decided, s }: { team: TeamRef; score: number; win: boolean; decided: boolean; s: number }) {
  const dim = decided && !win;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 * s, opacity: dim ? 0.55 : 1 }}>
      <View style={{ width: 4 * s, alignSelf: 'stretch', borderRadius: 2, backgroundColor: team.color }} />
      <PlayerBadge name={team.nickname} color={team.color} size={26 * s} ring={win} />
      <Text style={{ flex: 1, fontFamily: win ? fonts.display : fonts.bodySemi, fontSize: 16 * s, color: colors.text }} numberOfLines={1}>
        {team.nickname}
      </Text>
      {win ? <Text style={{ fontSize: 10 * s, color: colors.gold }}>▶</Text> : null}
      <Text style={{ minWidth: 34 * s, textAlign: 'right', fontFamily: fonts.displayBlack, fontSize: 22 * s, color: win ? colors.text : colors.textDim, fontVariant: ['tabular-nums'] }}>{score}</Text>
    </View>
  );
}

function Bracket({ view, sim, delays, s, compact }: { view: RoomView; sim: SimulationResult; delays: number[]; s: number; compact: boolean }) {
  const [s1, s2, third, final] = sim.matches as [SimMatch, SimMatch, SimMatch, SimMatch];
  if (compact) {
    return (
      <View style={{ gap: 10 * s }}>
        <MatchCard view={view} m={s1} delay={delays[0]!} s={s} />
        <MatchCard view={view} m={s2} delay={delays[1]!} s={s} />
        <MatchCard view={view} m={third} delay={delays[2]!} s={s} />
        <MatchCard view={view} m={final} delay={delays[3]!} s={s} highlight />
      </View>
    );
  }
  const line = 'rgba(255,255,255,0.18)';
  return (
    <View style={{ gap: 12 * s }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1 }}>
          {[s1, s2].map((m, i) => (
            <View key={i} style={{ flex: 1, justifyContent: 'center', paddingVertical: 6 * s }}>
              <MatchCard view={view} m={m} delay={delays[i]!} s={s} />
            </View>
          ))}
        </View>
        <View style={{ width: 44 * s }} pointerEvents="none">
          <View style={{ position: 'absolute', top: '25%', bottom: '25%', left: 0, width: '50%', borderTopWidth: 2, borderRightWidth: 2, borderBottomWidth: 2, borderColor: line, borderTopRightRadius: 8, borderBottomRightRadius: 8 }} />
          <View style={{ position: 'absolute', top: '50%', left: '50%', right: 0, height: 2, marginTop: -1, backgroundColor: line }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <MatchCard view={view} m={final} delay={delays[3]!} s={s} highlight />
        </View>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1 }} />
        <View style={{ width: 44 * s }} />
        <View style={{ flex: 1 }}>
          <MatchCard view={view} m={third} delay={delays[2]!} s={s} />
        </View>
      </View>
    </View>
  );
}

function RoundRobin({ view, sim, delay, s }: { view: RoomView; sim: SimulationResult; delay: number; s: number }) {
  const entering = useEnter(delay);
  const rows = roundRobinTable(sim);
  const cols: { k: string; w: number; f: (r: (typeof rows)[number]) => string }[] = [
    { k: 'J', w: 34, f: (r) => String(r.played) },
    { k: 'G', w: 34, f: (r) => String(r.won) },
    { k: 'N', w: 34, f: (r) => String(r.drawn) },
    { k: 'P', w: 34, f: (r) => String(r.lost) },
    { k: 'Diff.', w: 56, f: (r) => (r.diff > 0 ? `+${r.diff}` : String(r.diff)) },
    { k: 'Pts', w: 48, f: (r) => String(r.pts) },
  ];
  const cell = { fontFamily: fonts.bodySemi, fontSize: 14 * s, color: colors.text, textAlign: 'center' as const, fontVariant: ['tabular-nums' as const] };
  return (
    <Animated.View entering={entering} style={{ borderRadius: radii.md * s, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12 * s, paddingVertical: 6 * s }}>
      <View style={{ flexDirection: 'row', paddingVertical: 6 * s }}>
        <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 10 * s, letterSpacing: 1.5, color: colors.textMute }}>CLASSEMENT DE LA POULE</Text>
        {cols.map((c) => (
          <Text key={c.k} style={{ width: c.w * s, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 10 * s, letterSpacing: 1, color: colors.textMute }}>
            {c.k.toUpperCase()}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => {
        const t = teamRef(view, r.id);
        return (
          <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 * s, borderTopWidth: 1, borderTopColor: colors.line }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 * s, minWidth: 0 }}>
              <Text style={{ width: 20 * s, fontFamily: fonts.displayBlack, fontSize: 16 * s, color: i === 0 ? colors.gold : colors.textMute }}>{i + 1}</Text>
              <PlayerBadge name={t.nickname} color={t.color} size={24 * s} ring={i === 0} />
              <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 15 * s, color: colors.text }} numberOfLines={1}>
                {t.nickname}
              </Text>
            </View>
            {cols.map((c) => (
              <Text key={c.k} style={[cell, { width: c.w * s }, c.k === 'Pts' ? { fontFamily: fonts.displayBlack, color: i === 0 ? colors.gold : colors.text } : null]}>
                {c.f(r)}
              </Text>
            ))}
          </View>
        );
      })}
    </Animated.View>
  );
}

function RaceTable({ view, sim, s }: { view: RoomView; sim: SimulationResult; s: number }) {
  const points = sim.points ?? {};
  const max = Math.max(1, ...sim.ranking.map((id) => points[id] ?? 0));
  const n = sim.ranking.length;
  return (
    <View style={{ gap: 8 * s }}>
      {sim.ranking.map((id, i) => (
        // Revealed from the back of the grid to the winner.
        <RaceRow key={id} team={teamRef(view, id)} pos={i + 1} pts={points[id] ?? 0} frac={(points[id] ?? 0) / max} delay={200 + (n - 1 - i) * STEP} s={s} />
      ))}
    </View>
  );
}

function RaceRow({ team, pos, pts, frac, delay, s }: { team: TeamRef; pos: number; pts: number; frac: number; delay: number; s: number }) {
  const entering = useEnter(delay, pos === 1 ? 'zoom' : 'up');
  const first = pos === 1;
  return (
    <Animated.View
      entering={entering}
      accessible
      accessibilityLabel={`${pos}e : ${team.nickname}, ${pts} points`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * s, paddingHorizontal: 12 * s, paddingVertical: 10 * s, borderRadius: radii.md * s, borderWidth: first ? 2 : 1, borderColor: first ? colors.gold : colors.line, backgroundColor: first ? 'rgba(230,193,112,0.07)' : 'rgba(16,22,29,0.86)' }}
    >
      <Text style={{ width: 44 * s, fontFamily: fonts.displayBlack, fontSize: 22 * s, color: first ? colors.gold : colors.textDim }}>P{pos}</Text>
      <PlayerBadge name={team.nickname} color={team.color} size={28 * s} ring={first} />
      <Text style={{ width: 160 * s, fontFamily: fonts.display, fontSize: 17 * s, color: colors.text }} numberOfLines={1}>
        {team.nickname}
      </Text>
      <View style={{ flex: 1, height: 8 * s, borderRadius: 4 * s, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <View style={{ width: `${Math.round(frac * 100)}%`, height: '100%', borderRadius: 4 * s, backgroundColor: team.color }} />
      </View>
      <Text style={{ minWidth: 70 * s, textAlign: 'right', fontFamily: fonts.displayBlack, fontSize: 20 * s, color: colors.text, fontVariant: ['tabular-nums'] }}>
        {pts}
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11 * s, color: colors.textMute }}> PTS</Text>
      </Text>
    </Animated.View>
  );
}
