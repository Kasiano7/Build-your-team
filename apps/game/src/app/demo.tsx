/**
 * Offline interface tour with fictional data. Clearly labelled: no server,
 * no other players, nothing here pretends to be a connected game.
 */
import { useMemo, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { footballRealPack } from '@byt/football';
import { emptyTeam, getFormation, reformTeam, toPackMeta, bestSlotFor, placeCharacter } from '@byt/game-engine';
import type { Character, Team } from '@byt/shared';
import { PlayerCard, colors, fonts, radii } from '@byt/ui';
import { PageHeader } from '@/components/Header';
import { Body, Button, Eyebrow, Panel, Screen, Segmented, Title } from '@/components/ui';
import { TeamPitch } from '@/features/team/TeamPitch';
import { playSound } from '@/lib/sound';

const pack = footballRealPack;
const meta = toPackMeta(pack);
const characters: Record<string, Character> = Object.fromEntries(pack.characters.map((c) => [c.id, c]));

function byTier(): Character[] {
  const sorted = [...pack.characters].sort((a, b) => b.overall - a.overall);
  return pack.tiers
    .map((t) => sorted.find((c) => c.overall >= t.minOverall && !pack.tiers.some((u) => u.minOverall > t.minOverall && c.overall >= u.minOverall)))
    .filter((c): c is Character => !!c)
    .reverse();
}

export default function Demo() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [formationId, setFormationId] = useState('quick-5');
  const formation = getFormation(pack, formationId);
  const [team, setTeam] = useState<Team>(() => emptyTeam(getFormation(pack, 'quick-5'), 0));
  const [cursor, setCursor] = useState(0);
  const order = useMemo(() => [...pack.characters].sort((a, b) => (a.id < b.id ? -1 : 1)).filter((_, i) => i % 7 === 0), []);
  const tiers = useMemo(() => byTier(), []);

  const changeFormation = (id: string) => {
    setFormationId(id);
    const f = getFormation(pack, id);
    const bench = id === 'quick-5' ? 0 : 3;
    const reformed = reformTeam(pack, { ...team, bench: Array.from({ length: bench }, () => null) }, f);
    setTeam(reformed ?? emptyTeam(f, bench));
  };

  const addNext = () => {
    for (let i = 0; i < order.length; i++) {
      const c = order[(cursor + i) % order.length]!;
      if ([...team.starters, ...team.bench].includes(c.id)) continue;
      const slot = bestSlotFor(pack, team, c);
      if (!slot) continue;
      const next: Team = { ...team, starters: [...team.starters], bench: [...team.bench] };
      placeCharacter(next, slot, c.id);
      setTeam(next);
      setCursor((cursor + i + 1) % order.length);
      playSound('sold');
      return;
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 1200, gap: 16 }}>
          <PageHeader />
          <View style={{ padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: 'rgba(255,181,71,0.5)', backgroundColor: 'rgba(255,181,71,0.08)' }}>
            <Text style={{ fontFamily: fonts.bodySemi, color: colors.warn, fontSize: 14 }}>
              Démo hors ligne — aucune connexion, aucun autre joueur. Joueurs réels, notes estimées (non officielles).
            </Text>
          </View>
          <Title size={38}>Découvrir l’interface</Title>
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}>
            <Panel style={{ flex: 1.3, gap: 12 }}>
              <Segmented label="Formation" value={formationId} onChange={changeFormation} options={['quick-5', '4-3-3', '4-4-2', '4-2-3-1'].map((f) => ({ value: f, label: f === 'quick-5' ? 'Rapide' : f }))} />
              <View style={{ height: wide ? 520 : 420 }}>
                <TeamPitch pack={meta} formation={formation} team={team} characters={characters} targetSlot={null} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label="Ajouter un joueur" onPress={addNext} style={{ flex: 1 }} disabled={!team.starters.includes(null)} />
                <Button label="Vider" variant="secondary" onPress={() => setTeam(emptyTeam(formation, formationId === 'quick-5' ? 0 : 3))} />
              </View>
              <Body dim style={{ fontSize: 13 }}>
                Le placement utilise le même algorithme que la partie : poste naturel d’abord, puis postes secondaires, puis poste du même groupe.
              </Body>
            </Panel>
            <Panel style={{ flex: 1, gap: 12 }}>
              <Eyebrow>Niveaux de cartes</Eyebrow>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                {tiers.map((c) => (
                  <View key={c.id} style={{ alignItems: 'center', gap: 6 }}>
                    <PlayerCard character={c} pack={meta} width={wide ? 150 : 140} />
                    <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textDim }}>{pack.tiers.find((t) => c.overall >= t.minOverall && !pack.tiers.some((u) => u.minOverall > t.minOverall && c.overall >= u.minOverall))?.label}</Text>
                  </View>
                ))}
              </View>
            </Panel>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
