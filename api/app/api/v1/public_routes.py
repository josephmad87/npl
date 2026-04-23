from collections import defaultdict
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.pagination import PageParams, paginate_select, to_paginated
from app.db.session import get_db
from app.models.about_content import AboutContent
from app.models.article import Article
from app.models.gallery import GalleryItem
from app.models.league import League, Season, SeasonTeam
from app.models.match import Match, MatchPlayerStat
from app.models.player import Player
from app.models.sponsor import Sponsor
from app.models.team import Team
from app.schemas.about_content import AboutContentBody, AboutContentOut
from app.schemas.articles import ArticleOut
from app.schemas.gallery import GalleryItemOut
from app.schemas.leagues import LeagueDetailPublicOut, LeagueOut
from app.schemas.matches import MatchDetailOut
from app.schemas.players import PlayerMatchAppearanceOut, PlayerOut
from app.schemas.seasons import SeasonPublicOut, SeasonSummaryOut
from app.schemas.sponsor import SponsorOut
from app.schemas.teams import TeamOut, TeamSeasonRecordOut

router = APIRouter(prefix="/public", tags=["public"])

FIXTURE_STATUSES = ("scheduled", "live", "postponed")
RESULT_STATUSES = ("completed",)


def _coerce_public_about_body(raw: object) -> AboutContentBody:
    if not raw or not isinstance(raw, dict):
        return AboutContentBody()
    try:
        return AboutContentBody.model_validate(raw)
    except Exception:
        return AboutContentBody()


def _public_about_out(row: AboutContent) -> AboutContentOut:
    body = _coerce_public_about_body(row.body)
    return AboutContentOut(**body.model_dump(), updated_at=row.updated_at)


def _published_article_filter(stmt: Select) -> Select:
    now = datetime.now(timezone.utc)
    return stmt.where(Article.status == "published").where(
        or_(Article.published_at.is_(None), Article.published_at <= now),
    )


@router.get("/teams", response_model=dict)
def list_teams(
    db: Session = Depends(get_db),
    page_params: PageParams = Depends(),
    category: str | None = Query(default=None),
    q: str | None = Query(default=None, description="Search name or slug"),
) -> dict:
    stmt = select(Team).where(Team.status == "active")
    if category:
        stmt = stmt.where(Team.category == category)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Team.name.ilike(like), Team.slug.ilike(like)))
    stmt = stmt.order_by(Team.name)
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    items = [TeamOut.model_validate(r) for r in rows]
    return to_paginated(items, total, page_params.page, page_params.page_size).model_dump()


@router.get("/teams/{slug}", response_model=TeamOut)
def get_team(slug: str, db: Session = Depends(get_db)) -> TeamOut:
    team = db.scalar(select(Team).where(Team.slug == slug, Team.status == "active"))
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "not_found", "message": "Team not found"})
    out = TeamOut.model_validate(team)
    if team.captain_player_id is not None:
        cap = db.get(Player, team.captain_player_id)
        if cap is not None and cap.profile_photo_url:
            out = out.model_copy(update={"captain_profile_photo_url": cap.profile_photo_url})
    return out


@router.get("/teams/{slug}/season-records", response_model=list[TeamSeasonRecordOut])
def team_season_records(slug: str, db: Session = Depends(get_db)) -> list[TeamSeasonRecordOut]:
    """Wins / losses / no-result counts from completed matches, grouped by season."""
    team = db.scalar(select(Team).where(Team.slug == slug, Team.status == "active"))
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "not_found", "message": "Team not found"})
    stmt = (
        select(Match)
        .options(
            joinedload(Match.result),
            joinedload(Match.season).joinedload(Season.league),
        )
        .where(
            Match.status == "completed",
            Match.season_id.isnot(None),
            or_(Match.home_team_id == team.id, Match.away_team_id == team.id),
        )
    )
    matches = db.scalars(stmt).all()
    by_season: dict[int, list[Match]] = defaultdict(list)
    for m in matches:
        if m.season_id is not None:
            by_season[m.season_id].append(m)

    records: list[TeamSeasonRecordOut] = []
    for _sid, ms in by_season.items():
        season = ms[0].season
        if season is None:
            continue
        league = season.league
        if league is None:
            continue
        wins = losses = no_result = 0
        for m in ms:
            res = m.result
            wtid = res.winning_team_id if res is not None else None
            if wtid == team.id:
                wins += 1
            elif wtid is not None:
                losses += 1
            else:
                no_result += 1
        records.append(
            TeamSeasonRecordOut(
                league_id=league.id,
                league_name=league.name,
                league_slug=league.slug,
                season_id=season.id,
                season_name=season.name,
                season_slug=season.slug,
                season_start=season.start_date,
                played=len(ms),
                wins=wins,
                losses=losses,
                no_result=no_result,
            ),
        )

    def sort_key(r: TeamSeasonRecordOut) -> tuple[str, int]:
        start = r.season_start or date.min
        return (r.league_name.lower(), -start.toordinal())

    records.sort(key=sort_key)
    return records


