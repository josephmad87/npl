from datetime import date, datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.league import Season
    from app.models.team import Team


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    season_id: Mapped[int | None] = mapped_column(ForeignKey("seasons.id", ondelete="SET NULL"), index=True)
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    home_team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="RESTRICT"), index=True)
    away_team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="RESTRICT"), index=True)
    title: Mapped[str | None] = mapped_column(String(255))
    venue: Mapped[str | None] = mapped_column(String(255))
    match_date: Mapped[date | None] = mapped_column(Date, index=True)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    toss_info: Mapped[str | None] = mapped_column(String(512))
    umpires: Mapped[str | None] = mapped_column(String(512))
    status: Mapped[str] = mapped_column(String(32), default="scheduled", nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    cover_image_url: Mapped[str | None] = mapped_column(String(512))

    season: Mapped["Season | None"] = relationship(back_populates="matches")
    home_team: Mapped["Team"] = relationship(foreign_keys=[home_team_id], back_populates="home_matches")
    away_team: Mapped["Team"] = relationship(foreign_keys=[away_team_id], back_populates="away_matches")
    result: Mapped["MatchResult | None"] = relationship(
        back_populates="match",
        uselist=False,
        cascade="all, delete-orphan",
    )
    player_stats: Mapped[list["MatchPlayerStat"]] = relationship(
        "MatchPlayerStat",
        back_populates="match",
        order_by="MatchPlayerStat.lineup_order,MatchPlayerStat.id",
        cascade="all, delete-orphan",
    )

    fan_player_votes: Mapped[list["FanPlayerMatchVote"]] = relationship(
        "FanPlayerMatchVote",
        back_populates="match",
        cascade="all, delete-orphan",
    )


class MatchResult(Base):
    __tablename__ = "match_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"), unique=True, nullable=False)
    winning_team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id", ondelete="SET NULL"))
    batting_first_team_id: Mapped[int | None] = mapped_column(
        ForeignKey("teams.id", ondelete="SET NULL"),
        index=True,
    )
    margin_text: Mapped[str | None] = mapped_column(String(255))
    score_summary: Mapped[str | None] = mapped_column(String(512))
    innings_breakdown: Mapped[str | None] = mapped_column(Text)
    top_performers: Mapped[str | None] = mapped_column(Text)
    player_of_match_player_id: Mapped[int | None] = mapped_column(ForeignKey("players.id", ondelete="SET NULL"))
    outcome: Mapped[str] = mapped_column(String(32), default="win", nullable=False, index=True)
    result_status: Mapped[str] = mapped_column(String(64), default="official", nullable=False)
    match_report: Mapped[str | None] = mapped_column(Text)
    home_allotted_overs: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=Decimal("40.0"), nullable=False,)
    away_allotted_overs: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=Decimal("40.0"), nullable=False,)
    home_extras_wides: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    home_extras_byes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    home_extras_no_balls: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    home_extras_leg_byes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    away_extras_wides: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    away_extras_byes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    away_extras_no_balls: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    away_extras_leg_byes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    match: Mapped["Match"] = relationship(back_populates="result")


class MatchPlayerStat(Base):
    """Per-player batting / bowling / fielding line for a completed (or in-progress) fixture."""

    __tablename__ = "match_player_stats"
    __table_args__ = (
        UniqueConstraint("match_id", "player_id", name="uq_match_player_stats_match_player"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"), index=True, nullable=False)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id", ondelete="RESTRICT"), index=True, nullable=False)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="RESTRICT"), index=True, nullable=False)
    lineup_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    batting_order: Mapped[int | None] = mapped_column(Integer)
    bowling_order: Mapped[int | None] = mapped_column(Integer)
    runs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    balls_faced: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fours: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sixes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    dismissal: Mapped[str | None] = mapped_column(String(128))
    overs: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    maidens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    runs_conceded: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    wickets: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    catches: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    stumpings: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    run_outs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    match: Mapped["Match"] = relationship("Match", back_populates="player_stats")

    class FanPlayerMatchVote(Base):
    __tablename__ = "fan_player_match_votes"
    __table_args__ = (
        UniqueConstraint(
            "match_id",
            "voter_key",
            name="uq_fan_player_match_votes_match_voter",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_id: Mapped[int] = mapped_column(
        ForeignKey("matches.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    player_id: Mapped[int] = mapped_column(
        ForeignKey("players.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    voter_key: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    match: Mapped["Match"] = relationship("Match", back_populates="fan_player_votes")
