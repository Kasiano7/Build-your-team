/**
 * Game options chosen at room creation (format, auction style, pace, theme,
 * mystery, jokers, mercato, end mode, Twitch). The server applies them; this
 * screen only explains them and hides themes that cannot fill every team.
 */
import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { themeShortfall } from '@byt/game-engine';
import type { AuctionStyle, ContentPack, EndMode } from '@byt/shared';
import { colors, fonts, radii } from '@byt/ui';
import { Segmented } from '@/components/ui';

export interface GameOptionsValue {
  format: 'solo' | 'duo';
  auctionStyle: AuctionStyle;
  pace: 'normal' | 'eclair';
  themeId: string | null;
  mystery: boolean;
  jokers: boolean;
  mercato: boolean;
  endMode: EndMode;
  twitchChannel: string;
}

export const DEFAULT_OPTIONS: GameOptionsValue = {
  format: 'solo',
  auctionStyle: 'english',
  pace: 'normal',
  themeId: null,
  mystery: false,
  jokers: false,
  mercato: false,
  endMode: 'vote',
  twitchChannel: '',
};

/** Normalised Twitch channel name, or null when empty / invalid. */
export function twitchChannelOf(input: string): string | null {
  const c = input.trim().toLowerCase().replace(/^https?:\/\/(www\.)?twitch\.tv\//, '').replace(/^@/, '');
  return /^[a-z0-9_]{3,25}$/.test(c) ? c : null;
}

/** Largest number of teams (2–4) a theme can fill in this mode, 0 if none. */
export function themeCapacity(pack: ContentPack, modeId: string, themeId: string): number {
  let best = 0;
  for (const n of [2, 3, 4]) if (themeShortfall(pack, modeId, themeId, n).length === 0) best = n;
  return best;
}

function Toggle({ label, sub, on, onChange, testID }: { label: string; sub: string; on: boolean; onChange: (v: boolean) => void; testID?: string }) {
  return (
    <Pressable
      onPress={() => onChange(!on)}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${label} : ${sub}`}
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: on ? 'rgba(43,227,208,0.55)' : 'rgba(255,255,255,0.08)',
        backgroundColor: on ? 'rgba(43,227,208,0.10)' : 'rgba(255,255,255,0.03)',
      }}
    >
      <View style={{ width: 38, height: 22, borderRadius: 11, padding: 2, backgroundColor: on ? colors.accent : 'rgba(255,255,255,0.14)', alignItems: on ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: on ? '#04110F' : colors.textDim }} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 14, color: colors.text }}>{label}</Text>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMute, marginTop: 1 }}>{sub}</Text>
      </View>
    </Pressable>
  );
}

export function GameOptions({
  pack,
  mode,
  teams,
  value,
  onChange,
}: {
  pack: ContentPack;
  mode: 'quick' | 'classic';
  teams: 2 | 3 | 4;
  value: GameOptionsValue;
  onChange: (v: GameOptionsValue) => void;
}) {
  const [streamer, setStreamer] = useState(!!value.twitchChannel);
  const set = <K extends keyof GameOptionsValue>(k: K, v: GameOptionsValue[K]) => onChange({ ...value, [k]: v });
  const themes = (pack.themes ?? []).map((t) => ({ t, cap: themeCapacity(pack, mode, t.id) })).filter((x) => x.cap >= 2);
  const twitchInvalid = value.twitchChannel.trim() !== '' && !twitchChannelOf(value.twitchChannel);

  return (
    <View style={{ gap: 18 }}>
      <Segmented
        label="Type d’enchères"
        value={value.auctionStyle}
        onChange={(v) => set('auctionStyle', v)}
        options={[
          { value: 'english', label: 'Classiques', sub: 'offres montantes' },
          { value: 'dutch', label: 'Hollandaises', sub: 'le prix baisse' },
          { value: 'sealed', label: 'Sous pli', sub: '1 offre secrète' },
        ]}
      />
      <Segmented
        label="Rythme"
        value={value.pace}
        onChange={(v) => set('pace', v)}
        options={[
          { value: 'normal', label: 'Normal' },
          { value: 'eclair', label: 'Éclair', sub: 'chronos 8 s / 6 s' },
        ]}
      />
      <Segmented
        label="Format"
        value={value.format}
        onChange={(v) => set('format', v)}
        options={[
          { value: 'solo', label: 'Solo', sub: '1 joueur par équipe' },
          { value: 'duo', label: 'Duo', sub: `2 joueurs par équipe · ${teams * 2} max` },
        ]}
      />
      <Segmented
        label="Fin de partie"
        value={value.endMode}
        onChange={(v) => set('endMode', v)}
        options={[
          { value: 'vote', label: 'Vote', sub: 'la plus belle équipe' },
          { value: 'vote_sim', label: 'Les deux', sub: 'vote + tournoi bonus' },
          { value: 'sim', label: 'Tournoi', sub: 'matchs simulés' },
        ]}
      />

      {themes.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textDim }}>Draft thématique</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {[{ t: null, cap: 4 }, ...themes].map(({ t, cap }) => {
              const on = (t?.id ?? null) === value.themeId;
              const tooSmall = cap < teams;
              return (
                <Pressable
                  key={t?.id ?? 'none'}
                  onPress={() => set('themeId', t?.id ?? null)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={t ? `${t.label} : ${t.description}` : 'Aucun thème'}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: radii.pill,
                    borderWidth: 1,
                    borderColor: on ? 'rgba(43,227,208,0.55)' : 'rgba(255,255,255,0.10)',
                    backgroundColor: on ? 'rgba(43,227,208,0.14)' : 'transparent',
                    opacity: tooSmall && !on ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontFamily: fonts.display, fontSize: 13, color: on ? colors.accent2 : colors.text }}>
                    {t ? t.label : 'Aucun'}
                    {t && tooSmall ? ` · ${cap} éq. max` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {value.themeId && (
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMute }}>
              {pack.themes?.find((t) => t.id === value.themeId)?.description}
              {(themes.find((x) => x.t.id === value.themeId)?.cap ?? 4) < teams ? ' Trop peu de joueurs pour autant d’équipes : le lancement sera refusé.' : ''}
            </Text>
          )}
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textDim }}>Règles spéciales</Text>
        <Toggle label="Mystère" sub="Notes et stats cachées jusqu’à la vente" on={value.mystery} onChange={(v) => set('mystery', v)} testID="opt-mystery" />
        <Toggle label="Jokers" sub="Veto, moitié prix et vol : un de chaque par équipe" on={value.jokers} onChange={(v) => set('jokers', v)} testID="opt-jokers" />
        <Toggle label="Mercato" sub="90 s d’échanges et de ventes après la draft" on={value.mercato} onChange={(v) => set('mercato', v)} testID="opt-mercato" />
        <Toggle
          label="Streamer"
          sub="Le chat Twitch vote avec !1, !2… (lecture seule, sans compte)"
          on={streamer}
          onChange={(v) => {
            setStreamer(v);
            if (!v) set('twitchChannel', '');
          }}
          testID="opt-twitch"
        />
        {streamer && (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: radii.pill, borderWidth: 1, borderColor: twitchInvalid ? colors.danger : 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 16, height: 48 }}>
              <Text style={{ fontFamily: fonts.bodyMedium, color: colors.textMute, fontSize: 14 }}>twitch.tv/</Text>
              <TextInput
                value={value.twitchChannel}
                onChangeText={(t) => set('twitchChannel', t.slice(0, 60))}
                placeholder="votre_chaine"
                placeholderTextColor={colors.textMute}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Nom de la chaîne Twitch"
                style={[{ flex: 1, color: colors.text, fontFamily: fonts.bodySemi, fontSize: 15 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
                testID="opt-twitch-channel"
              />
            </View>
            {twitchInvalid && <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.danger }}>Nom de chaîne invalide (3 à 25 lettres, chiffres ou _).</Text>}
          </View>
        )}
      </View>
    </View>
  );
}
