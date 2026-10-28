import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { basketballRealPack } from '@byt/basketball';
import { footballRealPack } from '@byt/football';
import { emptyTeam, getFormation, toPackMeta } from '@byt/game-engine';
import type { Character, Team } from '@byt/shared';
import { PlayerCard, colors, fonts, radii } from '@byt/ui';
import { Logo } from '@/components/Logo';
import { Body, Button, Eyebrow, Panel, PlayerBadge, Screen } from '@/components/ui';
import { TeamPitch } from '@/features/team/TeamPitch';
import { appVariant, hasServerConfigured, webServerMissing } from '@/lib/config';
import { useServerSetting } from '@/lib/server-setting';
import { getJSON, keys } from '@/lib/storage';
import { warmUpSounds } from '@/lib/sound';
import { useReduceMotion } from '@/state/settings';

const pack = footballRealPack;
const meta = toPackMeta(pack);
const formation = getFormation(pack, 'quick-5');

/** Showcase line-up for the hero: the best-rated player per slot (estimated ratings). */
function showcase(): { ids: string[]; characters: Record<string, Character>; featured: Character } {
  const best = (roles: string[], skip: string[] = []) =>
    pack.characters.filter((c) => roles.includes(c.roles[0]!) && !skip.includes(c.id)).sort((a, b) => b.overall - a.overall)[0]!;
  const gk = best(['GK']);
  const def = best(['CB', 'LB', 'RB']);
  const mid = best(['CAM', 'CM']);
  const st = best(['LW', 'ST']);
  const rw = best(['RW', 'ST'], [st.id]);
  const featured = best(['RW'], [rw.id]);
  const ids = [gk.id, def.id, mid.id, st.id, rw.id];
  return { ids, featured, characters: Object.fromEntries([gk, def, mid, st, rw].map((c) => [c.id, c])) };
}

function SettingsIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.textDim} strokeWidth={1.8}>
      <Path d="M4 7h10M18 7h2M4 17h4M12 17h8" strokeLinecap="round" />
      <Path d="M16 5v4M10 15v4" strokeLinecap="round" />
    </Svg>
  );
}

/** Glass navigation bar. */
function NavBar({ wide, onSettings, onDemo }: { wide: boolean; onSettings: () => void; onDemo: () => void }) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, height: 64, borderRadius: radii.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', backgroundColor: 'rgba(10,15,21,0.45)' },
      ]}
    >
      <BlurView intensity={24} tint="dark" style={{ position: 'absolute', inset: 0 }} pointerEvents="none" />
      <Logo size={wide ? 1 : 0.85} tagline={wide} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {wide && (
          <Pressable onPress={onDemo} accessibilityRole="link" style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: colors.textDim }}>Découvrir l’interface</Text>
          </Pressable>
        )}
        <Pressable
          onPress={onSettings}
          accessibilityRole="button"
          accessibilityLabel="Paramètres"
          style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' }}
        >
          <SettingsIcon />
        </Pressable>
      </View>
    </View>
  );
}

/** Floating "live" auction vignette over the hero pitch: what a turn looks like, in one glance. */
function LiveAuction({ featured, compact, reduce }: { featured: Character; compact: boolean; reduce: boolean }) {
  const float = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    float.set(withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduce, float]);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -6 + float.value * 12 }, { rotate: '-7deg' }] }));
  const chipStyle = useAnimatedStyle(() => ({ transform: [{ translateY: 4 - float.value * 8 }] }));
  const w = compact ? 118 : 170;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: compact ? 4 : 0, bottom: compact ? 6 : 34 }}>
      <Animated.View style={[{ borderRadius: 14 }, Platform.OS === 'web' ? ({ filter: 'drop-shadow(0 26px 40px rgba(0,0,0,0.55))' } as object) : null, cardStyle]}>
        <PlayerCard character={featured} pack={meta} width={w} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: w * 0.62, top: -14, gap: 8 }, chipStyle]}>
        <BidBubble name="Alice" color="#5AA9FF" amount="+20M" />
        <BidBubble name="Bruno" color="#FFB547" amount="140M" leading />
      </Animated.View>
    </View>
  );
}

