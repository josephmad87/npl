from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, JSON, String, Text
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
    home_ground_name: Mapped[str | None] = mapped_column(String(255))
    home_ground_location: Mapped[str | None] = mapped_column(String(255))
    home_ground_image_url: Mapped[str | None] = mapped_column(String(512))
    coach: Mapped[str | None] = mapped_column(String(255))
    coach_image_url: Mapped[str | None] = mapped_column(String(512))
    captain: Mapped[str | None] = mapped_column(String(255))
    captain_player_id: Mapped[int | None] = mapped_column(
        ForeignKey("players.id", ondelete="SET NULL"),
        index=True,
    )
    manager: Mapped[str | None] = mapped_column(String(255))
    manager_image_url: Mapped[str | None] = mapped_column(String(512))
    history: Mapped[str | None] = mapped_column(Text)
    trophies: Mapped[list[str] | None] = mapped_column(JSON)
    team_photo_urls: Mapped[list[str] | None] = mapped_column(JSON)
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
