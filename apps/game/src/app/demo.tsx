/**
 * Offline interface tour. Clearly labelled: no server, no other players,
 * nothing here pretends to be a connected game. Switches between universes
 * to show that the same engine drives football and basketball.
 */
import { useMemo, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { basketballRealPack } from '@byt/basketball';
import { footballRealPack } from '@byt/football';
import { bestSlotFor, emptyTeam, getFormation, placeCharacter, reformTeam, toPackMeta } from '@byt/game-engine';
import type { Character, ContentPack, Team } from '@byt/shared';
import { PlayerCard, colors, fonts, radii } from '@byt/ui';
import { PageHeader } from '@/components/Header';
import { Body, Button, Eyebrow, Panel, Screen, Segmented, Title } from '@/components/ui';
import { TeamPitch } from '@/features/team/TeamPitch';
import { playSound } from '@/lib/sound';

const PACKS: Record<string, ContentPack> = { football: footballRealPack, basketball: basketballRealPack };

function tierOf(pack: ContentPack, c: Character) {
  return [...pack.tiers].sort((a, b) => b.minOverall - a.minOverall).find((t) => c.overall >= t.minOverall)!;
}

/** Best player of each tier present in the pack, lowest tier first. */
function byTier(pack: ContentPack): Character[] {
  const sorted = [...pack.characters].sort((a, b) => b.overall - a.overall);
  return pack.tiers
    .map((t) => sorted.find((c) => tierOf(pack, c).id === t.id))
    .filter((c): c is Character => !!c);
}

/** Every formation of the pack once, with the bench size of the first mode that uses it. */
function lineups(pack: ContentPack) {
  const seen = new Set<string>();
  return pack.modes
    .flatMap((m) => m.formationIds.map((f) => ({ id: f, bench: m.benchSize, label: m.id === 'quick' && m.formationIds.length === 1 && pack.modes.every((o) => o === m || !o.formationIds.includes(f)) ? 'Rapide' : pack.formations.find((x) => x.id === f)!.label })))
    .filter((o) => !seen.has(o.id) && seen.add(o.id));
}

export default function Demo() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [universe, setUniverse] = useState<'football' | 'basketball'>('football');
  const pack = PACKS[universe]!;
  const meta = useMemo(() => toPackMeta(pack), [pack]);
  const characters = useMemo(() => Object.fromEntries(pack.characters.map((c) => [c.id, c])), [pack]);
  const options = useMemo(() => lineups(pack), [pack]);
  const [formationId, setFormationId] = useState(options[0]!.id);
  const formation = getFormation(pack, formationId);
  const bench = options.find((o) => o.id === formationId)?.bench ?? 0;
  const [team, setTeam] = useState<Team>(() => emptyTeam(getFormation(pack, options[0]!.id), 0));
  const [cursor, setCursor] = useState(0);
  const order = useMemo(() => [...pack.characters].sort((a, b) => (a.id < b.id ? -1 : 1)).filter((_, i) => i % 5 === 0), [pack]);
  const tiers = useMemo(() => byTier(pack), [pack]);

  const changeUniverse = (u: 'football' | 'basketball') => {
    const p = PACKS[u]!;
    const first = lineups(p)[0]!;
    setUniverse(u);
    setFormationId(first.id);
    setTeam(emptyTeam(getFormation(p, first.id), first.bench));
    setCursor(0);
  };

  const changeFormation = (id: string) => {
    const f = getFormation(pack, id);
    const b = options.find((o) => o.id === id)?.bench ?? 0;
    setFormationId(id);
    const reformed = reformTeam(pack, { ...team, bench: Array.from({ length: b }, () => null) }, f);
    setTeam(reformed ?? emptyTeam(f, b));
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
          <Title size={34}>Découvrir l’interface</Title>
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}>
            <Panel style={{ flex: 1.3, gap: 12 }}>
              <Segmented
                label="Univers"
                value={universe}
                onChange={changeUniverse}
                options={[
                  { value: 'football', label: 'Football' },
                  { value: 'basketball', label: 'Basket' },
                ]}
              />
              <Segmented label="Composition" value={formationId} onChange={changeFormation} options={options.map((o) => ({ value: o.id, label: o.label }))} />
              <View style={{ height: wide ? 520 : 420 }}>
                <TeamPitch key={universe} pack={meta} formation={formation} team={team} characters={characters} targetSlot={null} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label="Ajouter un joueur" onPress={addNext} style={{ flex: 1 }} disabled={!team.starters.includes(null)} />
                <Button label="Vider" variant="secondary" onPress={() => setTeam(emptyTeam(formation, bench))} />
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
                    <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textDim }}>{tierOf(pack, c).label}</Text>
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
