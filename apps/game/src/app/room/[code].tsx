import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { roomCodeSchema } from '@byt/shared';
import { colors, fonts } from '@byt/ui';
import { LogoMark } from '@/components/Logo';
import { Body, Button, ConnectionBadge, Screen, Title } from '@/components/ui';
import { DraftScreen } from '@/features/draft/DraftScreen';
import { Lobby } from '@/features/room/Lobby';
import { EndScreen } from '@/features/end/EndScreen';
import { updateSettings, useSettings } from '@/state/settings';
import { gameClient } from '@/state/game-client';
import { useGame } from '@/state/hooks';

export default function RoomScreen() {
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = (raw ?? '').toUpperCase();
  const g = useGame();
  const settings = useSettings();
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Pressable onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="Accueil">
        <LogoMark size={22} />
      </Pressable>
      <Text style={{ fontFamily: fonts.display, fontSize: 17, color: colors.text, letterSpacing: 2 }}>{code}</Text>
      {g.view?.status === 'drafting' && (
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMute }}>
          {g.view.auctionCount} enchère{g.view.auctionCount > 1 ? 's' : ''} · {g.view.poolSize} joueurs restants
        </Text>
      )}
      <View style={{ flex: 1 }} />
      <ConnectionBadge state={g.connection} />
      <Pressable
        onPress={() => updateSettings({ muted: !settings.muted })}
        accessibilityRole="switch"
        accessibilityState={{ checked: !settings.muted }}
        accessibilityLabel="Sons"
        style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.line }}
      >
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: settings.muted ? colors.textMute : colors.accent }}>{settings.muted ? 'SON OFF' : 'SON ON'}</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Paramètres" style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.line }}>
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textDim }}>RÉGLAGES</Text>
      </Pressable>
    </View>
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