@router.get("/players", response_model=dict)
def list_players(
    db: Session = Depends(get_db),
    page_params: PageParams = Depends(),
    team_id: int | None = Query(default=None),
    category: str | None = Query(default=None),
    role: str | None = Query(default=None),
    q: str | None = Query(default=None),
    include_inactive: bool = Query(default=False),
) -> dict:
    stmt = select(Player)
    if not include_inactive:
        stmt = stmt.where(Player.status == "active")
    if team_id is not None:
        stmt = stmt.where(Player.team_id == team_id)
    if category:
        stmt = stmt.where(Player.category == category)
    if role:
        stmt = stmt.where(Player.role == role)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Player.full_name.ilike(like), Player.slug.ilike(like)))
    stmt = stmt.order_by(Player.full_name)
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    items = [PlayerOut.model_validate(r) for r in rows]
    return to_paginated(items, total, page_params.page, page_params.page_size).model_dump()


@router.get("/players/{slug}", response_model=PlayerOut)
def get_player(slug: str, db: Session = Depends(get_db)) -> PlayerOut:
    player = db.scalar(select(Player).where(Player.slug == slug, Player.status == "active"))
    if player is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Player not found"})
    return PlayerOut.model_validate(player)


def _public_player_match_appearance_rows(db: Session, player_id: int) -> list[PlayerMatchAppearanceOut]:
    stmt = (
        select(MatchPlayerStat)
        .join(Match, MatchPlayerStat.match_id == Match.id)
        .where(MatchPlayerStat.player_id == player_id)
        .options(
            joinedload(MatchPlayerStat.match).joinedload(Match.season).joinedload(Season.league),
            joinedload(MatchPlayerStat.match).joinedload(Match.home_team),
            joinedload(MatchPlayerStat.match).joinedload(Match.away_team),
        )
        .order_by(Match.match_date.desc().nullslast(), Match.id.desc())
    )
    rows = db.scalars(stmt).unique().all()
    out: list[PlayerMatchAppearanceOut] = []
    for st in rows:
        m = st.match
        ht = m.home_team.name if m.home_team else f"#{m.home_team_id}"
        at = m.away_team.name if m.away_team else f"#{m.away_team_id}"
        lg = None
        sn = None
        if m.season is not None:
            sn = m.season.name
            if m.season.league is not None:
                lg = m.season.league.name
        ov = float(st.overs) if st.overs is not None else None
        out.append(
            PlayerMatchAppearanceOut(
                stat_id=st.id,
                match_id=m.id,
                match_date=m.match_date,
                venue=m.venue,
                status=m.status,
                home_team_id=m.home_team_id,
                away_team_id=m.away_team_id,
                home_team_name=ht,
                away_team_name=at,
                league_name=lg,
                season_name=sn,
                season_id=m.season_id,
                side_team_id=st.team_id,
                runs=st.runs,
                balls_faced=st.balls_faced,
                fours=st.fours,
                sixes=st.sixes,
                dismissal=st.dismissal,
                overs=ov,
                maidens=st.maidens,
                runs_conceded=st.runs_conceded,
                wickets=st.wickets,
                catches=st.catches,
                stumpings=st.stumpings,
                run_outs=st.run_outs,
                notes=st.notes,
            ),
        )
    return out


@router.get("/players/{slug}/match-appearances", response_model=list[PlayerMatchAppearanceOut])
def public_player_match_appearances(slug: str, db: Session = Depends(get_db)) -> list[PlayerMatchAppearanceOut]:
    player = db.scalar(select(Player).where(Player.slug == slug, Player.status == "active"))
    if player is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Player not found"})
    return _public_player_match_appearance_rows(db, player.id)


def _season_team_ids(db: Session, season_id: int) -> list[int]:
    rows = db.scalars(select(SeasonTeam.team_id).where(SeasonTeam.season_id == season_id)).all()
    return list(rows)


