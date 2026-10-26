/**
 * Procedural, original portrait (no photo rights involved). Deterministic from
 * a seed: skin tone, hair style/colour, facial hair and kit colour.
 * Licensed datasets can provide `portraitUrl` instead.
 */
import { memo } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

const SKIN = ['#F2D3BD', '#E7B994', '#D29B6E', '#B97D52', '#8E5B3A', '#6B4029', '#4E2E1E'];
const HAIR = ['#141110', '#2A1D15', '#4A3020', '#6E4A2C', '#A9763F', '#D7B06A', '#3B3B3B'];
const KIT = ['#1E3A5F', '#5B1D2A', '#1F4D3A', '#3D2A5C', '#222831', '#6A4B16', '#0E4C5A', '#4A1F1F'];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const Avatar = memo(function Avatar({ seed, size }: { seed: number; size: number }) {
  const r = rng(seed);
  const skin = SKIN[Math.floor(r() * SKIN.length)]!;
  const hair = HAIR[Math.floor(r() * HAIR.length)]!;
  const kit = KIT[Math.floor(r() * KIT.length)]!;
  const hairStyle = Math.floor(r() * 6);
  const beard = r() < 0.35;
  const headW = 30 + r() * 4;
  const id = `av${seed}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={`${id}k`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={kit} stopOpacity="1" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.9" />
        </LinearGradient>
        <LinearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={skin} stopOpacity="1" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.18" />
        </LinearGradient>
      </Defs>
      {/* Shoulders / kit */}
      <Path d="M8 100 C 10 78, 28 70, 50 70 C 72 70, 90 78, 92 100 Z" fill={`url(#${id}k)`} />
      <Path d="M40 71 L50 84 L60 71" stroke="rgba(255,255,255,0.35)" strokeWidth="2.2" fill="none" />
      {/* Neck */}
      <Rect x="43" y="56" width="14" height="17" rx="5" fill={skin} />
      <Rect x="43" y="62" width="14" height="6" fill="#000" opacity="0.12" />
      {/* Head */}
      <Ellipse cx="50" cy="42" rx={headW / 2 + 1} ry="21" fill={skin} />
      <Ellipse cx="50" cy="42" rx={headW / 2 + 1} ry="21" fill={`url(#${id}s)`} opacity="0.5" />
      {/* Ears */}
      <Ellipse cx={50 - headW / 2 - 0.5} cy="44" rx="2.6" ry="4.2" fill={skin} />
      <Ellipse cx={50 + headW / 2 + 0.5} cy="44" rx="2.6" ry="4.2" fill={skin} />
      {beard && <Path d={`M${50 - headW / 2 + 2} 46 Q50 70 ${50 + headW / 2 - 2} 46 Q50 60 ${50 - headW / 2 + 2} 46 Z`} fill={hair} opacity="0.9" />}
      <G>
        {hairStyle === 0 && <Path d={`M${50 - headW / 2} 38 Q50 14 ${50 + headW / 2} 38 Q50 26 ${50 - headW / 2} 38 Z`} fill={hair} />}
        {hairStyle === 1 && <Path d={`M${50 - headW / 2 - 1} 42 Q48 12 ${50 + headW / 2 + 1} 40 L${50 + headW / 2} 33 Q50 22 ${50 - headW / 2} 34 Z`} fill={hair} />}
        {hairStyle === 2 &&
          [0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Circle key={i} cx={36 + i * 4.7} cy={26 + Math.abs(3 - i) * 1.6} r="6" fill={hair} />
          ))}
        {hairStyle === 3 && <Path d={`M${50 - headW / 2 - 2} 50 Q46 10 ${50 + headW / 2 + 2} 50 L${50 + headW / 2} 36 Q50 26 ${50 - headW / 2} 36 Z`} fill={hair} />}
        {hairStyle === 4 && <Path d={`M${50 - headW / 2 + 1} 33 Q50 18 ${50 + headW / 2 - 1} 33 Q50 27 ${50 - headW / 2 + 1} 33 Z`} fill={hair} opacity="0.55" />}
        {hairStyle === 5 && (
          <>
            <Path d={`M${50 - headW / 2} 36 Q50 16 ${50 + headW / 2} 36 Q50 26 ${50 - headW / 2} 36 Z`} fill={hair} />
            <Rect x={50 - headW / 2 - 0.5} y="31" width={headW + 1} height="4" rx="2" fill="#F5F7FA" opacity="0.85" />
          </>
        )}
      </G>
      {/* Brows & eyes — intentionally minimal */}
      <Rect x="40" y="39" width="7" height="1.8" rx="0.9" fill={hair} opacity="0.85" />
      <Rect x="53" y="39" width="7" height="1.8" rx="0.9" fill={hair} opacity="0.85" />
      <Circle cx="43.5" cy="44" r="1.5" fill="#1A1412" />
      <Circle cx="56.5" cy="44" r="1.5" fill="#1A1412" />
      <Path d="M46 54 Q50 56.5 54 54" stroke="#1A1412" strokeOpacity="0.45" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </Svg>
  );
});
