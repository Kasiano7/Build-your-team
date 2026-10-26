import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '@byt/ui';
import { LogoMark } from '@/components/Logo';
import { Body, Button, ConnectionBadge, Screen, Title } from '@/components/ui';
import { EndScreen } from '@/features/end/EndScreen';
import { errorMessage } from '@/lib/errors';
import { gameClient } from '@/state/game-client';
import { useGame } from '@/state/hooks';

/** Spectator link: follow a room, vote when spectator voting is open, see the shareable result. */
export default function SpectatorScreen() {
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = (raw ?? '').toUpperCase();
  const g = useGame();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gameClient.ensureConnected();
    void gameClient.spectate(code).then((res) => {
      if (!res.ok) setError(errorMessage(res.code));
    });
  }, [code]);

  const view = g.role === 'spectator' && g.roomCode === code ? g.view : null;

  return (
    <Screen edges={['top', 'left', 'right']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <Pressable onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="Accueil">
          <LogoMark size={22} />
        </Pressable>
        <Text style={{ fontFamily: fonts.display, fontSize: 17, color: colors.text, letterSpacing: 2 }}>{code}</Text>
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textMute }}>SPECTATEUR</Text>
        <View style={{ flex: 1 }} />
        <ConnectionBadge state={g.connection} />
      </View>
      {!view || !g.pack ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
          {error ? (
            <>
              <Title size={28}>{error}</Title>
              <Button label="Accueil" onPress={() => router.replace('/')} />
            </>
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}
        </View>
      ) : view.status === 'voting' || view.status === 'finished' ? (
        <EndScreen view={view} pack={g.pack} meId={null} role="spectator" spectatorVote={g.spectatorVote} />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
          <Title size={30}>{view.status === 'lobby' ? 'La partie va commencer' : 'Enchères en cours'}</Title>
          <Body dim style={{ textAlign: 'center', maxWidth: 440 }}>
            {view.participants.map((p) => p.nickname).join(' · ')}
            {'\n'}
            {view.status === 'drafting'
              ? `${view.auctionCount} enchères jouées. Gardez cette page ouverte : le vote s’affichera ici automatiquement.`
              : 'Gardez cette page ouverte : elle se mettra à jour automatiquement.'}
          </Body>
        </View>
      )}
    </Screen>
  );
}
