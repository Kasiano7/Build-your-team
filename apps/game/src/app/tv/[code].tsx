import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '@byt/ui';
import { Screen } from '@/components/ui';
import { TvScreen, TvStage } from '@/features/tv/TvScreen';
import { errorMessage } from '@/lib/errors';
import { gameClient } from '@/state/game-client';
import { useGame } from '@/state/hooks';

/** TV / big-screen mode: follows a room as a spectator, for a television or a projector. */
export default function TvRoute() {
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
    <Screen>
      <TvStage>
        {view && g.pack ? (
          <TvScreen view={view} pack={g.pack} connection={g.connection} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
            {error ? (
              <>
                <Text style={{ fontFamily: fonts.hero, fontSize: 64, color: colors.text }}>{error}</Text>
                <Text style={{ fontFamily: fonts.bodySemi, fontSize: 28, color: colors.textDim }}>Salon {code}</Text>
              </>
            ) : (
              <>
                <ActivityIndicator color={colors.accent} size="large" />
                <Text style={{ fontFamily: fonts.bodySemi, fontSize: 28, color: colors.textDim }}>Connexion au salon {code}…</Text>
              </>
            )}
          </View>
        )}
      </TvStage>
    </Screen>
  );
}
