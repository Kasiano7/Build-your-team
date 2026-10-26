import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import type { Character, PackMeta, Purchase } from '@byt/shared';
import { PlayerCard, colors, describeCharacter, fonts, radii } from '@byt/ui';
import { Button } from '@/components/ui';
import { useReduceMotion } from '@/state/settings';

/** Full card with detailed stats, purchase info and an optional "move" action. */
export function CardSheet({
  character,
  pack,
  purchase,
  slotLabel,
  onClose,
  onMove,
}: {
  character: Character | null;
  pack: PackMeta;
  purchase?: Purchase;
  slotLabel?: string;
  onClose: () => void;
  onMove?: () => void;
}) {
  const reduce = useReduceMotion();
  if (!character) return null;
  const d = describeCharacter(pack, character);
  const roleLabel = (id: string) => pack.roles.find((r) => r.id === id)?.label ?? id;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View entering={reduce ? undefined : FadeIn.duration(160)} style={{ flex: 1, backgroundColor: 'rgba(3,5,8,0.82)', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
        <Pressable style={{ position: 'absolute', inset: 0 }} onPress={onClose} accessibilityLabel="Fermer" />
        <Animated.View entering={reduce ? undefined : ZoomIn.springify().damping(16)} style={{ alignItems: 'center', gap: 14, maxWidth: 360, width: '100%' }}>
          <PlayerCard character={character} pack={pack} width={250} />
          <View style={{ width: '100%', backgroundColor: colors.graphite, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 }}>
            <Row k="Poste naturel" v={roleLabel(d.primaryRole)} />
            {d.secondaryRoles.length > 0 && <Row k="Postes secondaires" v={d.secondaryRoles.map(roleLabel).join(', ')} />}
            {slotLabel && <Row k="Emplacement" v={slotLabel} />}
            {character.affiliation && <Row k="Club" v={character.affiliation} />}
            <Row k="Niveau" v={d.tier.label} />
            {purchase && <Row k={purchase.kind === 'auction' ? 'Acheté' : 'Joueur libre'} v={`${purchase.price}M`} />}
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.textMute, marginTop: 4 }}>{pack.dataset.label}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
            {onMove && <Button label="Déplacer" variant="secondary" onPress={onMove} style={{ flex: 1 }} />}
            <Button label="Fermer" onPress={onClose} style={{ flex: 1 }} />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.textDim }}>{k}</Text>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  );
}
