-- Build Your Team — initial schema (PostgreSQL 15+ / Supabase / PGlite)
-- Generic by design: universes and content packs describe characters with a
-- free-form attribute map, so a non-football universe needs no schema change.

CREATE TABLE IF NOT EXISTS universes (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_packs (
  id              TEXT PRIMARY KEY,               -- e.g. football:football-demo@1.0.0
  universe_id     TEXT NOT NULL REFERENCES universes(id),
  dataset_id      TEXT NOT NULL,
  dataset_version TEXT NOT NULL,
  dataset_label   TEXT NOT NULL,
  fictional       BOOLEAN NOT NULL,
  source          TEXT NOT NULL,
  license         TEXT NOT NULL,
  content_hash    TEXT,
  definition      JSONB NOT NULL,                 -- roles, groups, attribute sets, tiers, formations (+slots), modes
  loaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dataset_id, dataset_version)
);

CREATE TABLE IF NOT EXISTS characters (
  pack_id        TEXT NOT NULL REFERENCES content_packs(id) ON DELETE CASCADE,
  id             TEXT NOT NULL,
  name           TEXT NOT NULL,
  short_name     TEXT NOT NULL,
  nationality    TEXT NOT NULL,
  roles          TEXT[] NOT NULL,                 -- roles[1] = natural role
  overall        SMALLINT NOT NULL,
  attributes     JSONB NOT NULL,                  -- CharacterAttributes, schema given by the pack
  portrait_url   TEXT,
  portrait_seed  BIGINT NOT NULL,
  affiliation    TEXT,
  PRIMARY KEY (pack_id, id)
);

CREATE TABLE IF NOT EXISTS rooms (
  code          TEXT PRIMARY KEY,
  pack_id       TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('lobby','drafting','voting','finished')),
  settings      JSONB NOT NULL,
  state         JSONB NOT NULL,                   -- authoritative GameSession snapshot
  version       INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rooms_status_idx ON rooms(status);

CREATE TABLE IF NOT EXISTS participants (
  id                  TEXT PRIMARY KEY,
  room_code           TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  nickname            TEXT NOT NULL,
  seat                SMALLINT NOT NULL,
  session_token_hash  TEXT NOT NULL,              -- sha256 of the guest session token
  is_host             BOOLEAN NOT NULL DEFAULT false,
  joined_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at             TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS participants_room_idx ON participants(room_code);

CREATE TABLE IF NOT EXISTS auctions (
  id             TEXT PRIMARY KEY,
  room_code      TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  no             INTEGER NOT NULL,
  character_id   TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('reveal','sold','unsold')),
  winner_id      TEXT,
  price          INTEGER,
  started_at     TIMESTAMPTZ NOT NULL,
  closed_at      TIMESTAMPTZ,
  UNIQUE (room_code, no)
);

CREATE TABLE IF NOT EXISTS bids (
  id              TEXT PRIMARY KEY,               -- client actionId (idempotency key)
  auction_id      TEXT NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  participant_id  TEXT NOT NULL,
  amount          INTEGER NOT NULL CHECK (amount > 0),
  placed_at       TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS bids_auction_idx ON bids(auction_id);

CREATE TABLE IF NOT EXISTS team_assignments (
  id              BIGSERIAL PRIMARY KEY,
  room_code       TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  participant_id  TEXT NOT NULL,
  character_id    TEXT NOT NULL,
  price           INTEGER NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('auction','free_agent')),
  slot_kind       TEXT,
  slot_index      SMALLINT,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_code, character_id)                -- a character belongs to at most one team per game
);

CREATE TABLE IF NOT EXISTS votes (
  id            BIGSERIAL PRIMARY KEY,
  room_code     TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  voter_id      TEXT NOT NULL,
  voter_kind    TEXT NOT NULL CHECK (voter_kind IN ('participant','spectator')),
  target_id     TEXT NOT NULL,
  ip_hash       TEXT,
  cast_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_code, voter_id)                    -- one vote per voter per game
);

CREATE TABLE IF NOT EXISTS results (
  room_code     TEXT PRIMARY KEY REFERENCES rooms(code) ON DELETE CASCADE,
  winner_id     TEXT NOT NULL,
  payload       JSONB NOT NULL,
  finished_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_events (
  id            BIGSERIAL PRIMARY KEY,
  room_code     TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  type          TEXT NOT NULL,
  actor_id      TEXT,
  payload       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_events_room_idx ON game_events(room_code, id);
