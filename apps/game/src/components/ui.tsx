/**
 * App-level primitives built on the design tokens (design system v2):
 * stadium-night backdrop, frosted glass surfaces, pill controls.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Backdrop, colors, fonts, gradients, radii } from '@byt/ui';

const web = Platform.OS === 'web';
/** Web-only style props (cursor, outlines, shadows) typed loosely. */
const webOnly = (s: Record<string, unknown>) => (web ? (s as object) : null);

/* ------------------------------------------------------------------ */
/* Typography                                                           */
/* ------------------------------------------------------------------ */

export function Title({ children, size = 30, style }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle> }) {
  return (
    <Text accessibilityRole="header" style={[{ fontFamily: fonts.hero, fontSize: size, color: colors.text, letterSpacing: -0.6, lineHeight: size * 1.12 }, style]}>
      {children}
    </Text>
  );
}

export function Eyebrow({ children, color = colors.accent, style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color, textTransform: 'uppercase' }, style]}>{children}</Text>;
}

export function Body({ children, dim, style, numberOfLines }: { children: ReactNode; dim?: boolean; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 23, color: dim ? colors.textDim : colors.text }, style]}>
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/* Screen & surfaces                                                    */
/* ------------------------------------------------------------------ */

export function Screen({ children, style, edges = ['top', 'bottom', 'left', 'right'] }: { children: ReactNode; style?: StyleProp<ViewStyle>; edges?: ('top' | 'bottom' | 'left' | 'right')[] }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <Backdrop />
      <SafeAreaView edges={edges} style={[{ flex: 1 }, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

/**
 * Frosted glass surface: real blur where available, translucent fill, a light
 * top highlight and a hairline border. `tone="raised"` is a touch brighter.
 */
export function Panel({ children, style, tone = 'base' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'base' | 'raised' }) {
  return (
    <View
      style={[
        {
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: tone === 'raised' ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.085)',
          backgroundColor: tone === 'raised' ? 'rgba(22,31,41,0.62)' : 'rgba(12,18,25,0.55)',
          overflow: 'hidden',
          padding: 18,
        },
        webOnly({ boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }),
        style,
      ]}
    >
      <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0)']}
        locations={[0, 0.45]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

/** Small rounded label (status, position, metadata). */
export function Chip({ label, color = colors.textDim, tint, style }: { label: string; color?: string; tint?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: tint ?? 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }, style]}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.6, color }}>{label}</Text>
    </View>
  );
}

/** Round initials badge in the participant's colour. */
export function PlayerBadge({ name, color, size = 32, ring }: { name: string; color: string; size?: number; ring?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join('');
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: `${color}26`, borderWidth: ring ? 2 : 1, borderColor: ring ? color : `${color}88` }}>
      <Text style={{ fontFamily: fonts.heroBold, fontSize: size * 0.36, color }}>{initials}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Button                                                               */
/* ------------------------------------------------------------------ */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  size = 'md',
  icon,
  style,
  accessibilityHint,
  testID,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}) {
  const h = size === 'lg' ? 58 : size === 'md' ? 50 : 40;
  const off = disabled || loading;
  const filled = variant === 'primary' || variant === 'gold';
  const fg = variant === 'primary' ? colors.accentInk : variant === 'gold' ? '#1D1505' : variant === 'danger' ? '#FF8A95' : colors.text;
  const grad = variant === 'gold' ? gradients.gold : gradients.accent;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={(state) => [
        {
          height: h,
          paddingHorizontal: size === 'sm' ? 16 : 24,
          borderRadius: radii.pill,
          overflow: 'hidden',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderWidth: filled ? 0 : 1,
          borderColor: (state as { focused?: boolean }).focused
            ? colors.text
            : variant === 'danger'
              ? 'rgba(255,93,108,0.45)'
              : 'rgba(255,255,255,0.14)',
          backgroundColor: filled ? 'transparent' : variant === 'danger' ? 'rgba(255,93,108,0.10)' : variant === 'ghost' ? 'transparent' : 'rgba(255,255,255,0.06)',
          opacity: off ? 0.4 : 1,
          transform: [{ scale: state.pressed ? 0.97 : 1 }],
        },
        webOnly({
          cursor: off ? 'not-allowed' : 'pointer',
          outlineStyle: 'none',
          transitionProperty: 'transform, opacity, box-shadow',
          transitionDuration: '160ms',
          boxShadow: filled && !off ? (variant === 'gold' ? '0 10px 30px rgba(230,193,112,0.25)' : '0 10px 30px rgba(43,227,208,0.28)') : 'none',
        }),
        style,
      ]}
    >
      {filled && <LinearGradient colors={[...grad]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
      {filled && <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} locations={[0, 0.55]} style={[StyleSheet.absoluteFill, { opacity: 0.5 }]} />}
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <Text style={{ fontFamily: fonts.display, fontSize: size === 'lg' ? 17 : size === 'md' ? 15 : 13, letterSpacing: 0.2, color: fg }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                               */
/* ------------------------------------------------------------------ */

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textDim }}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMute}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          {
            height: 54,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: error ? colors.danger : focused ? colors.accent : 'rgba(255,255,255,0.10)',
            backgroundColor: focused ? 'rgba(43,227,208,0.06)' : 'rgba(255,255,255,0.04)',
            color: colors.text,
            paddingHorizontal: 18,
            fontFamily: fonts.bodySemi,
            fontSize: 17,
          },
          webOnly({ outlineStyle: 'none', transitionProperty: 'border-color, background-color', transitionDuration: '160ms' }),
          props.style,
        ]}
      />
      {error ? <Text style={{ color: colors.danger, fontFamily: fonts.bodySemi, fontSize: 13 }}>{error}</Text> : hint ? <Text style={{ color: colors.textMute, fontFamily: fonts.bodyMedium, fontSize: 13 }}>{hint}</Text> : null}
    </View>
  );
}

