"""Split leagues into long-lived leagues + seasons + season_teams.

Revision ID: 20250418_0002
Revises: 20250418_0001
Create Date: 2026-04-18

"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect, text

revision: str = "20250418_0002"
down_revision: Union[str, None] = "20250418_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    tables = insp.get_table_names()
    if "seasons" in tables:
        return

    op.execute(
        text("""
        CREATE TABLE seasons (
            id SERIAL PRIMARY KEY,
            league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            start_date DATE,
            end_date DATE,
            status VARCHAR(32) NOT NULL DEFAULT 'upcoming',
            CONSTRAINT uq_season_league_slug UNIQUE (league_id, slug)
        );
        CREATE INDEX ix_seasons_league_id ON seasons (league_id);
        CREATE INDEX ix_seasons_slug ON seasons (slug);
        CREATE INDEX ix_seasons_status ON seasons (status);
        """),
    )

    op.execute(
        text("""
        CREATE TABLE season_teams (
            season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
            team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
            PRIMARY KEY (season_id, team_id)
        );
        """),
    )

    op.execute(
        text("""
        INSERT INTO seasons (league_id, name, slug, start_date, end_date, status)
        SELECT
            id,
            COALESCE(NULLIF(TRIM(season_name), ''), name || ' season'),
            'legacy-' || id::text,
            start_date,
            end_date,
            status
        FROM leagues;
        """),
    )

    op.execute(
        text("""
        INSERT INTO season_teams (season_id, team_id)
        SELECT s.id, lt.team_id
        FROM league_teams lt
        INNER JOIN seasons s
            ON s.league_id = lt.league_id
            AND s.slug = 'legacy-' || lt.league_id::text;
        """),
    )

    op.execute(text("ALTER TABLE matches ADD COLUMN season_id INTEGER REFERENCES seasons(id) ON DELETE SET NULL;"))
    op.execute(
        text("""
        UPDATE matches m
        SET season_id = s.id
        FROM seasons s
        WHERE m.league_id IS NOT NULL
          AND s.league_id = m.league_id
          AND s.slug = 'legacy-' || s.league_id::text;
        """),
    )

    op.execute(text("ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_league_id_fkey;"))
    op.execute(text("ALTER TABLE matches DROP COLUMN IF EXISTS league_id;"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_matches_season_id ON matches (season_id);"))

    op.execute(text("DROP TABLE IF EXISTS league_teams;"))

    op.execute(
        text("""
        ALTER TABLE leagues
            DROP COLUMN IF EXISTS season_name,
            DROP COLUMN IF EXISTS start_date,
            DROP COLUMN IF EXISTS end_date,
            DROP COLUMN IF EXISTS status;
        """),
    )


def downgrade() -> None:
    raise NotImplementedError("Downgrade would lose season boundaries; restore from backup instead.")