function BidBubble({ name, color, amount, leading }: { name: string; color: string; amount: string; leading?: boolean }) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 5, paddingRight: 12, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: 'rgba(14,20,27,0.82)', borderWidth: 1, borderColor: leading ? color : 'rgba(255,255,255,0.12)' },
        Platform.OS === 'web' ? ({ backdropFilter: 'blur(10px)', boxShadow: '0 12px 30px rgba(0,0,0,0.4)' } as object) : null,
      ]}
    >
      <PlayerBadge name={name} color={color} size={24} />
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textDim }}>{name}</Text>
      <Text style={{ fontFamily: fonts.heroBold, fontSize: 13, color: leading ? color : colors.text }}>{amount}</Text>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontFamily: fonts.hero, fontSize: 22, color: colors.text, letterSpacing: -0.4 }}>{value}</Text>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMute }}>{label}</Text>
    </View>
  );
}

function Step({ n, title, text, icon }: { n: string; title: string; text: string; icon: ReactNode }) {
  return (
    <Panel style={{ flex: 1, minWidth: 240, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(43,227,208,0.10)', borderWidth: 1, borderColor: 'rgba(43,227,208,0.25)' }}>{icon}</View>
        <Text style={{ fontFamily: fonts.hero, fontSize: 28, color: 'rgba(255,255,255,0.08)' }}>{n}</Text>
      </View>
      <Text style={{ fontFamily: fonts.heroSemi, fontSize: 17, color: colors.text, letterSpacing: -0.2 }}>{title}</Text>
      <Body dim style={{ fontSize: 14, lineHeight: 21 }}>
        {text}
      </Body>
    </Panel>
  );
}

const icon = (d: string) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    <Path d={d} />
  </Svg>
);

export default function Home() {
  const { width, height } = useWindowDimensions();
  const wide = width >= 980;
  const reduce = useReduceMotion();
  const { ids, characters, featured } = useMemo(() => showcase(), []);
  const [landed, setLanded] = useState(reduce ? ids.length : 0);
  const [lastRoom, setLastRoom] = useState<string | null>(null);
  const server = useServerSetting();
  const testBuild = appVariant !== 'production';
  const missingServer = testBuild && server.ready && !hasServerConfigured();

  useEffect(() => {
    if (reduce) return;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setLanded(i);
      if (i >= ids.length) clearInterval(t);
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
  const pitchHeight = wide ? Math.min(height - 150, 660) : Math.min(width * 1.02, 460);
  const gutter = wide ? 40 : 16;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: gutter, paddingBottom: 40, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 1280, gap: wide ? 28 : 20 }}>
          <View style={{ paddingTop: 14 }}>
            <NavBar wide={wide} onSettings={() => go('/settings')} onDemo={() => go('/demo')} />
          </View>

          {webServerMissing() && (
            <View style={{ padding: 14, paddingHorizontal: 18, borderRadius: radii.lg, borderWidth: 1, borderColor: 'rgba(255,181,71,0.45)', backgroundColor: 'rgba(255,181,71,0.08)', gap: 4 }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.warn }}>Serveur de jeu non configuré</Text>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textDim }}>
                Ce site a été publié sans adresse de serveur temps réel : les parties ne peuvent pas démarrer. Définissez EXPO_PUBLIC_SERVER_URL dans Vercel puis redéployez (voir docs/DEPLOYMENT.md).
              </Text>
            </View>
          )}

          {testBuild && (
            <Pressable
              onPress={() => go('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Configurer le serveur de jeu"
              style={{ padding: 12, paddingHorizontal: 16, borderRadius: radii.pill, borderWidth: 1, borderColor: missingServer ? colors.warn : colors.line, backgroundColor: missingServer ? 'rgba(255,181,71,0.08)' : 'rgba(16,22,29,0.6)' }}
            >
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: missingServer ? colors.warn : colors.textDim }}>
                {missingServer ? 'Version de test : aucun serveur configuré — touchez ici pour saisir l’adresse du serveur.' : `Version de test · serveur ${server.url} · modifier`}
              </Text>
            </Pressable>
          )}

          {/* Hero */}
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 24 : 28, alignItems: wide ? 'center' : 'stretch', minHeight: wide ? pitchHeight : undefined }}>
            <View style={{ flex: wide ? 1 : undefined, maxWidth: wide ? 560 : undefined, gap: 26 }}>
              <View
                style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: 'rgba(43,227,208,0.08)', borderWidth: 1, borderColor: 'rgba(43,227,208,0.22)' }}
              >
                <Svg width={8} height={8}>
                  <Circle cx={4} cy={4} r={4} fill={colors.accent} />
                </Svg>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent2, letterSpacing: 0.4 }}>Jeu d’enchères entre amis · 2 à 4 joueurs</Text>
              </View>
              <Text style={{ fontFamily: fonts.hero, fontSize: wide ? 76 : 46, lineHeight: wide ? 80 : 50, color: colors.text, letterSpacing: wide ? -2.5 : -1.2 }}>
                Bid.{'\n'}Build.{'\n'}
                <Text style={{ color: colors.accent }}>Win.</Text>
              </Text>
              <Body dim style={{ fontSize: wide ? 18 : 16, lineHeight: wide ? 28 : 25, maxWidth: 480 }}>
                Le même budget pour tout le monde. Les stars passent aux enchères une par une, le plus offrant l’emporte et la carte file sur son terrain. À la fin, on vote pour la meilleure équipe.
              </Body>
              <View style={{ flexDirection: wide ? 'row' : 'column', gap: 12 }}>
                <Button label="Créer une partie" size="lg" onPress={() => go('/create')} testID="home-play" style={wide ? { paddingHorizontal: 34 } : undefined} />
                <Button label="Rejoindre avec un code" variant="secondary" size="lg" onPress={() => go('/join')} testID="home-join" style={wide ? { paddingHorizontal: 28 } : undefined} />
              </View>
              {lastRoom && (
                <Pressable onPress={() => router.push(`/room/${lastRoom}`)} accessibilityRole="link" style={{ alignSelf: 'flex-start' }}>
                  <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: colors.accent }}>Reprendre la partie {lastRoom} →</Text>
                </Pressable>
              )}
              <View style={{ flexDirection: 'row', gap: wide ? 40 : 28, paddingTop: 6 }}>
                <Stat value={String(pack.characters.length + basketballRealPack.characters.length)} label="vrais joueurs" />
                <Stat value="2–4" label="joueurs par salon" />
                <Stat value="10 min" label="la partie rapide" />
              </View>
            </View>

            <View style={{ flex: wide ? 1.25 : undefined, height: pitchHeight, minHeight: 320 }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <TeamPitch pack={meta} formation={formation} team={team} characters={characters} targetSlot={landed < ids.length ? landed : null} />
              <LiveAuction featured={featured} compact={!wide} reduce={reduce} />
            </View>
          </View>

          {/* How it works — a real sequence, so the steps are numbered */}
          <View style={{ gap: 16, paddingTop: wide ? 8 : 0 }}>
            <Eyebrow>Comment ça marche</Eyebrow>
            <View style={{ flexDirection: wide ? 'row' : 'column', gap: 14 }}>
              <Step n="01" title="Créez le salon" text="Choisissez le mode et le budget. Un code et un lien d’invitation sont générés, sans compte." icon={icon('M12 5v14M5 12h14')} />
              <Step n="02" title="Enchérissez" text="Une star apparaît, le chrono tourne : +10M, +20M ou passez. La meilleure offre l’emporte." icon={icon('M4 20l7-7M13 4l7 7-3 3-7-7zM9 8l7 7')} />
              <Step n="03" title="Votez" text="Les équipes complètes se font face sur le terrain. Chacun vote pour la meilleure — sauf la sienne." icon={icon('M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 6h3v1a3 3 0 0 1-3 3M7 6H4v1a3 3 0 0 0 3 3')} />
            </View>
          </View>

          <Panel style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'flex-start', gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(43,227,208,0.10)', borderWidth: 1, borderColor: 'rgba(43,227,208,0.25)' }}>
                <Svg width={26} height={26} viewBox="0 0 30 30">
                  <Path d="M15 2a13 13 0 1 0 0.01 0Z" fill="none" stroke={colors.accent} strokeWidth="1.8" />
                  <Path d="M15 9l5 3.6-1.9 5.9h-6.2L10 12.6Z" fill={colors.accent} />
                </Svg>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fonts.heroSemi, fontSize: 16, color: colors.text }}>Football · Basket</Text>
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textDim }}>
                  Foot : 5 ou 11 joueurs · Basket : 5 joueurs + banc. Le même moteur accueillera d’autres univers.
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
              <Pressable onPress={() => go('/demo')} accessibilityRole="link">
                <Text style={{ fontFamily: fonts.bodyBold, color: colors.accent, fontSize: 14 }}>Démo hors ligne</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/privacy')} accessibilityRole="link">
                <Text style={{ fontFamily: fonts.bodySemi, color: colors.textDim, fontSize: 14 }}>Confidentialité</Text>
              </Pressable>
            </View>
          </Panel>

          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMute, textAlign: wide ? 'left' : 'center' }}>
            Joueurs réels : notes estimées par Build Your Team, sans lien avec EA SPORTS FC ni avec les joueurs. Aucun argent réel n’est utilisé.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
