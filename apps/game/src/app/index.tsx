import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { footballRealPack } from '@byt/football';
import { emptyTeam, getFormation, toPackMeta } from '@byt/game-engine';
import type { Character, Team } from '@byt/shared';
import { colors, fonts, radii } from '@byt/ui';
import { Logo } from '@/components/Logo';
import { Body, Button, Eyebrow, Screen } from '@/components/ui';
import { TeamPitch } from '@/features/team/TeamPitch';
import { appVariant, hasServerConfigured } from '@/lib/config';
import { useServerSetting } from '@/lib/server-setting';
import { getJSON, keys } from '@/lib/storage';
import { warmUpSounds } from '@/lib/sound';
import { useReduceMotion } from '@/state/settings';

const pack = footballRealPack;
const meta = toPackMeta(pack);
const formation = getFormation(pack, 'quick-5');

/** Showcase line-up for the hero: the best-rated player per slot (estimated ratings). */
function showcase(): { ids: string[]; characters: Record<string, Character> } {
  const best = (roles: string[], skip: string[] = []) =>
    pack.characters.filter((c) => roles.includes(c.roles[0]!) && !skip.includes(c.id)).sort((a, b) => b.overall - a.overall)[0]!;
  const gk = best(['GK']);
  const def = best(['CB', 'LB', 'RB']);
  const mid = best(['CAM', 'CM']);
  const st = best(['LW', 'ST']);
  const rw = best(['RW', 'ST'], [st.id]);
  const ids = [gk.id, def.id, mid.id, st.id, rw.id];
  return { ids, characters: Object.fromEntries([gk, def, mid, st, rw].map((c) => [c.id, c])) };
}

function SettingsIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.textDim} strokeWidth={1.8}>
      <Path d="M4 7h10M18 7h2M4 17h4M12 17h8" strokeLinecap="round" />
      <Path d="M16 5v4M10 15v4" strokeLinecap="round" />
    </Svg>
  );
}

