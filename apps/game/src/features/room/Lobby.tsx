import { Platform, Pressable, ScrollView, Share, Text, View, useWindowDimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { PackMeta, RoomView } from '@byt/shared';
import { colors, fonts, radii } from '@byt/ui';
import { Body, Button, Eyebrow, Panel, PlayerBadge, Title, useToast } from '@/components/ui';
import { inviteLink } from '@/lib/config';
import { errorMessage } from '@/lib/errors';
import { gameClient } from '@/state/game-client';
import { useReduceMotion } from '@/state/settings';

export function Lobby({ view, pack, meId, onLeave }: { view: RoomView; pack: PackMeta; meId: string; onLeave: () => void }) {
  const toast = useToast();
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();
  const me = view.participants.find((p) => p.id === meId);
  const isHost = !!me?.isHost;
  const link = inviteLink(view.code);
  const mode = pack.modes.find((m) => m.id === view.settings.mode)!;
  const formation = pack.formations.find((f) => f.id === view.settings.formationId)!;
  const seats = Array.from({ length: view.settings.maxParticipants }, (_, i) => view.participants.find((p) => p.seat === i) ?? null);
  const wide = width >= 860;

  const copy = async () => {
    await Clipboard.setStringAsync(link);
    toast('Lien copié', 'success');
  };
  const share = async () => {
    try {
      if (Platform.OS === 'web' && !(typeof navigator !== 'undefined' && 'share' in navigator)) return copy();
      await Share.share({ message: `Rejoins ma partie Build Your Team ! Code ${view.code} — ${link}`, url: link, title: 'Build Your Team' });
    } catch {
      void copy();
    }
  };
  const kick = async (id: string, name: string) => {
    const res = await gameClient.kick(id);
    toast(res.ok ? `${name} a été retiré du salon` : errorMessage(res.code), res.ok ? 'success' : 'error');
  };
  const start = async () => {
    const res = await gameClient.start();
    if (!res.ok) toast(errorMessage(res.code), 'error');
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 18, alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: 980, gap: 18 }}>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 18 }}>
          <Panel style={{ flex: 1, gap: 14 }}>
            <Eyebrow>Code du salon</Eyebrow>
            <Pressable onPress={copy} accessibilityRole="button" accessibilityLabel={`Code ${view.code.split('').join(' ')}, appuyer pour copier le lien`}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {view.code.split('').map((ch, i) => (
                  <View key={i} style={{ flex: 1, maxWidth: 64, aspectRatio: 0.8, borderRadius: radii.md, backgroundColor: 'rgba(43,227,208,0.06)', borderWidth: 1, borderColor: 'rgba(43,227,208,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text testID={i === 0 ? 'lobby-code' : undefined} style={{ fontFamily: fonts.displayBlack, fontSize: wide ? 48 : 36, color: colors.accent }}>
                      {ch}
                    </Text>
                  </View>
                ))}
              </View>
            </Pressable>
            <Text selectable style={{ fontFamily: fonts.bodyMedium, color: colors.textDim, fontSize: 13 }} numberOfLines={1}>
              {link}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button label="Inviter" onPress={share} style={{ flex: 1 }} />
              <Button label="Copier le lien" variant="secondary" onPress={copy} style={{ flex: 1 }} />
            </View>
          </Panel>

          <Panel style={{ flex: 1, gap: 10 }}>
            <Eyebrow>Règles de la partie</Eyebrow>
            {[
              ['Mode', `${mode.label} · ${formation.label}`],
              ['Budget', `${view.settings.budget}M chacun`],
              ['Enchères', `+${view.settings.minIncrement}M minimum · chrono ${Math.round(view.settings.openingTimerSec)} s, relancé à ${Math.round(view.settings.bidResetSec)} s`],
              ['Réserve', `${view.settings.reservePrice}M bloqués par poste restant à pourvoir`],
              ['Vote final', view.settings.maxParticipants === 2 ? 'Des amis spectateurs votent via un lien' : 'Chacun vote pour une autre équipe'],
              ['Données', pack.dataset.label],
            ].map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', gap: 12 }}>
                <Text style={{ width: 82, fontFamily: fonts.bodySemi, color: colors.textMute, fontSize: 13 }}>{k}</Text>
                <Text style={{ flex: 1, fontFamily: fonts.bodyMedium, color: colors.text, fontSize: 14 }}>{v}</Text>
              </View>
            ))}
          </Panel>
        </View>

        <Panel style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Eyebrow>Joueurs</Eyebrow>
            <Text style={{ fontFamily: fonts.display, color: colors.textDim, fontSize: 16 }}>
              {view.participants.length}/{view.settings.maxParticipants}
            </Text>
          </View>
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 10 }}>
            {seats.map((p, i) => (
              <Animated.View
                key={p?.id ?? `seat-${i}`}
                entering={reduce ? undefined : FadeInDown.duration(300)}
                style={{
                  flex: wide ? 1 : undefined,
                  minHeight: 72,
                  borderRadius: radii.lg,
                  borderWidth: 1,
                  borderStyle: p ? 'solid' : 'dashed',
                  borderColor: p ? colors.lineStrong : colors.line,
                  backgroundColor: p ? 'rgba(255,255,255,0.045)' : 'transparent',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 14,
                }}
              >
                {p ? (
                  <PlayerBadge name={p.nickname} color={p.color} size={38} ring={p.connected} />
                ) : (
                  <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong }} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 20, color: p ? colors.text : colors.textMute, letterSpacing: 0.5 }} numberOfLines={1}>
                    {p ? p.nickname : 'En attente…'}
                  </Text>
                  {p && (
                    <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textDim }}>
                      {p.isHost ? 'Hôte' : 'Invité'}
                      {p.id === meId ? ' · vous' : ''}
                      {!p.connected ? ' · déconnecté' : ''}
                    </Text>
                  )}
                </View>
                {isHost && p && p.id !== meId && (
                  <Pressable
                    onPress={() => kick(p.id, p.nickname)}
                    accessibilityRole="button"
                    accessibilityLabel={`Retirer ${p.nickname} du salon`}
                    hitSlop={8}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.line }}
                  >
                    <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textDim }}>Retirer</Text>
                  </Pressable>
                )}
              </Animated.View>
            ))}
          </View>
        </Panel>

        {isHost ? (
          <View style={{ gap: 8 }}>
            <Button label="Lancer la partie" size="lg" disabled={view.participants.length < 2} onPress={start} testID="lobby-start" />
            <Body dim style={{ textAlign: 'center', fontSize: 13 }}>
              {view.participants.length < 2 ? 'Il faut au moins 2 joueurs.' : 'Vous pouvez lancer sans attendre que toutes les places soient prises.'}
            </Body>
          </View>
        ) : (
          <Panel style={{ alignItems: 'center' }}>
            <Title size={22}>En attente de l’hôte</Title>
            <Body dim>La partie démarre dès que l’hôte la lance.</Body>
          </Panel>
        )}
        <Button label="Quitter le salon" variant="ghost" size="sm" onPress={onLeave} style={{ alignSelf: 'center' }} />
      </View>
    </ScrollView>
  );
}
