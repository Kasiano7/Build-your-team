import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { roomCodeSchema } from '@byt/shared';
import { colors } from '@byt/ui';
import { GameTopBar } from '@/components/TopBar';
import { Body, Button, Screen, Title } from '@/components/ui';
import { DraftScreen } from '@/features/draft/DraftScreen';
import { Lobby } from '@/features/room/Lobby';
import { EndScreen } from '@/features/end/EndScreen';
import { gameClient } from '@/state/game-client';
import { useGame } from '@/state/hooks';

export default function RoomScreen() {
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = (raw ?? '').toUpperCase();
  const g = useGame();
  const validCode = roomCodeSchema.safeParse(code).success;
  const [checking, setChecking] = useState(validCode);

  useEffect(() => {
    gameClient.ensureConnected();
    if (!validCode) return;
    void gameClient.resume(code).finally(() => setChecking(false));
  }, [code, validCode]);

  // Landscape is preferred during the draft on phones (large pitch + readable panel), menus stay free.
  const status = g.view?.status;
  useEffect(() => {
    if (status === 'drafting') void ScreenOrientation.unlockAsync().catch(() => undefined);
    return () => void ScreenOrientation.unlockAsync().catch(() => undefined);
  }, [status]);

  const mine = g.role === 'player' && g.roomCode === code && g.view && g.pack && g.participantId;

  const topBar = (
    <GameTopBar
      code={code}
      connection={g.connection}
      meta={g.view?.status === 'drafting' ? `${g.view.auctionCount} enchère${g.view.auctionCount > 1 ? 's' : ''} · ${g.view.poolSize} joueurs restants` : undefined}
    />
  );

  if (g.removed && g.roomCode === code) {
    return (
      <Screen>
        {topBar}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
          <Title size={30}>Vous avez été retiré du salon</Title>
          <Body dim style={{ textAlign: 'center' }}>L’hôte vous a retiré de la partie avant son lancement.</Body>
          <Button label="Accueil" onPress={() => { gameClient.reset(); router.replace('/'); }} />
        </View>
      </Screen>
    );
  }

  if (!mine) {
    return (
      <Screen>
        {topBar}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
          {checking || g.connection === 'connecting' ? (
            <>
              <ActivityIndicator color={colors.accent} />
              <Body dim>Connexion au salon {code}…</Body>
            </>
          ) : (
            <>
              <Title size={30}>Vous n’êtes pas dans ce salon</Title>
              <Body dim style={{ textAlign: 'center', maxWidth: 420 }}>
                {g.connection === 'offline'
                  ? 'Le serveur de jeu est injoignable. Vérifiez votre connexion : la reconnexion est automatique.'
                  : 'Aucune session enregistrée sur cet appareil pour ce code. Rejoignez la partie, ou suivez-la en spectateur.'}
              </Body>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label="Rejoindre" onPress={() => router.replace({ pathname: '/join', params: { code } })} />
                <Button label="Spectateur" variant="secondary" onPress={() => router.replace(`/vote/${code}`)} />
              </View>
            </>
          )}
        </View>
      </Screen>
    );
  }

  const view = g.view!;
  const pack = g.pack!;
  const meId = g.participantId!;
  const leave = async () => {
    await gameClient.leave();
    router.replace('/');
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      {topBar}
      {view.status === 'lobby' && <Lobby view={view} pack={pack} meId={meId} onLeave={leave} />}
      {view.status === 'drafting' && <DraftScreen view={view} pack={pack} meId={meId} />}
      {(view.status === 'voting' || view.status === 'finished') && <EndScreen view={view} pack={pack} meId={meId} role="player" />}
    </Screen>
  );
}
