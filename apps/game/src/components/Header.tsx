import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '@byt/ui';

export function BackButton({ onPress, label = 'Retour' }: { onPress?: () => void; label?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      hitSlop={10}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingRight: 8 }}
    >
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textDim} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 5l-7 7 7 7" />
      </Svg>
      <Text style={{ fontFamily: fonts.bodySemi, color: colors.textDim, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function PageHeader({ title, right }: { title?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
      <BackButton />
      {title ? <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.text, letterSpacing: 1 }}>{title}</Text> : null}
      <View style={{ minWidth: 60, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}