@router.get("/leagues", response_model=dict)
def list_leagues(
    db: Session = Depends(get_db),
    page_params: PageParams = Depends(),
    category: str | None = Query(default=None),
    q: str | None = Query(default=None),
) -> dict:
    stmt = select(League)
    if category:
        stmt = stmt.where(League.category == category)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(League.name.ilike(like), League.slug.ilike(like)))
    stmt = stmt.order_by(League.name)
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    items = [LeagueOut.model_validate(r) for r in rows]
    return to_paginated(items, total, page_params.page, page_params.page_size).model_dump()


@router.get("/leagues/{slug}", response_model=LeagueDetailPublicOut)
def get_league(slug: str, db: Session = Depends(get_db)) -> LeagueDetailPublicOut:
    league = db.scalar(select(League).where(League.slug == slug))
    if league is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "League not found"})
    season_rows = db.scalars(
        select(Season)
        .where(Season.league_id == league.id, Season.status != "archived")
        .order_by(Season.start_date.desc().nullslast(), Season.id.desc()),
    ).all()
    seasons = [SeasonSummaryOut.model_validate(s) for s in season_rows]
    base = LeagueOut.model_validate(league).model_dump()
    return LeagueDetailPublicOut.model_validate({**base, "seasons": seasons})


@router.get("/leagues/{league_slug}/seasons", response_model=dict)
def list_seasons_for_league(
    league_slug: str,
    db: Session = Depends(get_db),
    page_params: PageParams = Depends(),
) -> dict:
    league = db.scalar(select(League).where(League.slug == league_slug))
    if league is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "League not found"})
    stmt = (
        select(Season)
        .where(Season.league_id == league.id, Season.status != "archived")
        .order_by(Season.start_date.desc().nullslast(), Season.id.desc())
    )
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    items = [SeasonSummaryOut.model_validate(r) for r in rows]
    return to_paginated(items, total, page_params.page, page_params.page_size).model_dump()


@router.get("/leagues/{league_slug}/seasons/{season_slug}", response_model=SeasonPublicOut)
def get_season(league_slug: str, season_slug: str, db: Session = Depends(get_db)) -> SeasonPublicOut:
    league = db.scalar(select(League).where(League.slug == league_slug))
    if league is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "League not found"})
    season = db.scalar(
        select(Season).where(
            Season.league_id == league.id,
            Season.slug == season_slug,
            Season.status != "archived",
        ),
    )
    if season is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Season not found"})
    base = SeasonSummaryOut.model_validate(season).model_dump()
    return SeasonPublicOut.model_validate({**base, "team_ids": _season_team_ids(db, season.id)})


@router.get("/fixtures", response_model=dict)
def list_fixtures(
    db: Session = Depends(get_db),
    page_params: PageParams = Depends(),
    season_id: int | None = Query(default=None),
    league_id: int | None = Query(default=None),
    team_id: int | None = Query(default=None),
    category: str | None = Query(default=None),
) -> dict:
    stmt = (
        select(Match)
        .options(
            joinedload(Match.home_team),
            joinedload(Match.away_team),
            joinedload(Match.season).joinedload(Season.league),
            joinedload(Match.result),
            selectinload(Match.player_stats),
        )
        .where(Match.status.in_(FIXTURE_STATUSES))
    )
    if season_id is not None:
        stmt = stmt.where(Match.season_id == season_id)
    if league_id is not None:
        stmt = stmt.join(Season, Match.season_id == Season.id).where(Season.league_id == league_id)
    if category:
        stmt = stmt.where(Match.category == category)
    if team_id is not None:
        stmt = stmt.where(or_(Match.home_team_id == team_id, Match.away_team_id == team_id))
    stmt = stmt.order_by(Match.match_date.asc().nullslast(), Match.id)
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    items = [MatchDetailOut.model_validate(r) for r in rows]
    return to_paginated(items, total, page_params.page, page_params.page_size).model_dump()


@router.get("/results", response_model=dict)
def list_results(
    db: Session = Depends(get_db),
    page_params: PageParams = Depends(),
    season_id: int | None = Query(default=None),
    league_id: int | None = Query(default=None),
    team_id: int | None = Query(default=None),
    category: str | None = Query(default=None),
) -> dict:
    stmt = (
        select(Match)
        .options(
            joinedload(Match.home_team),
            joinedload(Match.away_team),
            joinedload(Match.season).joinedload(Season.league),
            joinedload(Match.result),
            selectinload(Match.player_stats),
        )
        .where(Match.status.in_(RESULT_STATUSES))
    )
    if season_id is not None:
        stmt = stmt.where(Match.season_id == season_id)
    if league_id is not None:
        stmt = stmt.join(Season, Match.season_id == Season.id).where(Season.league_id == league_id)
    if category:
        stmt = stmt.where(Match.category == category)
    if team_id is not None:
        stmt = stmt.where(or_(Match.home_team_id == team_id, Match.away_team_id == team_id))
    stmt = stmt.order_by(Match.match_date.desc().nullslast(), Match.id.desc())
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    items = [MatchDetailOut.model_validate(r) for r in rows]
    return to_paginated(items, total, page_params.page, page_params.page_size).model_dump()