/** Pill selector inside a glass track. */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; sub?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const withSub = options.some((o) => o.sub);
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textDim }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: withSub ? radii.md + 4 : radii.pill, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }} accessibilityRole="radiogroup">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${label} : ${o.label}`}
              onPress={() => onChange(o.value)}
              style={(state) => [
                {
                  flex: 1,
                  minHeight: withSub ? 52 : 40,
                  borderRadius: withSub ? radii.md : radii.pill,
                  borderWidth: 1,
                  borderColor: on ? 'rgba(43,227,208,0.55)' : (state as { focused?: boolean }).focused ? colors.text : 'transparent',
                  backgroundColor: on ? 'rgba(43,227,208,0.14)' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 6,
                  paddingHorizontal: 6,
                },
                webOnly({ cursor: 'pointer', outlineStyle: 'none', transitionProperty: 'background-color, border-color', transitionDuration: '160ms' }),
              ]}
            >
              <Text style={{ fontFamily: fonts.display, fontSize: 14, color: on ? colors.accent2 : colors.text }}>{o.label}</Text>
              {o.sub ? <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 11, color: on ? colors.textDim : colors.textMute, marginTop: 2, textAlign: 'center' }}>{o.sub}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Toasts                                                               */
/* ------------------------------------------------------------------ */

type ToastKind = 'info' | 'error' | 'success';
interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
}
const ToastContext = createContext<(text: string, kind?: ToastKind) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const push = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-2), { id, text, kind }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <View pointerEvents="none" style={{ position: 'absolute', top: 14, left: 0, right: 0, alignItems: 'center', gap: 8, zIndex: 1000 }}>
        {items.map((t) => (
          <Animated.View
            key={t.id}
            entering={FadeInDown.duration(220)}
            exiting={FadeOutUp.duration(200)}
            accessibilityLiveRegion="polite"
            style={[
              {
                maxWidth: 520,
                marginHorizontal: 16,
                paddingHorizontal: 18,
                paddingVertical: 11,
                borderRadius: radii.pill,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: 'rgba(18,25,33,0.92)',
                borderWidth: 1,
                borderColor: t.kind === 'error' ? 'rgba(255,93,108,0.45)' : t.kind === 'success' ? 'rgba(43,227,208,0.45)' : 'rgba(255,255,255,0.14)',
              },
              webOnly({ boxShadow: '0 12px 40px rgba(0,0,0,0.45)', backdropFilter: 'blur(14px)' }),
            ]}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.kind === 'error' ? colors.danger : t.kind === 'success' ? colors.accent : colors.textDim }} />
            <Text style={{ color: colors.text, fontFamily: fonts.bodySemi, fontSize: 14 }}>{t.text}</Text>
          </Animated.View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ------------------------------------------------------------------ */
/* Misc                                                                 */
/* ------------------------------------------------------------------ */

export function ConnectionBadge({ state }: { state: 'idle' | 'connecting' | 'online' | 'offline' }) {
  // Show "connected" briefly after a (re)connection, then hide; always show non-online states.
  const [prev, setPrev] = useState(state);
  const [flash, setFlash] = useState(false);
  if (prev !== state) {
    setPrev(state);
    setFlash(state === 'online' && prev !== 'idle');
  }
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 1200);
    return () => clearTimeout(t);
  }, [flash]);
  if (state === 'idle' || (state === 'online' && !flash)) return null;
  const color = state === 'online' ? colors.success : state === 'connecting' ? colors.warn : colors.danger;
  const label = state === 'online' ? 'Connecté' : state === 'connecting' ? 'Connexion…' : 'Hors ligne — reconnexion…';
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.line }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: colors.textDim, fontFamily: fonts.bodySemi, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
