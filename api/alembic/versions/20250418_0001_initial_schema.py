"""Initial schema from the model snapshot at migration creation time.

Revision ID: 20250418_0001
Revises:
Create Date: 2025-04-18

Do not import the live application metadata here. Doing so makes this historical
migration change whenever a model changes and breaks new-database upgrades.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20250418_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _initial_metadata() -> sa.MetaData:
    """Return the immutable schema snapshot that revision 0001 introduced."""
    metadata = sa.MetaData()

    sa.Table(
        "users",
        metadata,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255)),
        sa.Column("role", sa.String(64), nullable=False, index=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    sa.Table(
        "leagues",
        metadata,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("description", sa.Text()),
        sa.Column("category", sa.String(32), nullable=False, index=True),
        sa.Column("logo_url", sa.String(512)),
        sa.Column("banner_url", sa.String(512)),
    )
    sa.Table(
        "teams",
        metadata,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("category", sa.String(32), nullable=False, index=True),
        sa.Column("short_name", sa.String(64)),
        sa.Column("logo_url", sa.String(512)),
        sa.Column("cover_image_url", sa.String(512)),
        sa.Column("description", sa.Text()),
        sa.Column("home_ground", sa.String(255)),
        sa.Column("coach", sa.String(255)),
        sa.Column("captain", sa.String(255)),
        sa.Column("year_founded", sa.Integer()),
        sa.Column("status", sa.String(32), nullable=False, index=True),
        sa.Column("social_links", sa.JSON()),
    )
    sa.Table(
        "seasons",
        metadata,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("league_id", sa.ForeignKey("leagues.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False, index=True),
        sa.Column("start_date", sa.Date()),
        sa.Column("end_date", sa.Date()),
        sa.Column("status", sa.String(32), nullable=False, index=True),
        sa.UniqueConstraint("league_id", "slug", name="uq_season_league_slug"),
    )
    sa.Table(
        "season_teams",
        metadata,
        sa.Column("season_id", sa.ForeignKey("seasons.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("team_id", sa.ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True),
    )
    sa.Table(
        "players",
        metadata,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("profile_photo_url", sa.String(512)),
        sa.Column("team_id", sa.ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("category", sa.String(32), nullable=False, index=True),
        sa.Column("date_of_birth", sa.Date()),
        sa.Column("nationality", sa.String(128)),
        sa.Column("role", sa.String(64)),
        sa.Column("batting_style", sa.String(64)),
        sa.Column("bowling_style", sa.String(64)),
        sa.Column("jersey_number", sa.Integer()),
        sa.Column("bio", sa.Text()),
        sa.Column("debut_info", sa.String(512)),
        sa.Column("status", sa.String(32), nullable=False, index=True),
        sa.Column("matches_played", sa.Integer(), nullable=False),
        sa.Column("runs_scored", sa.Integer(), nullable=False),
        sa.Column("batting_average", sa.Float()),
        sa.Column("strike_rate", sa.Float()),
        sa.Column("highest_score", sa.Integer()),
        sa.Column("wickets_taken", sa.Integer(), nullable=False),
        sa.Column("bowling_average", sa.Float()),
        sa.Column("economy_rate", sa.Float()),
        sa.Column("best_bowling", sa.String(64)),
        sa.Column("catches", sa.Integer(), nullable=False),
        sa.Column("stumpings", sa.Integer(), nullable=False),
        sa.Column("player_of_match_awards", sa.Integer(), nullable=False),
    )
    sa.Table(
        "articles",
        metadata,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("slug", sa.String(512), nullable=False, unique=True, index=True),
        sa.Column("excerpt", sa.Text()),
        sa.Column("body", sa.Text()),
        sa.Column("featured_image_url", sa.String(512)),
        sa.Column("author_name", sa.String(255)),
        sa.Column("status", sa.String(32), nullable=False, index=True),
        sa.Column("category", sa.String(128), index=True),
        sa.Column("tags", sa.JSON()),
        sa.Column("seo_title", sa.String(512)),
        sa.Column("seo_description", sa.Text()),
        sa.Column("published_at", sa.DateTime(timezone=True), index=True),
        sa.Column("related_entities", sa.JSON()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    sa.Table(
        "gallery_items",
        metadata,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), unique=True, index=True),
        sa.Column("description", sa.Text()),
        sa.Column("media_type", sa.String(16), nullable=False, index=True),
        sa.Column("file_url", sa.String(1024), nullable=False),
        sa.Column("thumbnail_url", sa.String(1024)),
        sa.Column("uploaded_by_user_id", sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("status", sa.String(32), nullable=False, index=True),
        sa.Column("tags", sa.JSON()),
        sa.Column("related_entities", sa.JSON()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    sa.Table(
        "matches",
        metadata,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("season_id", sa.ForeignKey("seasons.id", ondelete="SET NULL"), index=True),
        sa.Column("category", sa.String(32), nullable=False, index=True),
        sa.Column("home_team_id", sa.ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("away_team_id", sa.ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("title", sa.String(255)),
        sa.Column("venue", sa.String(255)),
        sa.Column("match_date", sa.Date(), index=True),
        sa.Column("start_time", sa.DateTime(timezone=True)),
        sa.Column("toss_info", sa.String(512)),
        sa.Column("umpires", sa.String(512)),
        sa.Column("status", sa.String(32), nullable=False, index=True),
        sa.Column("description", sa.Text()),
        sa.Column("cover_image_url", sa.String(512)),
    )
    sa.Table(
        "match_results",
        metadata,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("match_id", sa.ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("winning_team_id", sa.ForeignKey("teams.id", ondelete="SET NULL")),
        sa.Column("margin_text", sa.String(255)),
        sa.Column("score_summary", sa.String(512)),
        sa.Column("innings_breakdown", sa.Text()),
        sa.Column("top_performers", sa.Text()),
        sa.Column("player_of_match_player_id", sa.ForeignKey("players.id", ondelete="SET NULL")),
        sa.Column("result_status", sa.String(64), nullable=False),
        sa.Column("match_report", sa.Text()),
    )
    sa.Table(
        "match_player_stats",
        metadata,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("match_id", sa.ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("player_id", sa.ForeignKey("players.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("team_id", sa.ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("lineup_order", sa.Integer(), nullable=False),
        sa.Column("runs", sa.Integer(), nullable=False),
        sa.Column("balls_faced", sa.Integer(), nullable=False),
        sa.Column("fours", sa.Integer(), nullable=False),
        sa.Column("sixes", sa.Integer(), nullable=False),
        sa.Column("dismissal", sa.String(128)),
        sa.Column("overs", sa.Numeric(6, 2)),
        sa.Column("maidens", sa.Integer(), nullable=False),
        sa.Column("runs_conceded", sa.Integer(), nullable=False),
        sa.Column("wickets", sa.Integer(), nullable=False),
        sa.Column("catches", sa.Integer(), nullable=False),
        sa.Column("stumpings", sa.Integer(), nullable=False),
        sa.Column("run_outs", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.UniqueConstraint("match_id", "player_id", name="uq_match_player_stats_match_player"),
    )
    sa.Table(
        "platform_settings",
        metadata,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("site_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("default_season", sa.String(120), nullable=False, server_default=""),
        sa.Column("media_cdn_base_url", sa.String(1000), nullable=False, server_default=""),
        sa.Column(
            "feature_flags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "notification_hooks",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    sa.Table(
        "audit_logs",
        metadata,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("actor_user_id", sa.ForeignKey("users.id", ondelete="SET NULL"), index=True),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("entity_type", sa.String(64), nullable=False, index=True),
        sa.Column("entity_id", sa.String(64), nullable=False, index=True),
        sa.Column("summary", sa.Text()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            index=True,
        ),
    )

    return metadata


def upgrade() -> None:
    _initial_metadata().create_all(bind=op.get_bind())


def downgrade() -> None:
    _initial_metadata().drop_all(bind=op.get_bind())
