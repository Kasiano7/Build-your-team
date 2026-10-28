import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { builtInArenaPacks } from '@byt/arena';
import { builtInBasketballPacks } from '@byt/basketball';
import { builtInFootballPacks } from '@byt/football';
import { builtInMotorsportPacks } from '@byt/motorsport';
import { builtInRugbyPacks } from '@byt/rugby';
import type { ContentPack } from '@byt/shared';
import { nicknameSchema } from '@byt/shared';
import { colors } from '@byt/ui';
import { PageHeader } from '@/components/Header';
import { DEFAULT_OPTIONS, GameOptions, twitchChannelOf, type GameOptionsValue } from '@/features/create/GameOptions';
import { Body, Button, Field, Panel, Screen, Segmented, Title, useToast } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { getItem, keys, setItem } from '@/lib/storage';
import { gameClient } from '@/state/game-client';

/** Playable universes and their datasets (first = default). Modes and line-ups come from the chosen pack. */
const UNIVERSES: { id: string; label: string; sub: string; packs: ContentPack[] }[] = [
  { id: 'football', label: 'Football', sub: '5 ou 11 joueurs', packs: builtInFootballPacks },
  { id: 'basketball', label: 'Basket', sub: '5 joueurs + banc', packs: builtInBasketballPacks },
  { id: 'rugby', label: 'Rugby', sub: '7 ou 15 joueurs', packs: builtInRugbyPacks },
  { id: 'motorsport', label: 'F1', sub: 'pilotes + écurie', packs: builtInMotorsportPacks },
  { id: 'arena', label: 'Arènes', sub: 'héros inventés', packs: builtInArenaPacks },
];

export default function CreateRoom() {
  const toast = useToast();
  const [nickname, setNickname] = useState('');
  const [nickError, setNickError] = useState<string | null>(null);
  const [players, setPlayers] = useState<2 | 3 | 4>(4);
  const [universeId, setUniverseId] = useState('football');
  const universe = UNIVERSES.find((u) => u.id === universeId)!;
  const [packId, setPackId] = useState(builtInFootballPacks[0]!.id);
  const pack = universe.packs.find((p) => p.id === packId) ?? universe.packs[0]!;
  const [mode, setMode] = useState<'quick' | 'classic'>('quick');
  const modeDef = pack.modes.find((m) => m.id === mode)!;
  const [budget, setBudget] = useState(modeDef.defaultBudget);
  const [formationId, setFormationId] = useState(modeDef.defaultFormationId);
  const [timer, setTimer] = useState(15);
  const [options, setOptions] = useState<GameOptionsValue>(DEFAULT_OPTIONS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getItem(keys.nickname).then((n) => n && setNickname(n));
    gameClient.ensureConnected();
  }, []);

  const changeMode = (next: 'quick' | 'classic', inPack: ContentPack = pack) => {
    const def = inPack.modes.find((m) => m.id === next)!;
    setMode(next);
    setBudget(def.defaultBudget);
    setFormationId(def.defaultFormationId);
    setTimer(next === 'quick' ? 15 : 20);
  };

  const changeUniverse = (id: string) => {
    const u = UNIVERSES.find((x) => x.id === id)!;
    setUniverseId(id);
    setPackId(u.packs[0]!.id);
    changeMode(mode, u.packs[0]!);
    // Themes belong to a pack.
    setOptions((o) => ({ ...o, themeId: null }));
  };

  const submit = async () => {
    const parsed = nicknameSchema.safeParse(nickname);
    if (!parsed.success) {
      setNickError(parsed.error.issues.some((i) => i.message === 'NICKNAME_BLOCKED') ? 'Ce pseudo n’est pas autorisé.' : 'Pseudo de 2 à 16 caractères (lettres, chiffres, espaces).');
      return;
    }
    setNickError(null);
    const twitchChannel = twitchChannelOf(options.twitchChannel);
    if (options.twitchChannel.trim() && !twitchChannel) return toast('Nom de chaîne Twitch invalide.', 'error');
    setBusy(true);
    await setItem(keys.nickname, parsed.data);
    const res = await gameClient.create({
      nickname: parsed.data,
      packId: pack.id,
      mode,
      maxParticipants: players,
      budget,
      formationId,
      // Éclair sets its own short timers on the server.
      ...(options.pace === 'eclair' ? {} : { openingTimerSec: timer }),
      format: options.format,
      auctionStyle: options.auctionStyle,
      pace: options.pace,
      themeId: options.themeId,
      mystery: options.mystery,
      jokers: options.jokers,
      mercato: options.mercato,
      endMode: options.endMode,
      twitchChannel,
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
              <Segmented label="Univers" value={universeId} onChange={changeUniverse} options={UNIVERSES.map((u) => ({ value: u.id, label: u.label, sub: u.sub }))} />
              {universe.packs.length > 1 && (
              <Segmented
                label="Joueurs à recruter"
                value={packId}
                onChange={setPackId}
                options={universe.packs.map((p) => ({
                  value: p.id,
                  label: p.dataset.fictional ? 'Fictifs' : 'Réels',
                  sub: p.dataset.fictional ? '100 % inventés' : 'notes estimées, non officielles',
                }))}
              />
              )}
              <Segmented
                label="Mode"
                value={mode}
                onChange={(m) => changeMode(m)}
                options={pack.modes.map((m) => {
                  const starters = pack.formations.find((f) => f.id === m.defaultFormationId)!.slots.length;
                  return { value: m.id, label: m.label, sub: m.benchSize ? `${starters} + ${m.benchSize} remplaçants` : `${starters} joueurs` };
                })}
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
              {options.pace !== 'eclair' && (
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
              )}
              <Body dim style={{ fontSize: 13, color: colors.textMute }}>
                {options.pace === 'eclair'
                  ? 'Éclair : chrono de 8 s, relancé à 6 s après chaque offre · 10M réservés par poste restant.'
                  : 'Surenchère minimale 10M · chrono relancé à 12 s après chaque offre · 10M réservés par poste restant.'}
              </Body>
            </Panel>
            <Panel style={{ gap: 18 }}>
              <Title size={22}>Modes de jeu</Title>
              <GameOptions pack={pack} mode={mode} teams={players} value={options} onChange={setOptions} />
            </Panel>
            <Button label="Créer le salon" size="lg" loading={busy} onPress={submit} testID="create-submit" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
