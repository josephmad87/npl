from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.match import Match


class League(Base):
    """Long-lived competition (e.g. NPL Premier). Seasons attach separately."""

    __tablename__ = "leagues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    logo_url: Mapped[str | None] = mapped_column(String(512))
    banner_url: Mapped[str | None] = mapped_column(String(512))

    seasons: Mapped[list["Season"]] = relationship(
        back_populates="league",
        cascade="all, delete-orphan",
    )


class Season(Base):
    """One campaign year / window under a league (teams and fixtures are per season)."""

    __tablename__ = "seasons"
    __table_args__ = (UniqueConstraint("league_id", "slug", name="uq_season_league_slug"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    league_id: Mapped[int] = mapped_column(ForeignKey("leagues.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(32), default="upcoming", nullable=False, index=True)

    league: Mapped["League"] = relationship(back_populates="seasons")
    matches: Mapped[list["Match"]] = relationship(back_populates="season")
    season_teams: Mapped[list["SeasonTeam"]] = relationship(
        back_populates="season",
        cascade="all, delete-orphan",
    )


class SeasonTeam(Base):
    __tablename__ = "season_teams"

    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id", ondelete="CASCADE"), primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True)

    season: Mapped["Season"] = relationship(back_populates="season_teams")