export default function Home() {
  const { width, height } = useWindowDimensions();
  const wide = width >= 920;
  const reduce = useReduceMotion();
  const { ids, characters } = useMemo(() => showcase(), []);
  const [landed, setLanded] = useState(reduce ? ids.length : 0);
  const [lastRoom, setLastRoom] = useState<string | null>(null);
  const server = useServerSetting();
  const testBuild = appVariant !== 'production';
  const missingServer = testBuild && server.ready && !hasServerConfigured();

  useEffect(() => {
    if (reduce) return;
    const order = [0, 1, 2, 3, 4];
    let i = 0;
    const t = setInterval(() => {
      i++;
      setLanded(i);
      if (i >= order.length) clearInterval(t);
    }, 520);
    return () => clearInterval(t);
  }, [reduce, ids.length]);

  useEffect(() => {
    void getJSON<{ code: string; savedAt: number }>(keys.lastRoom).then((r) => {
      if (r && Date.now() - r.savedAt < 6 * 3600_000) setLastRoom(r.code);
    });
  }, []);

  const team: Team = { ...emptyTeam(formation, 0), starters: formation.slots.map((_, i) => (i < landed ? ids[i]! : null)) };
  const go = (path: '/create' | '/join' | '/demo' | '/settings') => {
    warmUpSounds();
    router.push(path);
  };

  const pitchHeight = wide ? Math.min(height - 120, 640) : Math.min(width * 0.95, 420);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: wide ? 48 : 18, paddingBottom: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18 }}>
          <Logo size={wide ? 1 : 0.8} />
          <Pressable
            onPress={() => go('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Paramètres"
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line }}
          >
            <SettingsIcon />
          </Pressable>
        </View>

        {testBuild && (
          <Pressable
            onPress={() => go('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Configurer le serveur de jeu"
            style={{ marginBottom: 12, padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: missingServer ? colors.warn : colors.line, backgroundColor: missingServer ? 'rgba(255,181,71,0.08)' : 'rgba(16,22,29,0.7)' }}
          >
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: missingServer ? colors.warn : colors.textDim }}>
              {missingServer ? 'Version de test : aucun serveur configuré — touchez ici pour saisir l’adresse du serveur.' : `Version de test · serveur ${server.url} · modifier`}
            </Text>
          </Pressable>
        )}

        <View style={{ flexDirection: wide ? 'row' : 'column-reverse', gap: wide ? 40 : 8, flex: 1, alignItems: wide ? 'center' : 'stretch' }}>
          <View style={{ flex: wide ? 1 : undefined, maxWidth: wide ? 520 : undefined, gap: 22 }}>
            <View style={{ gap: 10 }}>
              <Eyebrow>Jeu d’enchères entre amis · 2 à 4 joueurs</Eyebrow>
              <Text style={{ fontFamily: fonts.displayBlack, fontSize: wide ? 84 : 54, lineHeight: wide ? 80 : 52, color: colors.text, letterSpacing: 0.5 }}>
                BID.{'\n'}BUILD.{'\n'}
                <Text style={{ color: colors.accent }}>WIN.</Text>
              </Text>
              <Body dim style={{ fontSize: 16, maxWidth: 440 }}>
                Le même budget pour tout le monde. Les joueurs passent aux enchères un par un, le plus offrant l’emporte et la carte file sur son terrain. À la fin, on vote pour la meilleure équipe.
              </Body>
            </View>

            <View style={{ gap: 10 }}>
              <Button label="Jouer" size="lg" onPress={() => go('/create')} testID="home-play" />
              <Button label="Rejoindre une partie" variant="secondary" size="lg" onPress={() => go('/join')} testID="home-join" />
              {lastRoom && (
                <Button label={`Reprendre ${lastRoom}`} variant="ghost" onPress={() => router.push(`/room/${lastRoom}`)} />
              )}
            </View>

            <View style={{ gap: 8 }}>
              <Eyebrow color={colors.textDim}>Univers</Eyebrow>
              <View
                accessibilityRole="radio"
                accessibilityState={{ checked: true }}
                accessibilityLabel="Univers Football, sélectionné"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radii.md, borderWidth: 1, borderColor: colors.accent, backgroundColor: 'rgba(25,227,200,0.07)' }}
              >
                <Svg width={30} height={30} viewBox="0 0 30 30">
                  <Path d="M15 2a13 13 0 1 0 0.01 0Z" fill="none" stroke={colors.accent} strokeWidth="1.8" />
                  <Path d="M15 9l5 3.6-1.9 5.9h-6.2L10 12.6Z" fill={colors.accent} />
                </Svg>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text, letterSpacing: 0.6 }}>FOOTBALL</Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.textDim }}>Mode rapide (5 joueurs) · Mode classique (11 + banc)</Text>
                </View>
              </View>
              <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textMute }}>
                Le moteur est prévu pour accueillir d’autres univers ; seul le football est jouable aujourd’hui.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
              <Pressable onPress={() => go('/demo')} accessibilityRole="link">
                <Text style={{ fontFamily: fonts.bodySemi, color: colors.accent, fontSize: 14 }}>Découvrir l’interface (démo hors ligne)</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/privacy')} accessibilityRole="link">
                <Text style={{ fontFamily: fonts.body, color: colors.textDim, fontSize: 13 }}>Confidentialité</Text>
              </Pressable>
            </View>
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.textMute }}>
              Joueurs réels : notes estimées par Build Your Team, sans lien avec EA SPORTS FC ni avec les joueurs. Aucun argent réel n’est utilisé.
            </Text>
          </View>

          <View style={{ flex: wide ? 1.2 : undefined, height: pitchHeight, minHeight: 300 }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <TeamPitch pack={meta} formation={formation} team={team} characters={characters} targetSlot={landed < ids.length ? landed : null} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
