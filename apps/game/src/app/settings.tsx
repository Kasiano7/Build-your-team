import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { colors, fonts, radii } from '@byt/ui';
import { PageHeader } from '@/components/Header';
import { Body, Button, Eyebrow, Field, Panel, Screen, Segmented, Title, useToast } from '@/components/ui';
import { appVariant, canOverrideServer } from '@/lib/config';
import { probeServer, saveServerUrl, useServerSetting } from '@/lib/server-setting';
import { playSound } from '@/lib/sound';
import { updateSettings, useSettings } from '@/state/settings';

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, gap: 12 }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text }}>{label}</Text>
        {hint ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.textMute }}>{hint}</Text> : null}
      </View>
      <View style={{ width: 50, height: 30, borderRadius: 15, padding: 3, backgroundColor: value ? colors.accent : colors.steelHi, alignItems: value ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: value ? colors.accentInk : colors.textDim }} />
      </View>
    </Pressable>
  );
}

/** Test builds only: choose which game server the app talks to (e.g. a PC on the same Wi-Fi). */
function ServerSection() {
  const toast = useToast();
  const { url } = useServerSetting();
  const [value, setValue] = useState(url);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const test = async () => {
    setBusy(true);
    const r = await probeServer(value);
    setBusy(false);
    setStatus(r.ok ? { ok: true, text: `Serveur joignable (base : ${r.db})` } : { ok: false, text: r.reason });
    return r.ok;
  };
  const save = async () => {
    try {
      const saved = await saveServerUrl(value);
      if (saved) setValue(saved);
      toast('Adresse du serveur enregistrée', 'success');
      void test();
    } catch {
      setStatus({ ok: false, text: 'Adresse invalide — ex. 192.168.1.20 ou https://serveur.exemple.com' });
    }
  };
  return (
    <Panel style={{ gap: 12 }}>
      <Eyebrow>Serveur de jeu · {appVariant === 'preview' ? 'version de test' : 'développement'}</Eyebrow>
      <Field
        label="Adresse"
        value={value}
        onChangeText={(t) => {
          setValue(t);
          setStatus(null);
        }}
        placeholder="192.168.1.20 ou https://…"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        hint="Adresse IP du PC qui lance « npm run dev:server » (port 4000 par défaut), sur le même Wi-Fi."
      />
      {status && <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: status.ok ? colors.success : colors.danger }}>{status.text}</Text>}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Tester" variant="secondary" onPress={test} loading={busy} style={{ flex: 1 }} />
        <Button label="Enregistrer" onPress={save} style={{ flex: 1 }} />
      </View>
    </Panel>
  );
}

export default function SettingsScreen() {
  const s = useSettings();
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 18, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 520, gap: 18 }}>
          <PageHeader />
          <Title size={40}>Paramètres</Title>
          <Panel style={{ gap: 16 }}>
            <Toggle label="Couper tous les sons" value={s.muted} onChange={(muted) => updateSettings({ muted })} />
            <Segmented
              label="Volume"
              value={Math.round(s.volume * 4) / 4}
              onChange={(volume) => {
                updateSettings({ volume, muted: volume === 0 ? true : s.muted && volume === 0 });
                setTimeout(() => playSound('bid'), 30);
              }}
              options={[0, 0.25, 0.5, 0.75, 1].map((v) => ({ value: v, label: `${Math.round(v * 100)}%` }))}
            />
            <Segmented
              label="Animations"
              value={s.reduceMotion}
              onChange={(reduceMotion) => updateSettings({ reduceMotion })}
              options={[
                { value: 'system', label: 'Système' },
                { value: 'off', label: 'Complètes' },
                { value: 'on', label: 'Réduites' },
              ]}
            />
            <Toggle label="Vibrations" hint="iOS et Android uniquement" value={s.haptics} onChange={(haptics) => updateSettings({ haptics })} />
          </Panel>
          {canOverrideServer && <ServerSection />}
          <View style={{ padding: 14, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line }}>
            <Body dim style={{ fontSize: 13 }}>
              Les réglages sont enregistrés sur cet appareil. « Système » suit l’option d’accessibilité « Réduire les animations » de votre appareil.
            </Body>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
