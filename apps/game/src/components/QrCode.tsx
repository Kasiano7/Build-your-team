import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { create } from 'qrcode/lib/core/qrcode';

/** Quiet zone, in modules, around the symbol. */
const QUIET = 3;

/** Path with one unit square per dark module (a single SVG node, cheap to render). */
function modulesPath(text: string, quiet: number): { size: number; d: string } {
  const qr = create(text, { errorCorrectionLevel: 'M' });
  const { size, data } = qr.modules;
  let d = '';
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (!data[y * size + x]) {
        x++;
        continue;
      }
      // Merge horizontal runs of dark modules into one rectangle.
      let run = 1;
      while (x + run < size && data[y * size + x + run]) run++;
      d += `M${x + quiet} ${y + quiet}h${run}v1h${-run}z`;
      x += run;
    }
  }
  return { size, d };
}

/**
 * Scannable QR code (dark modules on a white quiet zone, as phone cameras expect).
 * `size` is the outer width in pixels, quiet zone included.
 */
export function QrCode({ value, size = 180, label }: { value: string; size?: number; label?: string }) {
  const qr = useMemo(() => modulesPath(value, QUIET), [value]);
  const total = qr.size + QUIET * 2;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label ?? `QR code : ${value}`}
      style={{ width: size, height: size, borderRadius: Math.max(6, size * 0.05), overflow: 'hidden', backgroundColor: '#FFFFFF' }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`}>
        <Rect x={0} y={0} width={total} height={total} fill="#FFFFFF" />
        <Path d={qr.d} fill="#05070A" />
      </Svg>
    </View>
  );
}
