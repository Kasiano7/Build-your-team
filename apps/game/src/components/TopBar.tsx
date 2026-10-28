import type { ReactNode } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radii } from '@byt/ui';
import { updateSettings, useSettings } from '@/state/settings';
import { LogoMark } from './Logo';
import { ConnectionBadge } from './ui';

function IconButton({ onPress, label, children, active, role = 'button' }: { onPress: () => void; label: string; children: ReactNode; active?: boolean; role?: 'button' | 'switch' }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'switch' ? { checked: !!active } : undefined}
      hitSlop={6}
      style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? 'rgba(43,227,208,0.12)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: active ? 'rgba(43,227,208,0.35)' : 'rgba(255,255,255,0.09)' }}
    >
      {children}
    </Pressable>
  );
}

/** Glass bar shown during a game: room code, status, sound and settings. */
export function GameTopBar({ code, meta, tag, connection }: { code: string; meta?: string; tag?: string; connection: 'idle' | 'connecting' | 'online' | 'offline' }) {
  const { width } = useWindowDimensions();
  const s = useSettings();
  const narrow = width < 560;
  return (
    <View style={{ paddingHorizontal: narrow ? 10 : 14, paddingTop: 8, paddingBottom: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, height: 56, borderRadius: radii.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', backgroundColor: 'rgba(10,15,21,0.5)' }}>
        <BlurView intensity={24} tint="dark" style={{ position: 'absolute', inset: 0 }} pointerEvents="none" />
        <Pressable onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="Accueil" style={{ paddingHorizontal: 6 }}>
          <LogoMark size={20} />
        </Pressable>
        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
          <Text style={{ fontFamily: fonts.heroBold, fontSize: 13, color: colors.text, letterSpacing: 2 }}>{code}</Text>
        </View>
        {tag ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.textMute, letterSpacing: 1.2 }}>{tag}</Text> : null}
        {meta && !narrow ? (
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMute }} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        <View style={{ flex: 1 }} />
        <ConnectionBadge state={connection} />
        <IconButton role="switch" onPress={() => updateSettings({ muted: !s.muted })} label="Sons" active={!s.muted}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={s.muted ? colors.textMute : colors.accent} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M4 9v6h4l5 4V5L8 9H4z" />
            {s.muted ? <Path d="M17 9l4 6M21 9l-4 6" /> : <Path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
          </Svg>
        </IconButton>
        <IconButton onPress={() => router.push('/settings')} label="Paramètres">
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textDim} strokeWidth={1.8} strokeLinecap="round">
            <Path d="M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4" />
          </Svg>
        </IconButton>
      </View>
    </View>
  );
}
