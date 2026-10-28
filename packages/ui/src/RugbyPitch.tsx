/**
 * 2.5D rugby union pitch (70 m wide, 100 m between the try lines plus two
 * in-goal areas), seen from behind your own try line. Night-match look: deep
 * emerald turf under floodlights, chalk lines with a cyan halo, gold H posts.
 * Slot y = 0 is your own try line side (near the viewer), 1 the opponents'.
 */
import { useMemo } from 'react';
import { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { PerspectiveSurface, StadiumDecor, metricPathFor, type PitchGeometry, type PitchProps } from './Pitch';
import { colors } from './tokens';

const W = 70;
/** Visible in-goal depth (metres) on each side. */
const IG = 6;
const L = 100 + IG * 2;
const TRY_NEAR = IG;
const TRY_FAR = L - IG;
const HALF = L / 2;

const turf = { a: '#0B3A2B', b: '#0E4535', inGoal: '#072619', deep: '#051B13', line: 'rgba(240,255,250,0.72)', post: colors.gold, pad: '#0B8F80' };

/** Short dashes along a straight metric line (dashes are foreshortened with the surface). */
function dashes(from: [number, number], to: [number, number], dash: number, gap: number): [number, number][][] {
  const [x0, y0] = from;
  const [x1, y1] = to;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const out: [number, number][][] = [];
  for (let s = 0; s < len; s += dash + gap) {
    const e = Math.min(len, s + dash);
    out.push([
      [x0 + ((x1 - x0) * s) / len, y0 + ((y1 - y0) * s) / len],
      [x0 + ((x1 - x0) * e) / len, y0 + ((y1 - y0) * e) / len],
    ]);
  }
  return out;
}

function RugbyArtwork({ geo }: { geo: PitchGeometry }) {
  const field = useMemo(() => {
    const mp = (pts: [number, number][], close = false) => metricPathFor(geo, W, L, pts, close);
    const rect = (x0: number, y0: number, x1: number, y1: number) => mp([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true);
    const stripes: string[] = [];
    const bands = 10;
    for (let i = 0; i < bands; i++) {
      const y0 = TRY_NEAR + ((TRY_FAR - TRY_NEAR) / bands) * i;
      stripes.push(rect(0, y0, W, y0 + (TRY_FAR - TRY_NEAR) / bands));
    }
    const inGoals = [rect(0, 0, W, TRY_NEAR), rect(0, TRY_FAR, W, L)];
    // Diagonal hatching in the in-goal areas, clipped by construction to each area.
    const hatch: string[] = [];
    for (const [y0, y1] of [[0, TRY_NEAR], [TRY_FAR, L]] as const) {
      for (let x = -IG; x < W; x += 3.5) {
        const a: [number, number] = [Math.max(0, x), y0 + Math.max(0, -x)];
        const b: [number, number] = [Math.min(W, x + (y1 - y0)), y0 + Math.min(y1 - y0, W - x)];
        if (a[1] < y1 && b[0] > a[0]) hatch.push(mp([a, b]));
      }
    }
    const solid = [
      rect(0, 0, W, L),
      mp([[0, TRY_NEAR], [W, TRY_NEAR]]),
      mp([[0, TRY_FAR], [W, TRY_FAR]]),
      mp([[0, HALF], [W, HALF]]),
      mp([[0, TRY_NEAR + 22], [W, TRY_NEAR + 22]]),
      mp([[0, TRY_FAR - 22], [W, TRY_FAR - 22]]),
    ];
    const dashed = [
      // 10 m lines either side of halfway
      ...dashes([0, HALF - 10], [W, HALF - 10], 2.2, 2.2),
      ...dashes([0, HALF + 10], [W, HALF + 10], 2.2, 2.2),
      // 5 m lines in front of each try line
      ...dashes([5, TRY_NEAR + 5], [W - 5, TRY_NEAR + 5], 1.6, 3.4),
      ...dashes([5, TRY_FAR - 5], [W - 5, TRY_FAR - 5], 1.6, 3.4),
      // 5 m and 15 m lines parallel to the touch lines
      ...[5, 15, W - 15, W - 5].flatMap((x) => dashes([x, TRY_NEAR + 5], [x, TRY_FAR - 5], 1.4, 6.6)),
    ].map((seg) => mp(seg));
    const m = 6;
    const surround = rect(-m, -m * 0.5, W + m, L + m * 0.5);
    const centre = geo.project(0.5, HALF / L);
    // H posts: 5.6 m apart, crossbar at 3 m, uprights 11 m (vertical, so drawn in screen space at each base).
    const posts = [TRY_NEAR, TRY_FAR].map((y) => {
      const l = geo.project((W / 2 - 2.8) / W, y / L);
      const r = geo.project((W / 2 + 2.8) / W, y / L);
      const px = (geo.fieldBottomWidth / W) * l.scale;
      const up = 11 * px;
      const bar = 3 * px;
      return {
        frame: `M${l.x.toFixed(1)} ${l.y.toFixed(1)} V${(l.y - up).toFixed(1)} M${r.x.toFixed(1)} ${r.y.toFixed(1)} V${(r.y - up).toFixed(1)} M${l.x.toFixed(1)} ${(l.y - bar).toFixed(1)} H${r.x.toFixed(1)}`,
        pads: [l, r].map((p) => ({ x: p.x, y: p.y, w: 0.9 * px, h: 1.6 * px })),
        width: Math.max(1.2, px * 0.28),
      };
    });
    const farL = geo.project(-10 / W, (L + 4) / L);
    const farR = geo.project((W + 10) / W, (L + 4) / L);
    return { stripes, inGoals, hatch, solid, dashed, surround, centre, posts, farL, farR };
  }, [geo]);

  const lw = Math.max(1, geo.fieldBottomWidth / 360);
  const [near, far] = field.posts as [(typeof field.posts)[number], (typeof field.posts)[number]];
  return (
    <>
      <Defs>
        <RadialGradient id="rg-halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#1FAE8A" stopOpacity="0.24" />
          <Stop offset="1" stopColor="#1FAE8A" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="rg-flood" cx="50%" cy="10%" rx="70%" ry="80%">
          <Stop offset="0" stopColor="#E6FFF8" stopOpacity="0.15" />
          <Stop offset="0.55" stopColor="#E6FFF8" stopOpacity="0.04" />
          <Stop offset="1" stopColor="#000" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="rg-depth" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity="0.42" />
          <Stop offset="0.45" stopColor="#000" stopOpacity="0.05" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.26" />
        </LinearGradient>
        <RadialGradient id="rg-vignette" cx="50%" cy="55%" rx="75%" ry="70%">
          <Stop offset="0.7" stopColor="#000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </RadialGradient>
      </Defs>
      <Ellipse cx={geo.width / 2} cy={geo.height / 2} rx={geo.width / 2} ry={geo.height / 2} fill="url(#rg-halo)" />
      <StadiumDecor geo={geo} farL={field.farL} farR={field.farR} />
      <Path d={field.surround} fill="none" stroke={turf.deep} strokeOpacity={0.35} strokeWidth={26} strokeLinejoin="round" />
      <Path d={field.surround} fill={turf.deep} />
      {field.stripes.map((d, i) => (
        <Path key={i} d={d} fill={i % 2 === 0 ? turf.a : turf.b} />
      ))}
      {field.inGoals.map((d, i) => (
        <Path key={`ig${i}`} d={d} fill={turf.inGoal} />
      ))}
      <G stroke={colors.accent} strokeOpacity={0.1} strokeWidth={lw} fill="none">
        {field.hatch.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
      {/* Cyan halo under the chalk */}
      <G stroke={colors.accent} strokeOpacity={0.12} strokeWidth={Math.max(3, geo.fieldBottomWidth / 120)} fill="none" strokeLinejoin="round">
        {field.solid.map((d, i) => (
          <Path key={`glow${i}`} d={d} />
        ))}
      </G>
      <G stroke={turf.line} strokeWidth={lw} fill="none" strokeLinejoin="round">
        {field.solid.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
      <G stroke={turf.line} strokeOpacity={0.55} strokeWidth={lw} fill="none">
        {field.dashed.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
      <Ellipse cx={field.centre.x} cy={field.centre.y} rx={2 * field.centre.scale} ry={1.3 * field.centre.scale} fill={turf.line} />
      <Path d={field.surround} fill="url(#rg-depth)" />
      <Path d={field.surround} fill="url(#rg-flood)" />
      <Path d={field.surround} fill="url(#rg-vignette)" />
      {/* Far posts lit in gold; near posts kept faint so they never fight the cards. */}
      <Path d={far.frame} stroke={colors.gold} strokeOpacity={0.25} strokeWidth={far.width * 3} fill="none" strokeLinecap="round" />
      <Path d={far.frame} stroke={turf.post} strokeWidth={far.width} fill="none" strokeLinecap="round" />
      {far.pads.map((p, i) => (
        <Path key={`fp${i}`} d={`M${p.x - p.w / 2} ${p.y} h${p.w} v${-p.h} h${-p.w} Z`} fill={turf.pad} />
      ))}
      <G opacity={0.28}>
        <Path d={near.frame} stroke={turf.post} strokeWidth={near.width} fill="none" strokeLinecap="round" />
        {near.pads.map((p, i) => (
          <Path key={`np${i}`} d={`M${p.x - p.w / 2} ${p.y} h${p.w} v${-p.h} h${-p.w} Z`} fill={turf.pad} />
        ))}
      </G>
      <Path d={field.surround} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
    </>
  );
}

/** Rugby union pitch with in-goal areas, 22 m / 10 m lines and H posts. */
export function RugbyPitch(props: PitchProps) {
  return <PerspectiveSurface {...props} depthRatio={0.92} Artwork={RugbyArtwork} />;
}