@router.get("/matches/{match_id}", response_model=MatchDetailOut)
def get_match(match_id: int, db: Session = Depends(get_db)) -> MatchDetailOut:
    m = db.scalar(
        select(Match)
        .options(
            joinedload(Match.home_team),
            joinedload(Match.away_team),
            joinedload(Match.season).joinedload(Season.league),
            joinedload(Match.result),
            selectinload(Match.player_stats),
        )
        .where(Match.id == match_id),
    )
    if m is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Match not found"})
    return MatchDetailOut.model_validate(m)


@router.get("/news", response_model=dict)
def list_news(
    db: Session = Depends(get_db),
    page_params: PageParams = Depends(),
    category: str | None = Query(default=None),
    q: str | None = Query(default=None),
) -> dict:
    stmt = select(Article)
    stmt = _published_article_filter(stmt)
    if category:
        stmt = stmt.where(Article.category == category)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Article.title.ilike(like), Article.slug.ilike(like), Article.excerpt.ilike(like)))
    stmt = stmt.order_by(Article.published_at.desc().nullslast(), Article.created_at.desc())
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    items = [ArticleOut.model_validate(r) for r in rows]
    return to_paginated(items, total, page_params.page, page_params.page_size).model_dump()


@router.get("/news/{slug}", response_model=ArticleOut)
def get_news(slug: str, db: Session = Depends(get_db)) -> ArticleOut:
    stmt = select(Article).where(Article.slug == slug)
    stmt = _published_article_filter(stmt)
    article = db.scalar(stmt)
    if article is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Article not found"})
    return ArticleOut.model_validate(article)


@router.get("/gallery", response_model=dict)
def list_gallery(
    db: Session = Depends(get_db),
    page_params: PageParams = Depends(),
    media_type: str | None = Query(default=None),
    team_id: int | None = Query(default=None),
    q: str | None = Query(default=None),
) -> dict:
    stmt = select(GalleryItem).where(GalleryItem.status == "published")
    if media_type:
        stmt = stmt.where(GalleryItem.media_type == media_type)
    if team_id is not None:
        stmt = stmt.where(GalleryItem.team_id == team_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                GalleryItem.title.ilike(like),
                GalleryItem.description.ilike(like),
                GalleryItem.slug.ilike(like),
            ),
        )
    stmt = stmt.order_by(GalleryItem.created_at.desc())
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    items = [GalleryItemOut.model_validate(r) for r in rows]
    return to_paginated(items, total, page_params.page, page_params.page_size).model_dump()


@router.get("/about", response_model=AboutContentOut)
def get_public_about(db: Session = Depends(get_db)) -> AboutContentOut:
    """Singleton about copy for the public site (same payload shape as admin GET /admin/about)."""
    row = db.get(AboutContent, 1)
    if row is None:
        return AboutContentOut(updated_at=datetime.now(timezone.utc))
    return _public_about_out(row)


@router.get("/sponsors", response_model=dict)
def list_public_sponsors(
    db: Session = Depends(get_db),
    page_params: PageParams = Depends(),
) -> dict:
    """Sponsor logos and names for the public About page and footers."""
    count_raw = db.scalar(select(func.count()).select_from(Sponsor))
    total = int(count_raw) if count_raw is not None else 0
    offset = (page_params.page - 1) * page_params.page_size
    stmt = (
        select(Sponsor, Team.name)
        .outerjoin(Team, Sponsor.team_id == Team.id)
        .order_by(Sponsor.name, Sponsor.id)
        .offset(offset)
        .limit(page_params.page_size)
    )
    rows = list(db.execute(stmt).all())
    items = [
        SponsorOut(
            id=sp.id,
            name=sp.name,
            image_url=sp.image_url,
            team_id=sp.team_id,
            team_name=tn,
            created_at=sp.created_at,
        )
        for sp, tn in rows
    ]
    return to_paginated(items, total, page_params.page, page_params.page_size).model_dump()
