/**
 * 2.5D motorsport pit lane (24 × 20 m), seen from the pit wall. Near the
 * viewer: chequered pit wall and two starting-grid boxes on dark asphalt;
 * then the working lane with a cyan pit-stop box; at the back, a graphite
 * garage floor and the lit garage facade. Original artwork — no team
 * livery, logo or circuit layout.
 * Slot y = 0 is the pit wall side (near the viewer), 1 the back of the garage.
 */
import { useMemo } from 'react';
import { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { PerspectiveSurface, metricPathFor, type PitchGeometry, type PitchProps } from './Pitch';
import { colors } from './tokens';

const W = 24;
const D = 20;
const GRID_END = 8.4;
const BOX = { x0: W / 2 - 1.8, x1: W / 2 + 1.8, y0: 9.3, y1: 14.7 };
const GARAGE = 15.5;

const tone = { asphalt: '#15191E', asphalt2: '#191E24', lane: '#1C2229', floor: '#0F1419', floor2: '#131A21', wall: '#0B0F14', line: 'rgba(244,248,250,0.8)' };

function PitLaneArtwork({ geo }: { geo: PitchGeometry }) {
  const scene = useMemo(() => {
    const mp = (pts: [number, number][], close = false) => metricPathFor(geo, W, D, pts, close);
    const rect = (x0: number, y0: number, x1: number, y1: number) => mp([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true);
    // Asphalt lanes running across the view, slightly varied in tone.
    const lanes: string[] = [];
    const n = 7;
    for (let i = 0; i < n; i++) lanes.push(rect(-2, (GRID_END / n) * i, W + 2, (GRID_END / n) * (i + 1)));
    // Fine aggregate specks, deterministic.
    const specks: { x: number; y: number; r: number; o: number }[] = [];
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 220; i++) {
      const p = geo.project(rnd(), rnd() * (GARAGE / D));
      specks.push({ x: p.x, y: p.y, r: 0.6 + rnd() * 0.6 * p.scale, o: 0.04 + rnd() * 0.08 });
    }
    // Starting-grid boxes under the two drivers (cars face away from the viewer).
    const grid = [0.3, 0.7].flatMap((fx) => {
      const cx = fx * W;
      return [mp([[cx - 1.5, 6.6], [cx - 1.5, 7.6], [cx + 1.5, 7.6], [cx + 1.5, 6.6]]), mp([[cx - 1.5, 2.2], [cx - 1.5, 3]]), mp([[cx + 1.5, 2.2], [cx + 1.5, 3]])];
    });
    const gridFill = [0.3, 0.7].map((fx) => rect(fx * W - 1.5, 2.2, fx * W + 1.5, 7.6));
    const pitLine = mp([[-2, GRID_END], [W + 2, GRID_END]]);
    const laneDash: string[] = [];
    for (let x = -2; x < W + 2; x += 2.4) laneDash.push(mp([[x, GRID_END + 0.5], [x + 1.2, GRID_END + 0.5]]));
    const box = rect(BOX.x0, BOX.y0, BOX.x1, BOX.y1);
    const tyres = [
      [BOX.x0 + 0.1, BOX.y0 + 0.9],
      [BOX.x1 - 0.5, BOX.y0 + 0.9],
      [BOX.x0 + 0.1, BOX.y1 - 1.7],
      [BOX.x1 - 0.5, BOX.y1 - 1.7],
    ].map(([x, y]) => rect(x!, y!, x! + 0.4, y! + 0.8));
    // Chequered strips: along the top of the pit wall and at the garage threshold.
    const chequer = (y0: number, y1: number, cells: number) => {
      const out: string[] = [];
      const cw = (W + 4) / cells;
      for (let i = 0; i < cells; i++) {
        for (let j = 0; j < 2; j++) {
          if ((i + j) % 2) continue;
          const ya = y0 + ((y1 - y0) / 2) * j;
          out.push(rect(-2 + i * cw, ya, -2 + (i + 1) * cw, ya + (y1 - y0) / 2));
        }
      }
      return out;
    };
    const wallCheq = chequer(-0.7, 0, 28);
    const garageCheq = chequer(GARAGE - 0.5, GARAGE, 34);
    const pitWall = rect(-2, -2.4, W + 2, -0.7);
    const garageFloor = rect(-2, GARAGE, W + 2, D);
    const bays = [4, W - 4].map((x) => mp([[x, GARAGE], [x, D]]));
    const ground = rect(-2, -2.4, W + 2, D);
    // Garage facade rising behind the far edge (vertical, so built in screen space).
    const bl = geo.project(-2 / W, 1);
    const br = geo.project((W + 2) / W, 1);
    const px = (geo.fieldBottomWidth / W) * bl.scale;
    // Capped to the room left above the far edge so the light strip is never cut off.
    const hWall = Math.max(6, Math.min(4.2 * px, Math.min(bl.y, br.y) - 4));
    const facade = `M${bl.x} ${bl.y} L${br.x} ${br.y} L${br.x} ${br.y - hWall} L${bl.x} ${bl.y - hWall} Z`;
    const doors = [4, W - 4].map((x) => {
      const p = geo.project(x / W, 1);
      return `M${p.x} ${p.y} V${p.y - hWall}`;
    });
    const lamps = [2, W / 2, W - 2].map((x) => {
      const p = geo.project(x / W, 1);
      return { x: p.x, y: p.y - hWall * 0.55, r: px * 2.6 };
    });
    return { lanes, specks, grid, gridFill, pitLine, laneDash, box, tyres, wallCheq, garageCheq, pitWall, garageFloor, bays, ground, facade, doors, lamps, bl, br, hWall };
  }, [geo]);

  const lw = Math.max(1.1, geo.fieldBottomWidth / 320);
  return (
    <>
      <Defs>
        <RadialGradient id="ms-halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.accent} stopOpacity="0.12" />
          <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="ms-facade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#161D25" />
          <Stop offset="1" stopColor="#0A0E13" />
        </LinearGradient>
        <RadialGradient id="ms-lamp" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
          <Stop offset="0.2" stopColor="#DFFBFF" stopOpacity="0.32" />
          <Stop offset="1" stopColor="#DFFBFF" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="ms-gloss" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0.25" stopColor="#FFFFFF" stopOpacity="0" />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.05" />
          <Stop offset="0.75" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="ms-depth" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity="0.4" />
          <Stop offset="0.5" stopColor="#000" stopOpacity="0.04" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </LinearGradient>
        <RadialGradient id="ms-spot" cx="50%" cy="45%" rx="65%" ry="70%">
          <Stop offset="0" stopColor="#EAF6FF" stopOpacity="0.12" />
          <Stop offset="1" stopColor="#000" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx={geo.width / 2} cy={geo.height / 2} rx={geo.width / 2} ry={geo.height / 2} fill="url(#ms-halo)" />
      {/* Garage facade with a gold light strip and a cyan LED line at floor level */}
      <Path d={scene.facade} fill="url(#ms-facade)" />
      <Path d={`M${scene.bl.x} ${scene.bl.y - scene.hWall * 0.9} L${scene.br.x} ${scene.br.y - scene.hWall * 0.9}`} stroke={colors.gold} strokeOpacity={0.55} strokeWidth={Math.max(1.5, scene.hWall * 0.04)} />
      {scene.doors.map((d, i) => (
        <Path key={i} d={d} stroke="rgba(255,255,255,0.08)" strokeWidth={lw} />
      ))}
      {scene.lamps.map((l, i) => (
        <Ellipse key={i} cx={l.x} cy={l.y} rx={l.r * 1.6} ry={l.r} fill="url(#ms-lamp)" />
      ))}
      <Path d={`M${scene.bl.x} ${scene.bl.y - 1} L${scene.br.x} ${scene.br.y - 1}`} stroke={colors.accent} strokeOpacity={0.55} strokeWidth={Math.max(1, lw)} />
      <Path d={scene.ground} fill={tone.asphalt} />
      {scene.lanes.map((d, i) => (
        <Path key={i} d={d} fill={i % 2 ? tone.asphalt2 : tone.asphalt} />
      ))}
      <Path d={metricPathFor(geo, W, D, [[-2, GRID_END], [W + 2, GRID_END], [W + 2, GARAGE], [-2, GARAGE]], true)} fill={tone.lane} />
      <Path d={scene.garageFloor} fill={tone.floor} />
      {scene.specks.map((s, i) => (
        <Ellipse key={i} cx={s.x} cy={s.y} rx={s.r} ry={s.r * 0.6} fill="#FFFFFF" fillOpacity={s.o} />
      ))}
      <Path d={scene.garageFloor} fill="url(#ms-gloss)" />
      <G stroke="rgba(255,255,255,0.07)" strokeWidth={lw}>
        {scene.bays.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
      {/* Grid boxes */}
      {scene.gridFill.map((d, i) => (
        <Path key={i} d={d} fill={colors.accent} fillOpacity={0.05} />
      ))}
      <G stroke={tone.line} strokeWidth={lw * 1.3} fill="none" strokeLinejoin="miter">
        {scene.grid.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
      {/* Pit-lane lines */}
      <Path d={scene.pitLine} stroke={tone.line} strokeWidth={lw * 1.5} />
      <G stroke={tone.line} strokeOpacity={0.5} strokeWidth={lw}>
        {scene.laneDash.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
      {/* Pit-stop box */}
      <Path d={scene.box} fill={colors.accent} fillOpacity={0.06} />
      <Path d={scene.box} stroke={colors.accent} strokeOpacity={0.22} strokeWidth={lw * 4} fill="none" />
      <Path d={scene.box} stroke={colors.accent} strokeOpacity={0.9} strokeWidth={lw} fill="none" />
      {scene.tyres.map((d, i) => (
        <Path key={i} d={d} fill={colors.gold} fillOpacity={0.75} />
      ))}
      {scene.garageCheq.map((d, i) => (
        <Path key={i} d={d} fill="#F2F4F6" fillOpacity={0.8} />
      ))}
      {/* Pit wall with its chequered top */}
      <Path d={scene.pitWall} fill={tone.wall} />
      {scene.wallCheq.map((d, i) => (
        <Path key={i} d={d} fill="#F2F4F6" fillOpacity={0.85} />
      ))}
      <Path d={metricPathFor(geo, W, D, [[-2, -0.7], [W + 2, -0.7]])} stroke={colors.accent} strokeOpacity={0.7} strokeWidth={lw} />
      <Path d={scene.ground} fill="url(#ms-depth)" />
      <Path d={scene.ground} fill="url(#ms-spot)" />
    </>
  );
}

/** Motorsport pit lane / starting grid. */
export function PitLane(props: PitchProps) {
  return <PerspectiveSurface {...props} depthRatio={0.78} Artwork={PitLaneArtwork} />;
}
