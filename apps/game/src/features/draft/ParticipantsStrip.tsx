import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import type { RoomView } from '@byt/shared';
import { colors, fonts, radii } from '@byt/ui';
import { PlayerBadge } from '@/components/ui';
import { filledCount } from '../room/derive';

/** Budgets, squad progress and per-auction status for everyone. Tapping a chip shows that team. */
export function ParticipantsStrip({ view, meId, selectedId, onSelect, dense }: { view: RoomView; meId: string | null; selectedId: string; onSelect: (id: string) => void; dense?: boolean }) {
  const a = view.auction;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
      {view.participants.map((p) => {
        const slots = p.team.starters.length;
        const filled = filledCount(p);
        let tag: { text: string; color: string } | null = null;
        if (a && a.stage === 'open') {
          if (a.highBid?.participantId === p.id) tag = { text: 'EN TÊTE', color: p.color };
          else if (a.passed.includes(p.id)) tag = { text: 'PASSE', color: colors.textMute };
          else if (!a.eligible.includes(p.id)) tag = { text: 'HORS COURSE', color: colors.textMute };
        }
        if (a?.stage === 'closed' && a.result?.type === 'sold' && a.result.participantId === p.id) tag = { text: 'GAGNE', color: p.color };
        const selected = selectedId === p.id;
        return (
          <Pressable
            key={p.id}
            onPress={() => onSelect(p.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${p.nickname}${p.id === meId ? ' (vous)' : ''}, budget ${p.budget} millions, ${filled} sur ${slots} joueurs${p.connected ? '' : ', déconnecté'}`}
            style={[
              {
                minWidth: dense ? 150 : 176,
                paddingVertical: dense ? 6 : 9,
                paddingHorizontal: 10,
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: selected ? `${p.color}AA` : 'rgba(255,255,255,0.08)',
                backgroundColor: selected ? `${p.color}14` : 'rgba(12,18,25,0.6)',
                gap: dense ? 3 : 5,
              },
              Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null,
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ opacity: p.connected ? 1 : 0.45 }}>
                <PlayerBadge name={p.nickname} color={p.color} size={dense ? 26 : 30} ring={selected} />
              </View>
              <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 15, color: colors.text }} numberOfLines={1}>
                {p.nickname}
                {p.id === meId ? <Text style={{ color: colors.textMute }}> · vous</Text> : null}
              </Text>
              <Text testID={`budget-${p.seat}`} style={{ fontFamily: fonts.displayBlack, fontSize: 18, color: colors.text, fontVariant: ['tabular-nums'] }}>
                {p.budget}M
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              {Array.from({ length: slots }).map((_, i) => (
                <View key={i} style={{ flex: 1, maxWidth: 14, height: 4, borderRadius: 2, backgroundColor: i < filled ? p.color : 'rgba(255,255,255,0.12)' }} />
              ))}
              <View style={{ flex: 1 }} />
              {tag ? (
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.2, color: tag.color }}>{tag.text}</Text>
              ) : !p.connected ? (
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.2, color: colors.warn }}>HORS LIGNE</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
