from typing import TYPE_CHECKING

from sqlalchemy import Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.match import Match
    from app.models.player import Player


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    short_name: Mapped[str | None] = mapped_column(String(64))
    logo_url: Mapped[str | None] = mapped_column(String(512))
    cover_image_url: Mapped[str | None] = mapped_column(String(512))
    description: Mapped[str | None] = mapped_column(Text)
    home_ground: Mapped[str | None] = mapped_column(String(255))
    coach: Mapped[str | None] = mapped_column(String(255))
    captain: Mapped[str | None] = mapped_column(String(255))
    year_founded: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False, index=True)
    social_links: Mapped[dict | None] = mapped_column(JSON)

    players: Mapped[list["Player"]] = relationship(back_populates="team")
    home_matches: Mapped[list["Match"]] = relationship(
        "Match",
        foreign_keys="Match.home_team_id",
        back_populates="home_team",
    )
    away_matches: Mapped[list["Match"]] = relationship(
        "Match",
        foreign_keys="Match.away_team_id",
        back_populates="away_team",
    )
