/**
 * App-level primitives built on the design tokens.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radii } from '@byt/ui';

/* ------------------------------------------------------------------ */
/* Typography                                                           */
/* ------------------------------------------------------------------ */

export function Title({ children, size = 34, style }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ fontFamily: fonts.displayBlack, fontSize: size, color: colors.text, letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: size * 1.02 }, style]}>{children}</Text>;
}

export function Eyebrow({ children, color = colors.accent, style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2.2, color, textTransform: 'uppercase' }, style]}>{children}</Text>;
}

export function Body({ children, dim, style, numberOfLines }: { children: ReactNode; dim?: boolean; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: dim ? colors.textDim : colors.text }, style]}>
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
      <LinearGradient colors={['#0D141B', colors.ink, '#05070A']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={edges} style={[{ flex: 1 }, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          backgroundColor: 'rgba(16,22,29,0.86)',
          borderColor: colors.line,
          borderWidth: 1,
          borderRadius: radii.lg,
          padding: 16,
        },
        style,
      ]}
    >
      {children}
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
  const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.accent, fg: colors.accentInk, border: colors.accent },
    secondary: { bg: colors.steel, fg: colors.text, border: colors.lineStrong },
    ghost: { bg: 'transparent', fg: colors.text, border: colors.lineStrong },
    danger: { bg: 'rgba(255,93,108,0.12)', fg: colors.danger, border: 'rgba(255,93,108,0.5)' },
    gold: { bg: colors.gold, fg: '#1D1505', border: colors.gold },
  };
  const p = palette[variant];
  const h = size === 'lg' ? 58 : size === 'md' ? 48 : 38;
  const off = disabled || loading;
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
          paddingHorizontal: size === 'sm' ? 14 : 22,
          borderRadius: radii.md,
          backgroundColor: p.bg,
          borderWidth: 1,
          borderColor: (state as { focused?: boolean }).focused ? colors.text : p.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: off ? 0.42 : 1,
          transform: [{ scale: state.pressed ? 0.97 : 1 }],
        },
        Platform.OS === 'web' ? ({ cursor: off ? 'not-allowed' : 'pointer', outlineStyle: 'none' } as object) : null,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={p.fg} /> : icon}
      <Text style={{ fontFamily: fonts.display, fontSize: size === 'lg' ? 22 : size === 'md' ? 19 : 16, letterSpacing: 1, color: p.fg, textTransform: 'uppercase' }}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                               */
/* ------------------------------------------------------------------ */

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Eyebrow color={colors.textDim}>{label}</Eyebrow>
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
            height: 52,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: error ? colors.danger : focused ? colors.accent : colors.lineStrong,
            backgroundColor: colors.graphite,
            color: colors.text,
            paddingHorizontal: 16,
            fontFamily: fonts.bodySemi,
            fontSize: 17,
          },
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
          props.style,
        ]}
      />
      {error ? <Text style={{ color: colors.danger, fontFamily: fonts.bodyMedium, fontSize: 13 }}>{error}</Text> : hint ? <Text style={{ color: colors.textMute, fontFamily: fonts.body, fontSize: 13 }}>{hint}</Text> : null}
    </View>
  );
}

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
  return (
    <View style={{ gap: 6 }}>
      <Eyebrow color={colors.textDim}>{label}</Eyebrow>
      <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
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
                  minHeight: 50,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: on ? colors.accent : (state as { focused?: boolean }).focused ? colors.text : colors.lineStrong,
                  backgroundColor: on ? 'rgba(25,227,200,0.10)' : colors.graphite,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 8,
                  paddingHorizontal: 6,
                },
                Platform.OS === 'web' ? ({ cursor: 'pointer', outlineStyle: 'none' } as object) : null,
              ]}
            >
              <Text style={{ fontFamily: fonts.display, fontSize: 18, color: on ? colors.accent : colors.text, letterSpacing: 0.5 }}>{o.label}</Text>
              {o.sub ? <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.textMute, marginTop: 2, textAlign: 'center' }}>{o.sub}</Text> : null}
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
      <View pointerEvents="none" style={{ position: 'absolute', top: 12, left: 0, right: 0, alignItems: 'center', gap: 6, zIndex: 1000 }}>
        {items.map((t) => (
          <Animated.View
            key={t.id}
            entering={FadeInDown.duration(220)}
            exiting={FadeOutUp.duration(200)}
            accessibilityLiveRegion="polite"
            style={{
              maxWidth: 520,
              marginHorizontal: 16,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: radii.md,
              backgroundColor: t.kind === 'error' ? '#2A1015' : t.kind === 'success' ? '#0D2A24' : colors.steelHi,
              borderWidth: 1,
              borderColor: t.kind === 'error' ? 'rgba(255,93,108,0.5)' : t.kind === 'success' ? 'rgba(25,227,200,0.5)' : colors.lineStrong,
            }}
          >
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
  const [visible, setVisible] = useState(state !== 'online');
  useEffect(() => {
    if (state === 'online') {
      const t = setTimeout(() => setVisible(false), 1200);
      return () => clearTimeout(t);
    }
    setVisible(true);
  }, [state]);
  if (!visible || state === 'idle') return null;
  const color = state === 'online' ? colors.success : state === 'connecting' ? colors.warn : colors.danger;
  const label = state === 'online' ? 'Connecté' : state === 'connecting' ? 'Connexion…' : 'Hors ligne — reconnexion…';
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: colors.line }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: colors.textDim, fontFamily: fonts.bodyMedium, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
