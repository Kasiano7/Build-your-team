/**
 * 2.5D tactical pitch. A true projective mapping (not a CSS skew) is used so
 * markings, mowing stripes and slot positions share one perspective, while
 * the cards themselves stay upright and readable, scaled with depth.
 *
 * The pitch is universe agnostic: it positions any slot list with normalised
 * coordinates and delegates slot rendering to `renderSlot`.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import type { FormationSlot } from '@byt/shared';
import { colors } from './tokens';

const LENGTH = 105;
const WIDTH = 68;
const FAR_RATIO = 0.68;

export interface PitchGeometry {
  width: number;
  height: number;
  fieldBottomWidth: number;
  fieldHeight: number;
  cx: number;
  bottomY: number;
  baseCardWidth: number;
  project: (x: number, t: number) => { x: number; y: number; scale: number };
}

export function computeGeometry(w: number, h: number, slotCount: number): PitchGeometry {
  const k = slotCount <= 6 ? 0.17 : 0.128;
  const cardH = 1.3;
  const depthRatio = 0.9;
  const wb = Math.max(10, Math.min(w * 0.94, h / (depthRatio + k * cardH * 0.86)));
  const hp = wb * depthRatio;
  const base = wb * k;
  const padBottom = base * cardH * 0.5;
  const used = hp + padBottom + base * cardH * 0.42 * FAR_RATIO;
  const bottomY = h - padBottom - Math.max(0, (h - used) / 2);
  const cx = w / 2;
  const zFar = 1 / FAR_RATIO;
  const project = (x: number, t: number) => {
    const z = 1 + t * (zFar - 1);
    return {
      x: cx + (x - 0.5) * (wb / z),
      y: bottomY - hp * ((1 - 1 / z) / (1 - FAR_RATIO)),
      scale: 1 / z,
    };
  };
  return { width: w, height: h, fieldBottomWidth: wb, fieldHeight: hp, cx, bottomY, baseCardWidth: base, project };
}

/** Project metric coordinates (metres) into an SVG path. */
function metricPath(geo: PitchGeometry, pts: [number, number][], close = false): string {
  return (
    pts
      .map(([xm, ym], i) => {
        const p = geo.project(xm / WIDTH, ym / LENGTH);
        return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      })
      .join(' ') + (close ? ' Z' : '')
  );
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number, steps = 28): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

export interface PitchProps {
  slots: FormationSlot[];
  renderSlot: (slot: FormationSlot, index: number, info: { cardWidth: number; scale: number }) => ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Optional overlay rendered above the cards (e.g. arrival effects). */
  children?: ReactNode;
}

