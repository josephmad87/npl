from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.team import Team


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    profile_photo_url: Mapped[str | None] = mapped_column(String(512))
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    nationality: Mapped[str | None] = mapped_column(String(128))
    role: Mapped[str | None] = mapped_column(String(64))
    batting_style: Mapped[str | None] = mapped_column(String(64))
    bowling_style: Mapped[str | None] = mapped_column(String(64))
    jersey_number: Mapped[int | None] = mapped_column(Integer)
    bio: Mapped[str | None] = mapped_column(Text)
    debut_info: Mapped[str | None] = mapped_column(String(512))
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False, index=True)
    matches_played: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    runs_scored: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    batting_average: Mapped[float | None] = mapped_column(Float)
    strike_rate: Mapped[float | None] = mapped_column(Float)
    highest_score: Mapped[int | None] = mapped_column(Integer)
    wickets_taken: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bowling_average: Mapped[float | None] = mapped_column(Float)
    economy_rate: Mapped[float | None] = mapped_column(Float)
    best_bowling: Mapped[str | None] = mapped_column(String(64))
    catches: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    stumpings: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    player_of_match_awards: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Team.captain_player_id also points at players.id — restrict this link to the squad FK.
    team: Mapped["Team"] = relationship(back_populates="players", foreign_keys=[team_id])
