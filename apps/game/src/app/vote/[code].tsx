import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors } from '@byt/ui';
import { GameTopBar } from '@/components/TopBar';
import { Body, Button, Screen, Title } from '@/components/ui';
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
      <GameTopBar code={code} tag="SPECTATEUR" connection={g.connection} />
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
