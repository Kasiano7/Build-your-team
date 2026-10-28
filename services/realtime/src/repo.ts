/**
 * Persistence of rooms. Each accepted command is written in ONE transaction:
 * the authoritative snapshot, the event log and the normalised rows derived
 * from the events (auctions, bids, team assignments, votes, results).
 * The in-memory state is only replaced once that transaction has committed.
 */
import type { ContentPack, GameEvent, RoomState } from '@byt/shared';
import type { Db, Queryable } from './db';

export interface PersistMeta {
  actorId?: string | null;
  /** Bid id of the accepted bid (client actionId). */
  bidId?: string;
  ipHash?: string | null;
  newParticipant?: { id: string; tokenHash: string };
}

const ts = (ms: number) => new Date(ms).toISOString();

/** JSON with sorted keys, to compare documents regardless of JSONB key order. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export class RoomRepository {
  constructor(private readonly db: Db) {}

  async registerPack(pack: ContentPack): Promise<void> {
    const { characters, ...definition } = pack;
    const existing = await this.db.query<{ content_hash: string | null; definition: unknown }>(
      'SELECT content_hash, definition FROM content_packs WHERE id = $1',
      [pack.id],
    );
    const row = existing.rows[0];
    const storedDefinition = typeof row?.definition === 'string' ? JSON.parse(row.definition) : row?.definition;
    if (row && row.content_hash === (pack.dataset.contentHash ?? null) && stableJson(storedDefinition) === stableJson(definition)) return;
    await this.db.transaction(async (tx) => {
      await tx.query('INSERT INTO universes(id, label) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [
        pack.universeId,
        pack.universeLabel,
      ]);
      await tx.query('DELETE FROM content_packs WHERE id = $1', [pack.id]);
      await tx.query(
        `INSERT INTO content_packs(id, universe_id, dataset_id, dataset_version, dataset_label, fictional, source, license, content_hash, definition)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          pack.id,
          pack.universeId,
          pack.dataset.id,
          pack.dataset.version,
          pack.dataset.label,
          pack.dataset.fictional,
          pack.dataset.source,
          pack.dataset.license,
          pack.dataset.contentHash ?? null,
          JSON.stringify(definition),
        ],
      );
      // Batched insert through jsonb_to_recordset keeps it to a single round trip.
      await tx.query(
        `INSERT INTO characters(pack_id, id, name, short_name, nationality, roles, overall, attributes, portrait_url, portrait_seed, affiliation)
         SELECT $1, x.id, x.name, x."shortName", x.nationality, ARRAY(SELECT jsonb_array_elements_text(x.roles)), x.overall,
                x.attributes, x."portraitUrl", x."portraitSeed", x.affiliation
         FROM jsonb_to_recordset($2::jsonb) AS x(id text, name text, "shortName" text, nationality text, roles jsonb,
              overall int, attributes jsonb, "portraitUrl" text, "portraitSeed" bigint, affiliation text)`,
        [pack.id, JSON.stringify(characters)],
      );
    });
  }

  async loadActiveRooms(): Promise<RoomState[]> {
    const res = await this.db.query<{ state: RoomState | string }>(
      `SELECT state FROM rooms WHERE status IN ('lobby','drafting','mercato','voting') AND updated_at > now() - interval '12 hours'`,
    );
    return res.rows.map((r) => (typeof r.state === 'string' ? JSON.parse(r.state) : r.state));
  }

  async loadRoom(code: string): Promise<RoomState | null> {
    const res = await this.db.query<{ state: RoomState | string }>('SELECT state FROM rooms WHERE code = $1', [code]);
    const row = res.rows[0];
    if (!row) return null;
    return typeof row.state === 'string' ? JSON.parse(row.state) : row.state;
  }

  async loadSessions(code: string): Promise<Map<string, string>> {
    const res = await this.db.query<{ id: string; session_token_hash: string }>(
      'SELECT id, session_token_hash FROM participants WHERE room_code = $1 AND left_at IS NULL',
      [code],
    );
    return new Map(res.rows.map((r) => [r.session_token_hash, r.id]));
  }

  /** Data retention: rooms (and, by cascade, every related row) older than `days` are deleted. */
  async purgeOlderThan(days: number): Promise<number> {
    const res = await this.db.query<{ code: string }>(
      `DELETE FROM rooms WHERE updated_at < now() - make_interval(days => $1::int) RETURNING code`,
      [days],
    );
    return res.rows.length;
  }

  async roomExists(code: string): Promise<boolean> {
    const res = await this.db.query('SELECT 1 FROM rooms WHERE code = $1', [code]);
    return res.rows.length > 0;
  }

  async persist(state: RoomState, events: GameEvent[], meta: PersistMeta = {}): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO rooms(code, pack_id, status, settings, state, version, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (code) DO UPDATE SET status = EXCLUDED.status, settings = EXCLUDED.settings,
           state = EXCLUDED.state, version = EXCLUDED.version, updated_at = EXCLUDED.updated_at`,
        [
          state.code,
          state.settings.packId,
          state.status,
          JSON.stringify(state.settings),
          JSON.stringify(state),
          state.version,
          ts(state.createdAt),
          ts(state.updatedAt),
        ],
      );
      if (meta.newParticipant) {
        // A person: the creator of a team, or (duo) the second member of a team.
        const id = meta.newParticipant.id;
        const p = state.participants.find((x) => x.id === id || x.members?.some((m) => m.id === id))!;
        const nickname = p.members?.find((m) => m.id === id)?.nickname ?? p.nickname;
        await tx.query(
          `INSERT INTO participants(id, room_code, nickname, seat, session_token_hash, is_host, joined_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, state.code, nickname, p.seat, meta.newParticipant.tokenHash, p.isHost && p.id === id, ts(state.updatedAt)],
        );
      }
      for (const e of events) await this.applyEvent(tx, state, e, meta);
    });
  }

  private async applyEvent(tx: Queryable, state: RoomState, e: GameEvent, meta: PersistMeta): Promise<void> {
    /** Game number inside the room (rematch series). */
    const round = state.series?.round ?? 1;
    await tx.query('INSERT INTO game_events(room_code, version, type, actor_id, payload) VALUES ($1,$2,$3,$4,$5)', [
      state.code,
      state.version,
      e.type,
      meta.actorId ?? null,
      JSON.stringify(e),
    ]);
    switch (e.type) {
      case 'participant_left':
        await tx.query('UPDATE participants SET left_at = now() WHERE id = $1', [e.participantId]);
        break;
      case 'game_started':
        await tx.query('UPDATE participants SET is_host = (id = $2) WHERE room_code = $1', [
          state.code,
          state.participants.find((p) => p.isHost)?.id ?? '',
        ]);
        break;
      case 'auction_revealed': {
        await tx.query(
          `INSERT INTO auctions(id, room_code, no, character_id, status, started_at, round) VALUES ($1,$2,$3,$4,'reveal',$5,$6)
           ON CONFLICT (id) DO NOTHING`,
          [e.auctionId, state.code, e.no, e.characterId, ts(state.auction?.startedAt ?? state.updatedAt), round],
        );
        break;
      }
      case 'bid_placed': {
        const bid = state.auction?.bids.find((b) => b.id === meta.bidId) ?? state.auction?.highBid;
        if (bid) {
          await tx.query('INSERT INTO bids(id, auction_id, participant_id, amount, placed_at) VALUES ($1,$2,$3,$4,$5)', [
            bid.id,
            e.auctionId,
            e.participantId,
            e.amount,
            ts(bid.at),
          ]);
        }
        break;
      }
      case 'auction_sold':
        await tx.query(`UPDATE auctions SET status='sold', winner_id=$2, price=$3, closed_at=now() WHERE id=$1`, [
          e.auctionId,
          e.participantId,
          e.amount,
        ]);
        await tx.query(
          `INSERT INTO team_assignments(room_code, participant_id, character_id, price, kind, slot_kind, slot_index, round)
           VALUES ($1,$2,$3,$4,'auction',$5,$6,$7)`,
          [state.code, e.participantId, e.characterId, e.amount, e.slotKind, e.slotIndex, round],
        );
        break;
      case 'auction_unsold':
        await tx.query(`UPDATE auctions SET status='unsold', closed_at=now() WHERE id=$1`, [e.auctionId]);
        break;
      case 'sealed_offer': {
        const bid = state.auction?.bids.find((b) => b.participantId === e.participantId);
        if (bid) {
          await tx.query('INSERT INTO bids(id, auction_id, participant_id, amount, placed_at) VALUES ($1,$2,$3,$4,$5)', [
            bid.id,
            e.auctionId,
            e.participantId,
            bid.amount,
            ts(bid.at),
          ]);
        }
        break;
      }
      case 'auction_vetoed':
        await tx.query(`UPDATE auctions SET status='vetoed', closed_at=now() WHERE id=$1`, [e.auctionId]);
        break;
      case 'joker_steal':
        await tx.query(
          `UPDATE team_assignments SET participant_id=$4, price=$5, kind='steal', assigned_at=now()
           WHERE room_code=$1 AND round=$2 AND character_id=$3`,
          [state.code, round, e.characterId, e.participantId, e.price],
        );
        break;
      case 'trade_resolved': {
        const o = state.mercato?.offers.find((x) => x.id === e.offerId);
        if (!e.accepted || !o) break;
        for (const [characterId, owner] of [[o.give, o.toId], [o.take, o.fromId]] as const) {
          await tx.query(
            `UPDATE team_assignments SET participant_id=$4, kind='trade', assigned_at=now()
             WHERE room_code=$1 AND round=$2 AND character_id=$3`,
            [state.code, round, characterId, owner],
          );
        }
        break;
      }
      case 'player_sold_to_bank':
        await tx.query('DELETE FROM team_assignments WHERE room_code=$1 AND round=$2 AND character_id=$3', [state.code, round, e.characterId]);
        break;
      case 'free_agent_assigned':
        await tx.query(
          `INSERT INTO team_assignments(room_code, participant_id, character_id, price, kind, round) VALUES ($1,$2,$3,$4,'free_agent',$5)`,
          [state.code, e.participantId, e.characterId, e.price, round],
        );
        break;
      case 'vote_cast': {
        const v = state.voting?.votes.find((x) => x.voterId === e.voterId);
        if (v) {
          await tx.query(
            'INSERT INTO votes(room_code, voter_id, voter_kind, target_id, ip_hash, cast_at, round) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [state.code, v.voterId, v.voterKind, v.targetId, meta.ipHash ?? null, ts(v.at), round],
          );
        }
        break;
      }
      case 'game_finished':
        await tx.query(
          'INSERT INTO results(room_code, winner_id, payload, round) VALUES ($1,$2,$3,$4) ON CONFLICT (room_code, round) DO NOTHING',
          [state.code, e.winnerId, JSON.stringify(state.result), round],
        );
        break;
      default:
        break;
    }
  }
}