export function Pitch({ slots, renderSlot, style, children }: PitchProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - size.w) > 1 || Math.abs(height - size.h) > 1) setSize({ w: width, h: height });
  };
  const geo = useMemo(() => (size.w > 0 ? computeGeometry(size.w, size.h, slots.length) : null), [size.w, size.h, slots.length]);

  const field = useMemo(() => {
    if (!geo) return null;
    const stripes: string[] = [];
    const bands = 14;
    for (let i = 0; i < bands; i++) {
      const y0 = (LENGTH / bands) * i;
      const y1 = (LENGTH / bands) * (i + 1);
      stripes.push(metricPath(geo, [[0, y0], [WIDTH, y0], [WIDTH, y1], [0, y1]], true));
    }
    const box = (y: number, depth: number, wBox: number, dir: 1 | -1) => {
      const x0 = (WIDTH - wBox) / 2;
      return metricPath(geo, [[x0, y], [x0, y + dir * depth], [x0 + wBox, y + dir * depth], [x0 + wBox, y]]);
    };
    const mid = LENGTH / 2;
    const theta = Math.acos(5.5 / 9.15);
    const lines = [
      metricPath(geo, [[0, 0], [WIDTH, 0], [WIDTH, LENGTH], [0, LENGTH]], true),
      metricPath(geo, [[0, mid], [WIDTH, mid]]),
      metricPath(geo, arc(WIDTH / 2, mid, 9.15, 0, Math.PI * 2, 48)),
      box(0, 16.5, 40.32, 1),
      box(0, 5.5, 18.32, 1),
      box(LENGTH, 16.5, 40.32, -1),
      box(LENGTH, 5.5, 18.32, -1),
      metricPath(geo, arc(WIDTH / 2, 11, 9.15, theta, Math.PI - theta, 16)),
      metricPath(geo, arc(WIDTH / 2, LENGTH - 11, 9.15, Math.PI + theta, 2 * Math.PI - theta, 16)),
    ];
    const spots = [
      [WIDTH / 2, mid],
      [WIDTH / 2, 11],
      [WIDTH / 2, LENGTH - 11],
    ].map(([x, y]) => geo.project(x! / WIDTH, y! / LENGTH));
    const surround = (() => {
      const m = 7;
      return metricPath(geo, [[-m, -m * 0.6], [WIDTH + m, -m * 0.6], [WIDTH + m, LENGTH + m * 0.5], [-m, LENGTH + m * 0.5]], true);
    })();
    const goal = (y: number, dir: 1 | -1) => {
      const x0 = (WIDTH - 7.32) / 2;
      return metricPath(geo, [[x0, y], [x0, y - dir * 1.8], [x0 + 7.32, y - dir * 1.8], [x0 + 7.32, y]]);
    };
    // Far stands: a dark band behind the far touchline with a deterministic crowd of light specks.
    const farL = geo.project(-12 / WIDTH, (LENGTH + 4) / LENGTH);
    const farR = geo.project((WIDTH + 12) / WIDTH, (LENGTH + 4) / LENGTH);
    const standH = Math.max(14, geo.fieldHeight * 0.16);
    const stands = `M${farL.x - standH * 0.6} ${farL.y - standH} L${farR.x + standH * 0.6} ${farR.y - standH} L${farR.x} ${farR.y} L${farL.x} ${farL.y} Z`;
    const crowd: { x: number; y: number; o: number }[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 160; i++) {
      const t = rnd();
      const v = rnd();
      const y = farL.y - standH * (0.15 + v * 0.8);
      const spread = (farR.x - farL.x) + standH * 1.2 * (1 - (y - (farL.y - standH)) / standH);
      crowd.push({ x: farL.x - standH * 0.6 * (1 - (y - (farL.y - standH)) / standH) + t * spread, y, o: 0.06 + rnd() * 0.22 });
    }
    const lights = [
      { x: farL.x - standH * 0.4, y: farL.y - standH * 1.15 },
      { x: farR.x + standH * 0.4, y: farR.y - standH * 1.15 },
    ];
    return { stripes, lines, spots, surround, stands, crowd, lights, standH, goals: [goal(0, 1), goal(LENGTH, -1)] };
  }, [geo]);

  return (
    <View style={[{ flex: 1, overflow: 'hidden' }, style]} onLayout={onLayout}>
      {geo && field && (
        <>
          <Svg width={geo.width} height={geo.height} style={{ position: 'absolute' }}>
            <Defs>
              <RadialGradient id="flood" cx="50%" cy="8%" rx="70%" ry="80%">
                <Stop offset="0" stopColor="#E9FFF6" stopOpacity="0.16" />
                <Stop offset="0.55" stopColor="#E9FFF6" stopOpacity="0.04" />
                <Stop offset="1" stopColor="#000" stopOpacity="0" />
              </RadialGradient>
              <LinearGradient id="depth" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000" stopOpacity="0.38" />
                <Stop offset="0.45" stopColor="#000" stopOpacity="0.05" />
                <Stop offset="1" stopColor="#000" stopOpacity="0.22" />
              </LinearGradient>
              <RadialGradient id="vignette" cx="50%" cy="55%" rx="75%" ry="70%">
                <Stop offset="0.7" stopColor="#000" stopOpacity="0" />
                <Stop offset="1" stopColor="#000" stopOpacity="0.45" />
              </RadialGradient>
              <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#1FAE68" stopOpacity="0.28" />
                <Stop offset="1" stopColor="#1FAE68" stopOpacity="0" />
              </RadialGradient>
              <LinearGradient id="stands" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#0B1016" stopOpacity="0" />
                <Stop offset="1" stopColor="#0B1016" stopOpacity="0.95" />
              </LinearGradient>
              <RadialGradient id="lamp" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
                <Stop offset="0.18" stopColor="#DFFBFF" stopOpacity="0.45" />
                <Stop offset="1" stopColor="#DFFBFF" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            {/* Ambient glow of the lit pitch spilling onto the night backdrop */}
            <Ellipse cx={geo.width / 2} cy={geo.height / 2} rx={geo.width / 2} ry={geo.height / 2} fill="url(#halo)" />
            <Path d={field.stands} fill="url(#stands)" />
            {field.crowd.map((c, i) => (
              <Ellipse key={`c${i}`} cx={c.x} cy={c.y} rx={1.1} ry={1.1} fill="#DDEBFF" fillOpacity={c.o} />
            ))}
            {field.lights.map((l, i) => (
              <Ellipse key={`l${i}`} cx={l.x} cy={l.y} rx={field.standH * 1.4} ry={field.standH * 1.1} fill="url(#lamp)" />
            ))}
            {/* Feathered edge so the pitch melts into the stadium instead of ending on a hard line */}
            <Path d={field.surround} fill="none" stroke={colors.grassDeep} strokeOpacity={0.18} strokeWidth={34} strokeLinejoin="round" />
            <Path d={field.surround} fill="none" stroke={colors.grassDeep} strokeOpacity={0.35} strokeWidth={14} strokeLinejoin="round" />
            <Path d={field.surround} fill={colors.grassDeep} />
            {field.stripes.map((d, i) => (
              <Path key={i} d={d} fill={i % 2 === 0 ? colors.grass : colors.grassStripe} />
            ))}
            <G stroke="#EFFFF6" strokeOpacity={0.12} strokeWidth={Math.max(3, geo.fieldBottomWidth / 120)} fill="none" strokeLinejoin="round">
              {field.lines.map((d, i) => (
                <Path key={`glow${i}`} d={d} />
              ))}
            </G>
            <G stroke={colors.chalk} strokeWidth={Math.max(1, geo.fieldBottomWidth / 360)} fill="none" strokeLinejoin="round">
              {field.lines.map((d, i) => (
                <Path key={i} d={d} />
              ))}
              {field.goals.map((d, i) => (
                <Path key={`g${i}`} d={d} strokeOpacity={0.5} />
              ))}
            </G>
            {field.spots.map((p, i) => (
              <Ellipse key={i} cx={p.x} cy={p.y} rx={2.2 * p.scale} ry={1.5 * p.scale} fill={colors.chalk} />
            ))}
            <Path d={field.surround} fill="url(#depth)" />
            <Path d={field.surround} fill="url(#flood)" />
            <Path d={field.surround} fill="url(#vignette)" />
            <Path d={field.surround} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          </Svg>
          {slots.map((slot, index) => {
            const p = geo.project(slot.x, slot.y);
            const cardWidth = geo.baseCardWidth * p.scale;
            const cardH = cardWidth * 1.3;
            return (
              <View
                key={slot.id + index}
                style={{ position: 'absolute', left: p.x - cardWidth / 2, top: p.y - cardH / 2, width: cardWidth, height: cardH, zIndex: Math.round(slot.y * -100) + 100 }}
              >
                {renderSlot(slot, index, { cardWidth, scale: p.scale })}
              </View>
            );
          })}
          {children}
        </>
      )}
    </View>
  );
}
