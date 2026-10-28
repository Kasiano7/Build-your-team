/**
 * 2.5D circular stone arena for the original "Arènes de Solcendre" universe
 * (40 × 40 m frame, floor radius 17 m). Dark flagstone floor, a gold ring of
 * invented runes, a cyan sigil at the centre, a low stone wall topped with
 * torches and stepped stands behind. Entirely original artwork.
 * Slot y = 0 is the side nearest the viewer, 1 the far side.
 */
import { useMemo } from 'react';
import { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { PerspectiveSurface, arc, metricPathFor, type PitchGeometry, type PitchProps } from './Pitch';
import { colors } from './tokens';

const S = 40;
const C = S / 2;
const FLOOR_R = 17;
const WALL_R = 19.5;
const WALL_H = 2.2;
const RUNE_R = 15.4;

const stone = { floor: '#1A1D21', floor2: '#202429', seam: 'rgba(0,0,0,0.45)', top: '#2A3038', face: '#1B2027', faceNear: '#12161B', tier: '#11161C' };

/** Invented rune glyphs: polylines in a unit box (u along the ring, v towards the centre). */
const GLYPHS: [number, number][][][] = [
  [[[0, -0.5], [0, 0.5]], [[0, -0.1], [0.35, -0.45]]],
  [[[-0.3, -0.5], [-0.3, 0.5]], [[-0.3, 0], [0.3, -0.5]], [[-0.3, 0], [0.3, 0.5]]],
  [[[-0.3, 0.5], [0, -0.5], [0.3, 0.5]], [[-0.15, 0.1], [0.15, 0.1]]],
  [[[0, -0.5], [0.3, 0], [0, 0.5], [-0.3, 0], [0, -0.5]]],
  [[[-0.3, -0.5], [-0.3, 0.5]], [[0.3, -0.5], [0.3, 0.5]], [[-0.3, -0.15], [0.3, 0.15]]],
  [[[0, -0.5], [0, 0.5]], [[-0.3, -0.25], [0, 0], [0.3, -0.25]]],
];

function ArenaArtwork({ geo }: { geo: PitchGeometry }) {
  const scene = useMemo(() => {
    const mp = (pts: [number, number][], close = false) => metricPathFor(geo, S, S, pts, close);
    const unit = geo.fieldBottomWidth / S;
    /** Project a metric point raised by `h` metres (vertical, scaled with depth). */
    const lift = ([x, y]: [number, number], h: number) => {
      const p = geo.project(x / S, y / S);
      return { x: p.x, y: p.y - h * unit * p.scale, scale: p.scale };
    };
    const lp = (pts: [number, number][], h: number) => pts.map((pt, i) => {
      const p = lift(pt, h);
      return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }).join(' ');
    const ring = (r: number, a0 = 0, a1 = Math.PI * 2, steps = 72) => arc(C, C, r, a0, a1, steps);

    // Far half = angles 0..π (y grows away from the viewer).
    const stands: string[] = [];
    for (let i = 0; i < 4; i++) {
      const r0 = WALL_R + i * 1.9;
      const r1 = r0 + 1.9;
      const h0 = WALL_H + i * 1.5;
      const h1 = h0 + 1.5;
      const a0 = -0.22;
      const a1 = Math.PI + 0.22;
      // Riser (vertical face) then tread (flat step) of each tier.
      stands.push(`${lp(ring(r0, a0, a1, 48), h0)} ${lp(ring(r0, a1, a0, 48), h1).replace('M', 'L')} Z`);
      stands.push(`${lp(ring(r0, a0, a1, 48), h1)} ${lp(ring(r1, a1, a0, 48), h1).replace('M', 'L')} Z`);
    }
    const farFace = `${lp(ring(FLOOR_R, 0, Math.PI, 48), 0)} ${lp(ring(FLOOR_R, Math.PI, 0, 48), WALL_H).replace('M', 'L')} Z`;
    const nearFace = `${lp(ring(WALL_R, Math.PI, Math.PI * 2, 48), 0)} ${lp(ring(WALL_R, Math.PI * 2, Math.PI, 48), WALL_H).replace('M', 'L')} Z`;
    const top = `${lp(ring(WALL_R), WALL_H)} Z ${lp(ring(FLOOR_R).reverse(), WALL_H)} Z`;
    const topBlocks: string[] = [];
    const faceSeams: string[] = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      topBlocks.push(lp([[C + FLOOR_R * c, C + FLOOR_R * s], [C + WALL_R * c, C + WALL_R * s]], WALL_H));
      if (s > 0.05) {
        const g = lift([C + FLOOR_R * c, C + FLOOR_R * s], 0);
        const t = lift([C + FLOOR_R * c, C + FLOOR_R * s], WALL_H);
        faceSeams.push(`M${g.x.toFixed(1)} ${g.y.toFixed(1)} L${t.x.toFixed(1)} ${t.y.toFixed(1)}`);
      }
    }
    const floor = mp(ring(FLOOR_R), true);
    // Flagstones: concentric courses and radial joints.
    const seams: string[] = [];
    for (const r of [3.8, 7.5, 11.2, 13.8]) seams.push(mp(ring(r), true));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + (i % 2 ? 0.1 : 0);
      seams.push(mp([[C + 3.8 * Math.cos(a), C + 3.8 * Math.sin(a)], [C + FLOOR_R * Math.cos(a), C + FLOOR_R * Math.sin(a)]]));
    }
    const runeRings = [mp(ring(RUNE_R - 0.85), true), mp(ring(RUNE_R + 0.85), true)];
    const runes: string[] = [];
    const count = 30;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const tx = -Math.sin(a);
      const ty = Math.cos(a);
      const nx = -Math.cos(a);
      const ny = -Math.sin(a);
      const cx = C + RUNE_R * Math.cos(a);
      const cy = C + RUNE_R * Math.sin(a);
      const size = 1.1;
      for (const line of GLYPHS[(i * 7 + 3) % GLYPHS.length]!) {
        runes.push(mp(line.map(([u, v]) => [cx + (u * tx + v * nx) * size, cy + (u * ty + v * ny) * size] as [number, number])));
      }
    }
    // Central sigil: two rings, eight ticks and a diamond.
    const sigil = [mp(ring(3.2), true), mp(ring(2.2), true)];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      sigil.push(mp([[C + 2.2 * Math.cos(a), C + 2.2 * Math.sin(a)], [C + 3.2 * Math.cos(a), C + 3.2 * Math.sin(a)]]));
    }
    sigil.push(mp([[C, C - 1.5], [C + 1, C], [C, C + 1.5], [C - 1, C]], true));
    const centre = geo.project(0.5, 0.5);
    // Torches on the wall top, every 45°; far ones are drawn fully, near ones glow only.
    const torches = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const base = lift([C + (FLOOR_R + WALL_R) / 2 * Math.cos(a), C + (FLOOR_R + WALL_R) / 2 * Math.sin(a)], WALL_H);
      const tip = lift([C + (FLOOR_R + WALL_R) / 2 * Math.cos(a), C + (FLOOR_R + WALL_R) / 2 * Math.sin(a)], WALL_H + 1.6);
      return { base, tip, far: Math.sin(a) > 0, r: unit * base.scale };
    });
    return { stands, farFace, nearFace, top, topBlocks, faceSeams, floor, seams, runeRings, runes, sigil, centre, torches };
  }, [geo]);

  const lw = Math.max(1, geo.fieldBottomWidth / 380);
  const c = scene.centre;
  return (
    <>
      <Defs>
        <RadialGradient id="ar-halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.gold} stopOpacity="0.14" />
          <Stop offset="1" stopColor={colors.gold} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="ar-floor" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#2A2E33" />
          <Stop offset="0.7" stopColor={stone.floor} />
          <Stop offset="1" stopColor="#0E1013" />
        </RadialGradient>
        <RadialGradient id="ar-sigil" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.accent} stopOpacity="0.32" />
          <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="ar-torch" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFE7B0" stopOpacity="0.9" />
          <Stop offset="0.25" stopColor="#F2A640" stopOpacity="0.4" />
          <Stop offset="1" stopColor="#F2A640" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="ar-face" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2A3038" />
          <Stop offset="1" stopColor="#14181D" />
        </LinearGradient>
        <LinearGradient id="ar-tier" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0B0F13" stopOpacity="0.2" />
          <Stop offset="1" stopColor={stone.tier} stopOpacity="0.95" />
        </LinearGradient>
      </Defs>
      <Ellipse cx={geo.width / 2} cy={geo.height / 2} rx={geo.width / 2} ry={geo.height / 2} fill="url(#ar-halo)" />
      {/* Stepped stands behind the far wall (outermost first) */}
      {scene.stands
        .map((d, i) => ({ d, i }))
        .reverse()
        .map(({ d, i }) => (
          <Path key={i} d={d} fill={i % 2 ? '#151A20' : 'url(#ar-tier)'} stroke="rgba(230,193,112,0.06)" strokeWidth={1} />
        ))}
      <Path d={scene.farFace} fill="url(#ar-face)" />
      <G stroke={stone.seam} strokeWidth={lw}>
        {scene.faceSeams.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
      <Path d={scene.floor} fill="url(#ar-floor)" />
      <G stroke={stone.seam} strokeWidth={lw * 1.2} fill="none">
        {scene.seams.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
      {/* Rune ring in discreet gold */}
      <G stroke={colors.gold} strokeOpacity={0.4} strokeWidth={lw} fill="none">
        {scene.runeRings.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
      <G stroke={colors.gold} strokeOpacity={0.18} strokeWidth={lw * 3} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {scene.runes.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
      <G stroke={colors.gold} strokeOpacity={0.7} strokeWidth={lw} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {scene.runes.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
      {/* Cyan sigil at the centre */}
      <Ellipse cx={c.x} cy={c.y} rx={geo.fieldBottomWidth * 0.16 * c.scale} ry={geo.fieldBottomWidth * 0.09 * c.scale} fill="url(#ar-sigil)" />
      <G stroke={colors.accent} strokeOpacity={0.2} strokeWidth={lw * 3.5} fill="none">
        {scene.sigil.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
      <G stroke={colors.accent} strokeOpacity={0.85} strokeWidth={lw} fill="none" strokeLinejoin="round">
        {scene.sigil.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
      {/* Low wall: outer face on the near side, then the block-jointed top all round */}
      <Path d={scene.nearFace} fill={stone.faceNear} />
      <Path d={scene.top} fill={stone.top} fillRule="evenodd" />
      <G stroke={stone.seam} strokeWidth={lw}>
        {scene.topBlocks.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
      <Path d={scene.top} fill="none" stroke="rgba(230,193,112,0.22)" strokeWidth={lw} />
      {scene.torches.map((t, i) => (
        <G key={i} opacity={t.far ? 1 : 0.6}>
          <Ellipse cx={t.tip.x} cy={t.tip.y} rx={t.r * 4.5} ry={t.r * 3.6} fill="url(#ar-torch)" />
          {t.far && <Path d={`M${t.base.x} ${t.base.y} L${t.tip.x} ${t.tip.y}`} stroke="#3A3127" strokeWidth={Math.max(1.2, t.r * 0.35)} strokeLinecap="round" />}
          <Ellipse cx={t.tip.x} cy={t.tip.y - t.r * 0.35} rx={t.r * 0.42} ry={t.r * 0.75} fill="#FFC867" />
          <Ellipse cx={t.tip.x} cy={t.tip.y - t.r * 0.2} rx={t.r * 0.2} ry={t.r * 0.4} fill="#FFF4D6" />
        </G>
      ))}
    </>
  );
}

/** Circular stone arena (original fantasy universe). */
export function ArenaRing(props: PitchProps) {
  return <PerspectiveSurface {...props} depthRatio={0.66} Artwork={ArenaArtwork} />;
}
