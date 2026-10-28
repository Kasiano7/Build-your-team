-- Game modes: mercato phase, vetoed auctions, steals and trades, and rematch
-- series (several games in the same room, numbered by `round`).

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_status_check
  CHECK (status IN ('lobby','drafting','mercato','voting','finished'));

ALTER TABLE auctions ADD COLUMN IF NOT EXISTS round SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE auctions DROP CONSTRAINT IF EXISTS auctions_status_check;
ALTER TABLE auctions ADD CONSTRAINT auctions_status_check CHECK (status IN ('reveal','sold','unsold','vetoed'));
ALTER TABLE auctions DROP CONSTRAINT IF EXISTS auctions_room_code_no_key;
ALTER TABLE auctions ADD CONSTRAINT auctions_room_round_no_key UNIQUE (room_code, round, no);

ALTER TABLE team_assignments ADD COLUMN IF NOT EXISTS round SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE team_assignments DROP CONSTRAINT IF EXISTS team_assignments_kind_check;
ALTER TABLE team_assignments ADD CONSTRAINT team_assignments_kind_check
  CHECK (kind IN ('auction','free_agent','steal','trade'));
-- A character still belongs to at most one team per game (steals and trades move the row).
ALTER TABLE team_assignments DROP CONSTRAINT IF EXISTS team_assignments_room_code_character_id_key;
ALTER TABLE team_assignments ADD CONSTRAINT team_assignments_room_round_character_key UNIQUE (room_code, round, character_id);

ALTER TABLE votes ADD COLUMN IF NOT EXISTS round SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_room_code_voter_id_key;
ALTER TABLE votes ADD CONSTRAINT votes_room_round_voter_key UNIQUE (room_code, round, voter_id);

ALTER TABLE results ADD COLUMN IF NOT EXISTS round SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE results DROP CONSTRAINT IF EXISTS results_pkey;
ALTER TABLE results ADD PRIMARY KEY (room_code, round);
