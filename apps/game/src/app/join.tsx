import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ROOM_CODE_LENGTH, nicknameSchema, roomCodeSchema } from '@byt/shared';
import { PageHeader } from '@/components/Header';
import { Body, Button, Field, Panel, Screen, Title, useToast } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { getItem, keys, setItem } from '@/lib/storage';
import { gameClient } from '@/state/game-client';

export default function JoinRoom() {
  const params = useLocalSearchParams<{ code?: string }>();
  const toast = useToast();
  const [code, setCode] = useState((params.code ?? '').toUpperCase());
  const [nickname, setNickname] = useState('');
  const [errors, setErrors] = useState<{ code?: string; nick?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getItem(keys.nickname).then((n) => n && setNickname(n));
    gameClient.ensureConnected();
  }, []);

  const submit = async () => {
    const c = roomCodeSchema.safeParse(code);
    const n = nicknameSchema.safeParse(nickname);
    const next = {
      code: c.success ? undefined : `Le code comporte ${ROOM_CODE_LENGTH} caractères.`,
      nick: n.success ? undefined : 'Pseudo de 2 à 16 caractères.',
    };
    setErrors(next);
    if (!c.success || !n.success) return;
    setBusy(true);
    await setItem(keys.nickname, n.data);
    // Already in this room on this device? Resume instead of creating a second seat.
    const resumed = await gameClient.resume(c.data);
    if (resumed?.ok) {
      setBusy(false);
      return router.replace(`/room/${c.data}`);
    }
    const res = await gameClient.join(c.data, n.data);
    setBusy(false);
    if (!res.ok) {
      if (res.code === 'GAME_ALREADY_STARTED') {
        toast('La partie a commencé. Vous pourrez suivre et voter en spectateur.', 'info');
        return router.replace(`/vote/${c.data}`);
      }
      return toast(errorMessage(res.code), 'error');
    }
    router.replace(`/room/${res.roomCode}`);
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 18, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 480, gap: 18 }}>
            <PageHeader />
            <View style={{ gap: 6 }}>
              <Title size={40}>Rejoindre</Title>
              <Body dim>Entrez le code affiché chez l’hôte, ou ouvrez son lien d’invitation.</Body>
            </View>
            <Panel style={{ gap: 18 }}>
              <Field
                label="Code du salon"
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH))}
                placeholder="ex. K7QF2M"
                autoCapitalize="characters"
                autoCorrect={false}
                error={errors.code}
                style={{ fontSize: 26, letterSpacing: 8, textAlign: 'center' }}
                testID="join-code"
              />
              <Field label="Votre pseudo" value={nickname} onChangeText={setNickname} placeholder="ex. Sacha" maxLength={16} error={errors.nick} testID="join-nickname" onSubmitEditing={submit} />
            </Panel>
            <Button label="Rejoindre le salon" size="lg" loading={busy} onPress={submit} testID="join-submit" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
