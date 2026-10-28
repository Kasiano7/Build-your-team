/**
 * 2.5D basketball half court (FIBA markings, 15 × 14 m), seen from behind the
 * half-court line with the basket at the far end. Dark hardwood under arena
 * spotlights, a teal paint, luminous lines. Same projection and slot layer as
 * the football pitch.
 */
import { useMemo } from 'react';
import { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { PerspectiveSurface, StadiumDecor, arc, metricPathFor, type PitchGeometry, type PitchProps } from './Pitch';

const W = 15;
const D = 14;
const HOOP = { x: W / 2, d: D - 1.575 };

const wood = { a: '#6A4529', b: '#5C3C23', apron: '#101922', paint: '#0C4F4C', line: 'rgba(255,248,236,0.78)' };

function CourtArtwork({ geo }: { geo: PitchGeometry }) {
  const court = useMemo(() => {
    const mp = (pts: [number, number][], close = false) => metricPathFor(geo, W, D, pts, close);
    // Hardwood boards run from the baseline to the half-court line.
    const boards: string[] = [];
    const n = 22;
    for (let i = 0; i < n; i++) {
      const x0 = (W / n) * i;
      const x1 = (W / n) * (i + 1);
      boards.push(mp([[x0, 0], [x1, 0], [x1, D], [x0, D]], true));
    }
    const m = 2.2;
    const apron = mp([[-m, -m * 0.4], [W + m, -m * 0.4], [W + m, D + m * 0.6], [-m, D + m * 0.6]], true);
    const keyL = W / 2 - 2.45;
    const keyR = W / 2 + 2.45;
    const ft = D - 5.8;
    const paint = mp([[keyL, ft], [keyR, ft], [keyR, D], [keyL, D]], true);
    const theta = Math.asin(Math.sqrt(6.75 ** 2 - 6.6 ** 2) / 6.75);
    const threeArc = arc(HOOP.x, HOOP.d, 6.75, Math.PI + theta, 2 * Math.PI - theta, 40);
    const corner = HOOP.d - Math.sqrt(6.75 ** 2 - 6.6 ** 2);
    const lines = [
      mp([[0, 0], [W, 0], [W, D], [0, D]], true),
      paint,
      mp(arc(W / 2, ft, 1.8, 0, Math.PI * 2, 40), true),
      mp([[0.9, D], [0.9, corner], ...threeArc, [W - 0.9, corner], [W - 0.9, D]]),
      mp(arc(HOOP.x, HOOP.d, 1.25, Math.PI, 2 * Math.PI, 20)),
      mp(arc(W / 2, 0, 1.8, 0, Math.PI, 24)),
    ];
    const backboard = mp([[W / 2 - 0.9, D - 1.2], [W / 2 + 0.9, D - 1.2]]);
    const rim = mp(arc(HOOP.x, HOOP.d, 0.23, 0, Math.PI * 2, 20), true);
    const hoop = geo.project(HOOP.x / W, HOOP.d / D);
    const center = geo.project(0.5, 0.45);
    const farL = geo.project(-3 / W, (D + 1.5) / D);
    const farR = geo.project((W + 3) / W, (D + 1.5) / D);
    return { boards, apron, paint, lines, backboard, rim, hoop, center, farL, farR };
  }, [geo]);

  const lw = Math.max(1.2, geo.fieldBottomWidth / 300);
  return (
    <>
      <Defs>
        <RadialGradient id="bk-halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#D98A3D" stopOpacity="0.22" />
          <Stop offset="1" stopColor="#D98A3D" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="bk-spot" cx="50%" cy="38%" rx="62%" ry="70%">
          <Stop offset="0" stopColor="#FFF4E2" stopOpacity="0.22" />
          <Stop offset="0.6" stopColor="#FFF4E2" stopOpacity="0.04" />
          <Stop offset="1" stopColor="#000" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="bk-depth" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity="0.42" />
          <Stop offset="0.5" stopColor="#000" stopOpacity="0.04" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </LinearGradient>
        <LinearGradient id="bk-gloss" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0.3" stopColor="#FFFFFF" stopOpacity="0" />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.06" />
          <Stop offset="0.7" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Ellipse cx={geo.width / 2} cy={geo.height / 2} rx={geo.width / 2} ry={geo.height / 2} fill="url(#bk-halo)" />
      <StadiumDecor geo={geo} farL={court.farL} farR={court.farR} crowdColor="#FFE9CC" lampColor="#FFF1DC" />
      <Path d={court.apron} fill="none" stroke={wood.apron} strokeOpacity={0.3} strokeWidth={30} strokeLinejoin="round" />
      <Path d={court.apron} fill={wood.apron} />
      {court.boards.map((d, i) => (
        <Path key={i} d={d} fill={i % 2 === 0 ? wood.a : wood.b} />
      ))}
      <Path d={court.paint} fill={wood.paint} fillOpacity={0.88} />
      {/* Centre-court logo ring, subtle */}
      <Ellipse cx={court.center.x} cy={court.center.y} rx={geo.fieldBottomWidth * 0.09 * court.center.scale} ry={geo.fieldBottomWidth * 0.045 * court.center.scale} fill="none" stroke="#2BE3D0" strokeOpacity={0.12} strokeWidth={2} />
      <G stroke="#FFF4E0" strokeOpacity={0.14} strokeWidth={lw * 3} fill="none" strokeLinejoin="round">
        {court.lines.map((d, i) => (
          <Path key={`glow${i}`} d={d} />
        ))}
      </G>
      <G stroke={wood.line} strokeWidth={lw} fill="none" strokeLinejoin="round">
        {court.lines.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
      <Path d={court.backboard} stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={lw * 2.2} />
      <Path d={court.rim} stroke="#FF7A2E" strokeWidth={lw * 1.6} fill="none" />
      <Path d={court.apron} fill="url(#bk-gloss)" />
      <Path d={court.apron} fill="url(#bk-depth)" />
      <Path d={court.apron} fill="url(#bk-spot)" />
    </>
  );
}

/** Basketball half court. */
export function Court(props: PitchProps) {
  return <PerspectiveSurface {...props} depthRatio={0.92} Artwork={CourtArtwork} />;
}
