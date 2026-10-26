import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { builtInFootballPacks } from '@byt/football';
import { nicknameSchema } from '@byt/shared';
import { colors } from '@byt/ui';
import { PageHeader } from '@/components/Header';
import { Body, Button, Field, Panel, Screen, Segmented, Title, useToast } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { getItem, keys, setItem } from '@/lib/storage';
import { gameClient } from '@/state/game-client';

// Shared rules (modes, formations) are identical across football packs.
const pack = builtInFootballPacks[0]!;

export default function CreateRoom() {
  const toast = useToast();
  const [nickname, setNickname] = useState('');
  const [nickError, setNickError] = useState<string | null>(null);
  const [players, setPlayers] = useState<2 | 3 | 4>(4);
  const [packId, setPackId] = useState(builtInFootballPacks[0]!.id);
  const [mode, setMode] = useState<'quick' | 'classic'>('quick');
  const modeDef = pack.modes.find((m) => m.id === mode)!;
  const [budget, setBudget] = useState(modeDef.defaultBudget);
  const [formationId, setFormationId] = useState(modeDef.defaultFormationId);
  const [timer, setTimer] = useState(15);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getItem(keys.nickname).then((n) => n && setNickname(n));
    gameClient.ensureConnected();
  }, []);

  const changeMode = (next: 'quick' | 'classic') => {
    const def = pack.modes.find((m) => m.id === next)!;
    setMode(next);
    setBudget(def.defaultBudget);
    setFormationId(def.defaultFormationId);
    setTimer(next === 'quick' ? 15 : 20);
  };

  const submit = async () => {
    const parsed = nicknameSchema.safeParse(nickname);
    if (!parsed.success) {
      setNickError(parsed.error.issues.some((i) => i.message === 'NICKNAME_BLOCKED') ? 'Ce pseudo n’est pas autorisé.' : 'Pseudo de 2 à 16 caractères (lettres, chiffres, espaces).');
      return;
    }
    setNickError(null);
    setBusy(true);
    await setItem(keys.nickname, parsed.data);
    const res = await gameClient.create({
      nickname: parsed.data,
      packId,
      mode,
      maxParticipants: players,
      budget,
      formationId,
      openingTimerSec: timer,
    });
    setBusy(false);
    if (!res.ok) return toast(errorMessage(res.code, res.details), 'error');
    router.replace(`/room/${res.roomCode}`);
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 560, gap: 18 }}>
            <PageHeader />
            <View style={{ gap: 6 }}>
              <Title size={40}>Créer une partie</Title>
              <Body dim>Un code et un lien d’invitation sont générés. Aucun compte n’est nécessaire.</Body>
            </View>
            <Panel style={{ gap: 18 }}>
              <Field
                label="Votre pseudo"
                value={nickname}
                onChangeText={setNickname}
                placeholder="ex. Camille"
                maxLength={16}
                autoCapitalize="words"
                autoCorrect={false}
                error={nickError}
                returnKeyType="done"
                testID="create-nickname"
              />
              <Segmented
                label="Joueurs"
                value={players}
                onChange={setPlayers}
                options={[
                  { value: 2, label: '2', sub: 'vote spectateurs' },
                  { value: 3, label: '3', sub: 'vote croisé' },
                  { value: 4, label: '4', sub: 'vote croisé' },
                ]}
              />
              <Segmented
                label="Joueurs à recruter"
                value={packId}
                onChange={setPackId}
                options={builtInFootballPacks.map((p) => ({
                  value: p.id,
                  label: p.dataset.fictional ? 'Fictifs' : 'Réels',
                  sub: p.dataset.fictional ? 'démo, 100 % inventés' : 'notes estimées, non officielles',
                }))}
              />
              <Segmented
                label="Mode"
                value={mode}
                onChange={changeMode}
                options={pack.modes.map((m) => ({ value: m.id, label: m.label, sub: m.id === 'quick' ? '5 joueurs' : '11 + 3 remplaçants' }))}
              />
              <Segmented label="Budget de départ" value={budget} onChange={setBudget} options={modeDef.allowedBudgets.map((b) => ({ value: b, label: `${b}M` }))} />
              {modeDef.formationIds.length > 1 && (
                <Segmented
                  label="Formation de départ"
                  value={formationId}
                  onChange={setFormationId}
                  options={modeDef.formationIds.map((f) => ({ value: f, label: pack.formations.find((x) => x.id === f)!.label }))}
                />
              )}
              <Segmented
                label="Chrono d’ouverture"
                value={timer}
                onChange={setTimer}
                options={[
                  { value: 10, label: '10 s', sub: 'nerveux' },
                  { value: 15, label: '15 s' },
                  { value: 20, label: '20 s' },
                  { value: 30, label: '30 s', sub: 'posé' },
                ]}
              />
              <Body dim style={{ fontSize: 13, color: colors.textMute }}>
                Surenchère minimale 10M · chrono relancé à 12 s après chaque offre · 10M réservés par poste restant.
              </Body>
            </Panel>
            <Button label="Créer le salon" size="lg" loading={busy} onPress={submit} testID="create-submit" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
