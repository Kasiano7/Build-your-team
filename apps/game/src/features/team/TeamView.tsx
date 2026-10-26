/**
 * Interactive team view: pitch + bench + formation picker + card sheet + swaps.
 * Only the owner can move players or change formation; the server validates.
 */
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import type { PackMeta, Participant, RoomView, SlotRef } from '@byt/shared';
import { PlayerCard, colors, fonts, radii } from '@byt/ui';
import { useToast } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { gameClient } from '@/state/game-client';
import { formationOf, targetSlotFor } from '../room/derive';
import { CardSheet } from './CardSheet';
import { TeamPitch } from './TeamPitch';

export function TeamView({ view, pack, participant, editable, showTarget }: { view: RoomView; pack: PackMeta; participant: Participant; editable: boolean; showTarget: boolean }) {
  const toast = useToast();
  const formation = formationOf(pack, participant.team.formationId);
  const mode = pack.modes.find((m) => m.id === view.settings.mode)!;
  const [sheet, setSheet] = useState<SlotRef | null>(null);
  const [moving, setMoving] = useState<SlotRef | null>(null);
  const target = showTarget && view.auction && view.auction.stage !== 'closed' ? targetSlotFor(pack, view, participant) : null;

  const idAt = (s: SlotRef) => (s.kind === 'starter' ? participant.team.starters[s.index] : participant.team.bench[s.index]) ?? null;
  const labelAt = (s: SlotRef) => (s.kind === 'starter' ? formation.slots[s.index]!.label : `Banc ${s.index + 1}`);

  const press = async (s: SlotRef) => {
    if (moving) {
      const from = moving;
      setMoving(null);
      if (from.kind === s.kind && from.index === s.index) return;
      const res = await gameClient.swap(from, s);
      if (!res.ok) toast(errorMessage(res.code), 'error');
      return;
    }
    if (idAt(s)) setSheet(s);
  };

  const changeFormation = async (id: string) => {
    if (id === participant.team.formationId) return;
    const res = await gameClient.formation(id);
    if (!res.ok) toast(errorMessage(res.code), 'error');
  };

  const sheetId = sheet ? idAt(sheet) : null;
  const sheetChar = sheetId ? view.characters[sheetId] ?? null : null;

  return (
    <View style={{ flex: 1 }}>
      {editable && mode.formationChangeAllowed && view.status === 'drafting' && (
        <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: 4 }} accessibilityRole="radiogroup">
          {mode.formationIds.map((f) => {
            const on = f === participant.team.formationId;
            return (
              <Pressable
                key={f}
                onPress={() => changeFormation(f)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: on ? colors.accent : colors.line, backgroundColor: on ? 'rgba(25,227,200,0.1)' : 'transparent' }, Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null]}
              >
                <Text style={{ fontFamily: fonts.display, fontSize: 15, color: on ? colors.accent : colors.textDim }}>{pack.formations.find((x) => x.id === f)!.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {moving && (
        <Text style={{ textAlign: 'center', fontFamily: fonts.bodySemi, color: colors.accent, fontSize: 13, paddingVertical: 4 }}>
          Touchez l’emplacement de destination ({labelAt(moving)} → ?)
        </Text>
      )}
      <View style={{ flex: 1 }}>
        <TeamPitch
          key={participant.id}
          pack={pack}
          formation={formation}
          team={participant.team}
          characters={view.characters}
          targetSlot={target?.kind === 'starter' ? target.index : null}
          selectedSlot={moving?.kind === 'starter' ? moving.index : null}
          onSlotPress={(i) => press({ kind: 'starter', index: i })}
          accent={participant.color}
        />
      </View>
      {participant.team.bench.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', paddingTop: 6 }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 2, color: colors.textMute, alignSelf: 'center' }}>BANC</Text>
          {participant.team.bench.map((id, i) => {
            const c = id ? view.characters[id] : undefined;
            const selected = moving?.kind === 'bench' && moving.index === i;
            const isTarget = target?.kind === 'bench' && target.index === i;
            return (
              <Pressable key={i} onPress={() => press({ kind: 'bench', index: i })} accessibilityLabel={c ? `Banc : ${c.name}` : 'Banc : libre'} style={{ borderRadius: 4, borderWidth: selected ? 2 : 0, borderColor: colors.accent }}>
                {c ? (
                  <PlayerCard character={c} pack={pack} width={52} variant="compact" />
                ) : (
                  <View style={{ width: 52, height: 68, borderRadius: radii.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: isTarget ? colors.accent : colors.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.display, color: isTarget ? colors.accent : colors.textMute, fontSize: 13 }}>REMP</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
      <CardSheet
        character={sheetChar}
        pack={pack}
        purchase={participant.team.purchases.find((p) => p.characterId === sheetId)}
        slotLabel={sheet ? labelAt(sheet) : undefined}
        onClose={() => setSheet(null)}
        onMove={
          editable && view.status === 'drafting'
            ? () => {
                setMoving(sheet);
                setSheet(null);
              }
            : undefined
        }
      />
    </View>
  );
}
