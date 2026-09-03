from collections import defaultdict
from datetime import date, datetime, timezone
from hashlib import sha256
import hmac
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased, joinedload, selectinload

from app.api.pagination import PageParams, paginate_select, to_paginated
from app.api.deps import get_current_supporter, get_optional_supporter
from app.db.session import get_db
from app.models.about_content import AboutContent
from app.models.contact_message import ContactMessage
from app.models.article import Article
from app.models.gallery import GalleryItem
from app.models.league import League, Season, SeasonTeam
from app.models.match import (
    DisciplineCase,
    DisciplineSanction,
    FanPlayerMatchVote,
    Match,
    MatchBallEvent,
    MatchDaySquadPlayer,
    MatchPlayerStat,
)
from app.models.merchandise import (
    MerchandiseOrder,
    MerchandiseOrderStatusEvent,
    MerchandiseProduct,
    MerchandiseProductTeam,
    MerchandiseProductVariant,
)
from app.models.player import Player
from app.models.site_page_content import SitePageContent
from app.models.seo_redirect import SeoRedirect
from app.models.sponsor import Sponsor
from app.models.team import Team
from app.models.supporter import SupporterAccount
from app.schemas.about_content import AboutContentBody, AboutContentOut
from app.schemas.contact_message import ContactMessageCreate, ContactMessageOut
from app.schemas.articles import ArticleOut
from app.schemas.gallery import GalleryItemOut
from app.schemas.homepage import (
    HomepageArticleOut,
    HomepageGalleryOut,
    HomepageMatchOut,
    HomepageOut,
    HomepagePlayerOut,
    HomepageSponsorOut,
    HomepageTeamOut,
    NavigationLeagueOut,
    NavigationOut,
    NavigationSeasonOut,
)
from app.schemas.leagues import LeagueDetailPublicOut, LeagueOut
from app.schemas.matches import (
    FanPlayerMatchVoteChoiceOut,
    FanPlayerMatchVoteIn,
    FanPlayerMatchVoteSummaryOut,
    LiveBallEventOut,
    LiveScoreInningsSummaryOut,
    LiveScoreStateOut,
    MatchDetailOut,
    MatchStreamAccessOut,
    MatchSquadOut,
    MatchSquadPlayerOut,
    MatchSquadTeamOut,
    SeasonStandingAdjustmentOut,
)
from app.schemas.merchandise import (
    MerchandiseOrderCreate,
    MerchandiseOrderCreateOut,
    MerchandiseOrderStatusEventOut,
    MerchandiseOrderTrackingOut,
    MerchandiseProductOut,
    MerchandiseProductVariantOut,
)
from app.schemas.players import PlayerMatchAppearanceOut, PlayerOut
from app.schemas.seasons import SeasonPublicOut, SeasonSummaryOut
from app.schemas.site_page_content import SitePageBody, SitePageOut, SitePageSlug
from app.schemas.sponsor import SponsorOut
from app.schemas.teams import TeamOut, TeamSeasonRecordOut
from app.services.dls import dls_g50_for_category, dls_par_score
from app.services.site_pages import default_site_page_body
from app.services.seo_redirects import normalise_public_path

router = APIRouter(prefix="/public", tags=["public"])

FIXTURE_STATUSES = ("scheduled", "live", "postponed")
RESULT_STATUSES = ("completed",)


@router.get("/seo/redirect", response_model=dict)
def resolve_public_seo_redirect(
    path: str = Query(min_length=1, max_length=2048),
    db: Session = Depends(get_db),
) -> dict:
    try:
        source_path = normalise_public_path(path)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "validation", "message": str(exc)},
        ) from exc

    redirect_row = db.scalar(
        select(SeoRedirect).where(
            SeoRedirect.source_path == source_path,
            SeoRedirect.is_active.is_(True),
        ),
    )
    if redirect_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "not_found", "message": "Redirect not found"},
        )
    return {
        "source_path": redirect_row.source_path,
        "target_path": redirect_row.target_path,
        "status_code": 301,
        "updated_at": redirect_row.updated_at,
    }


def _cricket_overs_label(value: object | None) -> str:
    """Format a scorecard's cricket-over value without decimal-ball drift."""
    text = str(value or "0").strip()
    whole, separator, fraction = text.partition(".")
    try:
        overs = int(whole or "0")
    except ValueError:
        overs = 0
    balls = int(fraction[0]) if separator and fraction[:1].isdigit() else 0
    return f"{overs}.{balls}"


def _computed_top_performers(db: Session, match: Match) -> str | None:
    """Build the public performer line directly from the submitted scorecard.

    A result may have been saved before a scorecard correction. Computing this
    from the same player-stat rows displayed on the scorecard prevents the
    summary from becoming stale or showing different balls faced.
    """
    stats = list(match.player_stats or [])
    if not stats:
        return None

    player_ids = {stat.player_id for stat in stats}
    players = db.scalars(select(Player).where(Player.id.in_(player_ids))).all()
    player_names = {player.id: player.full_name for player in players}
    team_names = {
        match.home_team_id: match.home_team.name,
        match.away_team_id: match.away_team.name,
    }

    def player_label(stat: MatchPlayerStat) -> str:
        player_name = player_names.get(stat.player_id, f"Player {stat.player_id}")
        team_name = team_names.get(stat.team_id, f"Team {stat.team_id}")
        return f"{player_name} ({team_name})"

    def overs_balls(stat: MatchPlayerStat) -> int:
        label = _cricket_overs_label(stat.overs)
        overs, _, balls = label.partition(".")
        return int(overs) * 6 + int(balls)

    batters = sorted(
        (stat for stat in stats if stat.runs > 0 or stat.balls_faced > 0),
        key=lambda stat: (
            -stat.runs,
            stat.balls_faced,
            -stat.fours,
            -stat.sixes,
            stat.player_id,
        ),
    )[:3]
    bowlers = sorted(
        (stat for stat in stats if overs_balls(stat) > 0 or stat.wickets > 0),
        key=lambda stat: (
            -stat.wickets,
            stat.runs_conceded,
            -overs_balls(stat),
            stat.player_id,
        ),
    )[:3]

    bowlers_by_player = {stat.player_id: stat for stat in bowlers}
    batter_ids = {stat.player_id for stat in batters}
    entries: list[str] = []

    for batter in batters:
        dismissal = (batter.dismissal or "").strip().lower()
        not_out = dismissal in {"not out", "retired hurt", "retired not out"}
        line = f"{player_label(batter)} {batter.runs}{'*' if not_out else ''} ({batter.balls_faced})"
        if bowler := bowlers_by_player.get(batter.player_id):
            line = f"{line} & {bowler.wickets}/{bowler.runs_conceded} ({_cricket_overs_label(bowler.overs)} overs)"
        entries.append(line)

    for bowler in bowlers:
        if bowler.player_id not in batter_ids:
            entries.append(
                f"{player_label(bowler)} {bowler.wickets}/{bowler.runs_conceded} ({_cricket_overs_label(bowler.overs)} overs)",
            )

    return "; ".join(entries) or None


def _public_match_detail(
    db: Session,
    match: Match,
    *,
    refresh_top_performers: bool = False,
) -> MatchDetailOut:
    detail = MatchDetailOut.model_validate(match)
    public_detail = detail.model_copy(
        update={
            "stream_available": bool(detail.stream_url and detail.stream_url.strip()),
            "stream_url": None,
        },
    )
    if not refresh_top_performers or public_detail.result is None:
        return public_detail

    top_performers = _computed_top_performers(db, match)
    if top_performers is None:
        return public_detail

    return public_detail.model_copy(
        update={
            "result": public_detail.result.model_copy(
                update={"top_performers": top_performers},
            ),
        },
    )


def _match_search_filter(stmt, query: str | None):
    """Filter public fixture/result lists by either participating club."""
    needle = (query or "").strip()
    if not needle:
        return stmt

    home = aliased(Team)
    away = aliased(Team)
    pattern = f"%{needle}%"
    return (
        stmt.join(home, Match.home_team_id == home.id)
        .join(away, Match.away_team_id == away.id)
        .where(
            or_(
                home.name.ilike(pattern),
                away.name.ilike(pattern),
                Match.title.ilike(pattern),
                Match.venue.ilike(pattern),
            ),
        )
    )


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


def _coerce_public_site_page_body(
    slug: SitePageSlug,
    raw: object,
) -> SitePageBody:
    if raw and isinstance(raw, dict):
        try:
            return SitePageBody.model_validate(raw)
        except Exception:
            pass
    return default_site_page_body(slug)


@router.get("/site-pages/{slug}", response_model=SitePageOut)
def get_public_site_page(
    slug: SitePageSlug,
    db: Session = Depends(get_db),
) -> SitePageOut:
    row = db.get(SitePageContent, slug)
    if row is None:
        body = default_site_page_body(slug)
        return SitePageOut(
            slug=slug,
            **body.model_dump(),
            updated_at=datetime.now(timezone.utc),
        )
    body = _coerce_public_site_page_body(slug, row.body)
    return SitePageOut(
        slug=slug,
        **body.model_dump(),
        updated_at=row.updated_at,
    )


@router.get(
    "/seasons/{season_id}/standing-adjustments",
    response_model=list[SeasonStandingAdjustmentOut],
)
def public_season_standing_adjustments(
    season_id: int,
    db: Session = Depends(get_db),
) -> list[SeasonStandingAdjustmentOut]:
    """Public, aggregate-only points adjustments; case evidence stays private."""
    stmt = (
        select(
            DisciplineSanction.team_id,
            func.coalesce(func.sum(DisciplineSanction.points_delta), 0).label("points_delta"),
        )
        .join(DisciplineCase, DisciplineSanction.case_id == DisciplineCase.id)
        .join(Match, DisciplineCase.match_id == Match.id)
        .where(
            Match.season_id == season_id,
            DisciplineSanction.team_id.isnot(None),
            DisciplineSanction.status == "active",
            DisciplineCase.status.in_(("decided", "appealed", "final")),
            DisciplineSanction.points_delta != 0,
        )
        .group_by(DisciplineSanction.team_id)
    )
    return [
        SeasonStandingAdjustmentOut(
            team_id=team_id,
            points_delta=int(points_delta or 0),
            reason="Official points adjustment",
        )
        for team_id, points_delta in db.execute(stmt).all()
        if team_id is not None
    ]


def _published_article_filter(stmt: Select) -> Select:
    now = datetime.now(timezone.utc)
    return stmt.where(Article.status == "published").where(
        or_(Article.published_at.is_(None), Article.published_at <= now),
    )


@router.get("/homepage", response_model=HomepageOut)
def get_homepage(db: Session = Depends(get_db)) -> HomepageOut:
    """One compact, cacheable payload for the public homepage.

    The previous homepage downloaded several paginated admin-shaped resources,
    including complete team/player records and match scorecards. This endpoint
    returns only fields rendered above or near the homepage fold.
    """
    now = datetime.now(timezone.utc)

    news = list(
        db.scalars(
            _published_article_filter(select(Article))
            .order_by(Article.published_at.desc().nullslast(), Article.created_at.desc())
            .limit(5),
        ).all(),
    )
    match_options = (
        joinedload(Match.season).joinedload(Season.league),
        joinedload(Match.result),
    )
    fixtures = list(
        db.scalars(
            select(Match)
            .options(*match_options)
            .where(
                Match.status.in_(FIXTURE_STATUSES),
                Match.is_published.is_(True),
                or_(
                    Match.status != "scheduled",
                    Match.match_date.is_(None),
                    Match.match_date >= date.today(),
                ),
            )
            .order_by(Match.match_date.asc().nullslast(), Match.id)
            .limit(80),
        ).unique().all(),
    )
    results = list(
        db.scalars(
            select(Match)
            .options(*match_options)
            .where(Match.status.in_(RESULT_STATUSES), Match.is_published.is_(True))
            .order_by(Match.match_date.desc().nullslast(), Match.id.desc())
            .limit(80),
        ).unique().all(),
    )

    teams = list(db.scalars(select(Team).order_by(Team.name)).all())
    active_teams = [team for team in teams if team.status == "active"]
    played_team_ids = {
        team_id
        for match in results
        for team_id in (match.home_team_id, match.away_team_id)
    }
    spotlight_candidates = [team for team in active_teams if team.id in played_team_ids] or active_teams
    spotlight_slot = int(now.timestamp() // (15 * 60))
    spotlight_team = (
        spotlight_candidates[spotlight_slot % len(spotlight_candidates)]
        if spotlight_candidates
        else None
    )

    spotlight_player = None
    if spotlight_team is not None:
        player_candidates = list(
            db.scalars(
                select(Player)
                .where(Player.team_id == spotlight_team.id, Player.status == "active")
                .order_by(Player.full_name, Player.id),
            ).all(),
        )
        if player_candidates:
            spotlight_player = player_candidates[spotlight_slot % len(player_candidates)]

    gallery = list(
        db.scalars(
            select(GalleryItem)
            .where(GalleryItem.status == "published")
            .order_by(GalleryItem.created_at.desc())
            .limit(6),
        ).all(),
    )
    sponsor_rows = list(
        db.execute(
            select(Sponsor, Team.name)
            .outerjoin(Team, Sponsor.team_id == Team.id)
            .where(Sponsor.team_id.is_(None))
            .order_by(Sponsor.name, Sponsor.id)
            .limit(24),
        ).all(),
    )

    return HomepageOut(
        generated_at=now,
        news=[HomepageArticleOut.model_validate(row) for row in news],
        fixtures=[HomepageMatchOut.model_validate(row) for row in fixtures],
        results=[HomepageMatchOut.model_validate(row) for row in results],
        teams=[HomepageTeamOut.model_validate(row) for row in teams],
        spotlight_teams=(
            [HomepageTeamOut.model_validate(spotlight_team)] if spotlight_team is not None else []
        ),
        spotlight_players=(
            [HomepagePlayerOut.model_validate(spotlight_player)] if spotlight_player is not None else []
        ),
        spotlight_player_appearances=(
            _public_player_match_appearance_rows(db, spotlight_player.id)[:20]
            if spotlight_player is not None
            else []
        ),
        gallery=[HomepageGalleryOut.model_validate(row) for row in gallery],
        sponsors=[
            HomepageSponsorOut(
                id=sponsor.id,
                name=sponsor.name,
                image_url=sponsor.image_url,
                link_url=sponsor.link_url,
                team_id=sponsor.team_id,
                team_name=team_name,
            )
            for sponsor, team_name in sponsor_rows
        ],
    )


@router.get("/navigation", response_model=NavigationOut)
def get_navigation(db: Session = Depends(get_db)) -> NavigationOut:
    """Compact navigation data used by the shared public-site header."""
    teams = list(
        db.scalars(
            select(Team).where(Team.status == "active").order_by(Team.category, Team.name),
        ).all(),
    )
    leagues = list(db.scalars(select(League).order_by(League.category, League.name)).all())
    seasons = list(
        db.execute(
            select(Season, League.slug, League.category)
            .join(League, Season.league_id == League.id)
            .where(Season.status != "archived")
            .order_by(League.category, Season.start_date.desc().nullslast(), Season.id.desc()),
        ).all(),
    )
    return NavigationOut(
        teams=[HomepageTeamOut.model_validate(team) for team in teams],
        leagues=[NavigationLeagueOut.model_validate(league) for league in leagues],
        seasons=[
            NavigationSeasonOut(
                id=season.id,
                name=season.name,
                slug=season.slug,
                league_slug=league_slug,
                league_category=league_category,
            )
            for season, league_slug, league_category in seasons
        ],
    )


@router.get("/hero-images", response_model=dict)
def get_hero_images(db: Session = Depends(get_db)) -> dict[str, list[str]]:
    """Small fallback-image pool for internal page heroes."""
    gallery_rows = db.execute(
        select(GalleryItem.thumbnail_url, GalleryItem.file_url)
        .where(GalleryItem.status == "published")
        .order_by(GalleryItem.created_at.desc())
        .limit(18),
    ).all()
    article_rows = db.scalars(
        _published_article_filter(select(Article.featured_image_url))
        .order_by(Article.published_at.desc().nullslast(), Article.created_at.desc())
        .limit(18),
    ).all()
    candidates = [thumbnail or file_url for thumbnail, file_url in gallery_rows]
    candidates.extend(article_rows)
    return {"images": list(dict.fromkeys(url for url in candidates if url))}


@router.get("/teams", response_model=dict)
def list_teams(
    db: Session = Depends(get_db),
    page_params: PageParams = Depends(),
    category: str | None = Query(default=None),
    q: str | None = Query(default=None, description="Search name or slug"),
    include_inactive: bool = Query(default=False),
    featured: bool = Query(default=False),
) -> dict:
    stmt = select(Team)
    if featured:
        stmt = stmt.where(Team.is_featured.is_(True), Team.status == "active")
        stmt = stmt.order_by(Team.featured_sort_order.asc().nulls_last(), Team.name)
    else:
        if not include_inactive:
            stmt = stmt.where(Team.status == "active")
        if category:
            stmt = stmt.where(Team.category == category)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(or_(Team.name.ilike(like), Team.slug.ilike(like)))
        stmt = stmt.order_by(Team.name)
    if featured and category:
        stmt = stmt.where(Team.category == category)
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "not_found", "message": "Team not found"},
        )

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
            outcome = getattr(res, "outcome", "win") if res is not None else "no_result"
            wtid = res.winning_team_id if res is not None else None

            if outcome == "no_result":
                no_result += 1
            elif outcome == "tie":
                # Tie is different from No Result.
                # This older team-season record response has no ties field yet,
                # so do not count ties as losses or no results here.
                pass
            elif wtid == team.id:
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
            joinedload(MatchPlayerStat.match).joinedload(Match.result),
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
        pom_id = m.result.player_of_match_player_id if m.result else None
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
                player_of_match=pom_id == player_id,
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
    q: str | None = Query(default=None, max_length=120),
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
        .where(Match.is_published.is_(True))
        # A fixture still marked scheduled after its match date is a data issue,
        # not an upcoming game. Live and postponed matches remain visible.
        .where(
            or_(
                Match.status != "scheduled",
                Match.match_date.is_(None),
                Match.match_date >= date.today(),
            ),
        )
    )
    if season_id is not None:
        stmt = stmt.where(Match.season_id == season_id)
    if league_id is not None:
        stmt = stmt.join(Season, Match.season_id == Season.id).where(Season.league_id == league_id)
    if category:
        stmt = stmt.where(Match.category == category)
    if team_id is not None:
        stmt = stmt.where(or_(Match.home_team_id == team_id, Match.away_team_id == team_id))
    stmt = _match_search_filter(stmt, q)
    stmt = stmt.order_by(Match.match_date.asc().nullslast(), Match.id)
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    items = [_public_match_detail(db, r) for r in rows]
    return to_paginated(items, total, page_params.page, page_params.page_size).model_dump()


@router.get("/results", response_model=dict)
def list_results(
    db: Session = Depends(get_db),
    page_params: PageParams = Depends(),
    season_id: int | None = Query(default=None),
    league_id: int | None = Query(default=None),
    team_id: int | None = Query(default=None),
    category: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=120),
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
        .where(Match.is_published.is_(True))
    )
    if season_id is not None:
        stmt = stmt.where(Match.season_id == season_id)
    if league_id is not None:
        stmt = stmt.join(Season, Match.season_id == Season.id).where(Season.league_id == league_id)
    if category:
        stmt = stmt.where(Match.category == category)
    if team_id is not None:
        stmt = stmt.where(or_(Match.home_team_id == team_id, Match.away_team_id == team_id))
    stmt = _match_search_filter(stmt, q)
    stmt = stmt.order_by(Match.match_date.desc().nullslast(), Match.id.desc())
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    items = [_public_match_detail(db, r) for r in rows]
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
        .where(Match.id == match_id, Match.is_published.is_(True)),
    )
    if m is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Match not found"})
    return _public_match_detail(db, m, refresh_top_performers=True)


@router.get("/matches/{match_id}/stream", response_model=MatchStreamAccessOut)
def get_match_stream(
    match_id: int,
    db: Session = Depends(get_db),
    _supporter: SupporterAccount = Depends(get_current_supporter),
) -> MatchStreamAccessOut:
    match = db.scalar(
        select(Match).where(Match.id == match_id, Match.is_published.is_(True)),
    )
    if match is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Match not found"})
    stream_url = (match.stream_url or "").strip()
    if not stream_url:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "No broadcast is available for this match."},
        )
    return MatchStreamAccessOut(
        match_id=match.id,
        stream_url=stream_url,
        stream_label=(match.stream_label or "").strip() or None,
    )
def _fan_player_vote_candidate_stats(match: Match) -> list[MatchPlayerStat]:
    stats = list(match.player_stats or [])

    if not stats:
        return []

    batting_candidates = [
        stat for stat in stats if stat.runs > 0 or stat.balls_faced > 0
    ] or stats

    top_batters = sorted(
        batting_candidates,
        key=lambda stat: (
            stat.runs,
            stat.fours,
            stat.sixes,
            -(stat.balls_faced or 0),
            -(stat.lineup_order or 0),
        ),
        reverse=True,
    )[:2]

    bowling_candidates = [
        stat
        for stat in stats
        if stat.wickets > 0
        or stat.runs_conceded > 0
        or stat.overs is not None
    ] or stats

    top_bowlers = sorted(
        bowling_candidates,
        key=lambda stat: (
            stat.wickets,
            -(stat.runs_conceded or 0),
            stat.maidens,
            float(stat.overs or 0),
        ),
        reverse=True,
    )

    selected: list[MatchPlayerStat] = []
    selected_player_ids: set[int] = set()

    for stat in top_batters:
        if stat.player_id in selected_player_ids:
            continue
        selected.append(stat)
        selected_player_ids.add(stat.player_id)

    for stat in top_bowlers:
        if len(selected) >= 4:
            break
        if stat.player_id in selected_player_ids:
            continue
        selected.append(stat)
        selected_player_ids.add(stat.player_id)

    return selected[:4]    
def _fan_player_vote_summary(
    match_id: int,
    db: Session,
    supporter_id: int | None = None,
) -> FanPlayerMatchVoteSummaryOut:
    match = db.scalar(
        select(Match)
        .options(
            joinedload(Match.result),
            selectinload(Match.player_stats),
        )
        .where(Match.id == match_id),
    )

    if match is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Match not found"},
        )

    if match.status != "completed" or match.result is None:
        return FanPlayerMatchVoteSummaryOut(
            match_id=match_id,
            eligible=False,
            reason="Fan Player of the Match voting opens after the result is published.",
        )

    if not match.player_stats:
        return FanPlayerMatchVoteSummaryOut(
            match_id=match_id,
            eligible=False,
            reason="Fan Player of the Match voting opens after the scorecard is entered.",
        )

    candidate_stats = _fan_player_vote_candidate_stats(match)
    player_ids = [stat.player_id for stat in candidate_stats]

    players = db.scalars(select(Player).where(Player.id.in_(player_ids))).all()
    player_names = {player.id: player.full_name for player in players}

    vote_rows = db.execute(
        select(FanPlayerMatchVote.player_id, func.count(FanPlayerMatchVote.id))
        .where(FanPlayerMatchVote.match_id == match_id)
        .group_by(FanPlayerMatchVote.player_id),
    ).all()

    vote_counts = {int(player_id): int(count) for player_id, count in vote_rows}
    total_votes = sum(vote_counts.get(player_id, 0) for player_id in player_ids)

    voter_player_id: int | None = None

    if supporter_id is not None:
        existing_vote = db.scalar(
            select(FanPlayerMatchVote).where(
                FanPlayerMatchVote.match_id == match_id,
                FanPlayerMatchVote.supporter_id == supporter_id,
            ),
        )
        if existing_vote is not None:
            voter_player_id = existing_vote.player_id

    choices: list[FanPlayerMatchVoteChoiceOut] = []

    for stat in candidate_stats:
        votes = vote_counts.get(stat.player_id, 0)
        percentage = round((votes / total_votes) * 100, 1) if total_votes else 0

        choices.append(
            FanPlayerMatchVoteChoiceOut(
                player_id=stat.player_id,
                player_name=player_names.get(stat.player_id, f"Player #{stat.player_id}"),
                team_id=stat.team_id,
                votes=votes,
                percentage=percentage,
            ),
        )

    return FanPlayerMatchVoteSummaryOut(
        match_id=match_id,
        eligible=True,
        total_votes=total_votes,
        voter_player_id=voter_player_id,
        choices=choices,
    )


@router.get(
    "/matches/{match_id}/fan-player-vote",
    response_model=FanPlayerMatchVoteSummaryOut,
)
def get_fan_player_vote(
    match_id: int,
    supporter: SupporterAccount | None = Depends(get_optional_supporter),
    db: Session = Depends(get_db),
) -> FanPlayerMatchVoteSummaryOut:
    return _fan_player_vote_summary(match_id, db, supporter.id if supporter else None)


@router.post(
    "/matches/{match_id}/fan-player-vote",
    response_model=FanPlayerMatchVoteSummaryOut,
)
def submit_fan_player_vote(
    match_id: int,
    body: FanPlayerMatchVoteIn,
    supporter: SupporterAccount = Depends(get_current_supporter),
    db: Session = Depends(get_db),
) -> FanPlayerMatchVoteSummaryOut:
    match = db.scalar(
        select(Match)
        .options(
            joinedload(Match.result),
            selectinload(Match.player_stats),
        )
        .where(Match.id == match_id),
    )

    if match is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Match not found"},
        )

    if match.status != "completed" or match.result is None:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "vote_closed",
                "message": "Fan Player of the Match voting opens after the result is published.",
            },
        )

    if not match.player_stats:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "scorecard_required",
                "message": "Fan Player of the Match voting opens after the scorecard is entered.",
            },
        )

    candidate_player_ids = {
        stat.player_id for stat in _fan_player_vote_candidate_stats(match)
    }

    if body.player_id not in candidate_player_ids:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "invalid_player",
                "message": "Selected player is not one of the fan vote candidates for this match.",
            },
        )

    voter_key = f"supporter:{supporter.id}"

    existing_vote = db.scalar(
        select(FanPlayerMatchVote).where(
            FanPlayerMatchVote.match_id == match_id,
            FanPlayerMatchVote.supporter_id == supporter.id,
        ),
    )

    if existing_vote is None:
        try:
            with db.begin_nested():
                db.add(
                    FanPlayerMatchVote(
                        match_id=match_id,
                        player_id=body.player_id,
                        voter_key=voter_key,
                        supporter_id=supporter.id,
                    ),
                )
                db.flush()
        except IntegrityError:
            # A second browser tab may submit the same supporter's vote while
            # the first request is committing. Treat that as a vote change,
            # not a server error or a second ballot.
            existing_vote = db.scalar(
                select(FanPlayerMatchVote).where(
                    FanPlayerMatchVote.match_id == match_id,
                    FanPlayerMatchVote.supporter_id == supporter.id,
                ),
            )
            if existing_vote is None:
                raise
            existing_vote.player_id = body.player_id
            existing_vote.updated_at = datetime.now(timezone.utc)
    else:
        existing_vote.player_id = body.player_id
        existing_vote.updated_at = datetime.now(timezone.utc)

    db.commit()

    return _fan_player_vote_summary(match_id, db, supporter.id)



@router.get("/matches/{match_id}/squads", response_model=MatchSquadOut)
def public_match_squads(match_id: int, db: Session = Depends(get_db)) -> MatchSquadOut:
    match = db.get(Match, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Match not found"})

    rows = list(
        db.scalars(
            select(MatchDaySquadPlayer)
            .where(MatchDaySquadPlayer.match_id == match_id)
            .order_by(
                MatchDaySquadPlayer.team_id,
                MatchDaySquadPlayer.role,
                MatchDaySquadPlayer.lineup_order,
                MatchDaySquadPlayer.player_id,
            )
        ).all(),
    )
    team_ids = [match.home_team_id, match.away_team_id]
    teams: list[MatchSquadTeamOut] = []
    for team_id in team_ids:
        team_rows = [row for row in rows if row.team_id == team_id]
        teams.append(
            MatchSquadTeamOut(
                team_id=team_id,
                players=[MatchSquadPlayerOut.model_validate(row) for row in team_rows],
            ),
        )
    return MatchSquadOut(match_id=match_id, teams=teams)

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
    match_id: int | None = Query(default=None),
    q: str | None = Query(default=None),
) -> dict:
    stmt = select(GalleryItem).where(GalleryItem.status == "published")
    if media_type:
        stmt = stmt.where(GalleryItem.media_type == media_type)
    if team_id is not None:
        stmt = stmt.where(GalleryItem.team_id == team_id)
    if match_id is not None:
        stmt = stmt.where(GalleryItem.match_id == match_id)
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
            link_url=sp.link_url,
            team_id=sp.team_id,
            team_name=tn,
            created_at=sp.created_at,
        )
        for sp, tn in rows
    ]
    return to_paginated(items, total, page_params.page, page_params.page_size).model_dump()

def _public_merchandise_variants(
    db: Session,
    product_ids: list[int],
) -> dict[int, list[MerchandiseProductVariantOut]]:
    variants = list(
        db.scalars(
            select(MerchandiseProductVariant)
            .where(
                MerchandiseProductVariant.product_id.in_(product_ids),
                MerchandiseProductVariant.status == "active",
            )
            .order_by(MerchandiseProductVariant.product_id, MerchandiseProductVariant.sort_order, MerchandiseProductVariant.id)
        ).all()
    ) if product_ids else []
    grouped: dict[int, list[MerchandiseProductVariantOut]] = {product_id: [] for product_id in product_ids}
    for variant in variants:
        grouped[variant.product_id].append(MerchandiseProductVariantOut.model_validate(variant))
    return grouped


@router.get("/merchandise", response_model=dict)
def list_public_merchandise(
    db: Session = Depends(get_db),
    page_params: PageParams = Depends(),
    team_id: int | None = Query(default=None),
    category: str | None = Query(default=None),
    audience: str | None = Query(default=None),
) -> dict:
    stmt = (
        select(MerchandiseProduct)
        .where(MerchandiseProduct.status == "active")
    )

    if team_id is not None:
        # Keep the legacy column fallback while existing databases migrate.
        stmt = stmt.where(
            or_(
                MerchandiseProduct.team_id == team_id,
                MerchandiseProduct.id.in_(
                    select(MerchandiseProductTeam.product_id).where(
                        MerchandiseProductTeam.team_id == team_id,
                    ),
                ),
            ),
        )

    if category:
        stmt = stmt.where(MerchandiseProduct.category == category)

    if audience:
        stmt = stmt.where(MerchandiseProduct.audience == audience)

    stmt = stmt.order_by(MerchandiseProduct.sort_order, MerchandiseProduct.name)

    rows, total = paginate_select(
        db,
        stmt,
        page=page_params.page,
        page_size=page_params.page_size,
    )
    product_ids = [row.id for row in rows]
    product_team_rows = db.execute(
        select(MerchandiseProductTeam.product_id, MerchandiseProductTeam.team_id).where(
            MerchandiseProductTeam.product_id.in_(product_ids),
        ),
    ).all() if product_ids else []
    team_ids_by_product = {product_id: [] for product_id in product_ids}
    for product_id, product_team_id in product_team_rows:
        team_ids_by_product[product_id].append(product_team_id)
    variants_by_product = _public_merchandise_variants(db, product_ids)
    items = [
        MerchandiseProductOut.model_validate(row).model_copy(
            update={
                "team_ids": team_ids_by_product[row.id] or ([row.team_id] if row.team_id is not None else []),
                "variants": variants_by_product.get(row.id, []),
            },
        )
        for row in rows
    ]
    return to_paginated(
        items,
        total,
        page_params.page,
        page_params.page_size,
    ).model_dump()


@router.get("/merchandise/{product_id}", response_model=MerchandiseProductOut)
def get_public_merchandise_product(
    product_id: int,
    db: Session = Depends(get_db),
) -> MerchandiseProductOut:
    product = db.scalar(
        select(MerchandiseProduct).where(
            MerchandiseProduct.id == product_id,
            MerchandiseProduct.status == "active",
        ),
    )
    if product is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Merchandise product not found"})

    team_ids = list(
        db.scalars(
            select(MerchandiseProductTeam.team_id).where(
                MerchandiseProductTeam.product_id == product.id,
            ),
        ).all(),
    )
    return MerchandiseProductOut.model_validate(product).model_copy(
        update={
            "team_ids": team_ids or ([product.team_id] if product.team_id is not None else []),
            "variants": _public_merchandise_variants(db, [product.id]).get(product.id, []),
        },
    )


@router.post(
    "/merchandise/orders",
    response_model=MerchandiseOrderCreateOut,
    status_code=status.HTTP_201_CREATED,
)
def submit_merchandise_order(
    body: MerchandiseOrderCreate,
    supporter: SupporterAccount | None = Depends(get_optional_supporter),
    db: Session = Depends(get_db),
) -> MerchandiseOrderCreateOut:
    product = db.get(MerchandiseProduct, body.product_id)

    if product is None or product.status != "active":
        raise HTTPException(
            status_code=404,
            detail={
                "code": "not_found",
                "message": "Merchandise product not found",
            },
        )

    variant: MerchandiseProductVariant | None = None
    has_active_variants = db.scalar(
        select(func.count())
        .select_from(MerchandiseProductVariant)
        .where(
            MerchandiseProductVariant.product_id == product.id,
            MerchandiseProductVariant.status == "active",
        )
    )
    if has_active_variants and body.variant_id is None:
        raise HTTPException(
            status_code=400,
            detail={"code": "variant_required", "message": "Choose a product option before ordering."},
        )
    if body.variant_id is not None:
        variant = db.scalar(
            select(MerchandiseProductVariant).where(
                MerchandiseProductVariant.id == body.variant_id,
                MerchandiseProductVariant.product_id == product.id,
                MerchandiseProductVariant.status == "active",
            ).with_for_update()
        )
        if variant is None:
            raise HTTPException(
                status_code=400,
                detail={"code": "invalid_variant", "message": "The selected product option is unavailable."},
            )
        if (
            variant.stock_quantity is not None
            and not variant.allow_backorder
            and body.quantity > variant.stock_quantity
        ):
            raise HTTPException(
                status_code=409,
                detail={"code": "insufficient_stock", "message": "There is not enough stock for this option."},
            )

    tracking_token = secrets.token_urlsafe(32)
    order_number = f"NPL-{datetime.now(timezone.utc):%y%m%d}-{secrets.token_hex(3).upper()}"
    order = MerchandiseOrder(
        product_id=product.id,
        supporter_id=supporter.id if supporter else None,
        variant_id=variant.id if variant else None,
        order_number=order_number,
        tracking_token_hash=sha256(tracking_token.encode()).hexdigest(),
        product_name=product.name,
        customer_name=body.customer_name.strip(),
        phone=body.phone.strip(),
        email=body.email.strip() if body.email and body.email.strip() else None,
        size=(variant.size if variant and variant.size else (body.size.strip() if body.size and body.size.strip() else None)),
        quantity=body.quantity,
        notes=body.notes.strip() if body.notes and body.notes.strip() else None,
        status="new",
        fulfilment_method=body.fulfilment_method,
        delivery_address=(body.delivery_address.strip() if body.delivery_address else None),
    )

    db.add(order)
    db.flush()
    db.add(
        MerchandiseOrderStatusEvent(
            order_id=order.id,
            status="new",
            public_message="Your order request has been received.",
        )
    )
    if variant is not None and variant.stock_quantity is not None:
        variant.stock_quantity -= body.quantity
    db.commit()
    db.refresh(order)

    return MerchandiseOrderCreateOut(
        id=order.id,
        order_number=order.order_number,
        tracking_token=tracking_token,
        status=order.status,
        created_at=order.created_at,
    )


@router.get(
    "/merchandise/order-tracking/{order_number}",
    response_model=MerchandiseOrderTrackingOut,
)
def track_merchandise_order(
    order_number: str,
    token: str = Query(min_length=16, max_length=256),
    db: Session = Depends(get_db),
) -> MerchandiseOrderTrackingOut:
    order = db.scalar(select(MerchandiseOrder).where(MerchandiseOrder.order_number == order_number.strip().upper()))
    provided_hash = sha256(token.encode()).hexdigest()
    if order is None or not hmac.compare_digest(order.tracking_token_hash, provided_hash):
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Order tracking details were not found."},
        )
    variant_label = db.scalar(
        select(MerchandiseProductVariant.label).where(MerchandiseProductVariant.id == order.variant_id)
    ) if order.variant_id else None
    timeline = list(
        db.scalars(
            select(MerchandiseOrderStatusEvent)
            .where(MerchandiseOrderStatusEvent.order_id == order.id)
            .order_by(MerchandiseOrderStatusEvent.created_at, MerchandiseOrderStatusEvent.id)
        ).all()
    )
    return MerchandiseOrderTrackingOut(
        order_number=order.order_number,
        product_name=order.product_name,
        variant_label=variant_label,
        quantity=order.quantity,
        status=order.status,
        payment_status=order.payment_status,
        fulfilment_method=order.fulfilment_method,
        fulfilment_notes=order.fulfilment_notes,
        carrier=order.carrier,
        tracking_number=order.tracking_number,
        estimated_ready_at=order.estimated_ready_at,
        created_at=order.created_at,
        updated_at=order.updated_at,
        timeline=[MerchandiseOrderStatusEventOut.model_validate(row) for row in timeline],
    )




@router.post("/contact", response_model=ContactMessageOut, status_code=status.HTTP_201_CREATED)
def submit_contact_message(
    body: ContactMessageCreate,
    db: Session = Depends(get_db),
) -> ContactMessageOut:
    msg = ContactMessage(
        full_name=body.full_name.strip(),
        email=body.email.strip(),
        phone=body.phone.strip() if body.phone and body.phone.strip() else None,
        message=body.message.strip(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return ContactMessageOut.model_validate(msg)


# ---------------------------------------------------------------------------
# Public live score state
# ---------------------------------------------------------------------------

def _public_live_ball_label(event: MatchBallEvent) -> str:
    if event.is_dead_ball and event.wicket_type == "retired_hurt":
        return "RH"
    if event.is_dead_ball and event.wicket_type == "retired_not_out":
        return "RNO"
    if event.is_dead_ball and event.wicket_type == "retired_out":
        return "RO"
    if event.wicket_type:
        return "W"
    if event.extras_type:
        code = event.extras_type.lower().replace("_", " ")
        return f"{event.runs_extras}{code[:2]}"
    return str(event.runs_batter)


def _public_live_overs_label(legal_balls: int) -> str:
    return f"{legal_balls // 6}.{legal_balls % 6}"


def _public_live_event_out(event: MatchBallEvent) -> LiveBallEventOut:
    return LiveBallEventOut.model_validate(event).model_copy(
        update={
            "notes": None,
            "client_event_id": None,
            "created_by_user_id": None,
            "commentary_updated_by_user_id": None,
        },
    )


def _public_live_score_state(db: Session, match: Match) -> LiveScoreStateOut:
    events = list(
        db.scalars(
            select(MatchBallEvent)
            .where(MatchBallEvent.match_id == match.id)
            .order_by(MatchBallEvent.sequence_number, MatchBallEvent.id),
        ).all(),
    )

    summaries: list[LiveScoreInningsSummaryOut] = []
    for innings in sorted({event.innings for event in events}):
        rows = [event for event in events if event.innings == innings]
        runs = sum(event.runs_batter + event.runs_extras + event.penalty_runs_batting for event in rows)
        wickets = sum(1 for event in rows if event.wicket_type and event.wicket_type not in ("retired_hurt", "retired_not_out"))
        legal_balls = sum(1 for event in rows if event.is_legal_delivery)
        last_rows = [
            event
            for event in rows
            if not (
                event.is_dead_ball
                and event.wicket_type in ("retired_hurt", "retired_out", "retired_not_out")
            )
        ][-6:]
        summaries.append(
            LiveScoreInningsSummaryOut(
                innings=innings,
                batting_team_id=rows[-1].batting_team_id,
                bowling_team_id=rows[-1].bowling_team_id,
                runs=runs,
                wickets=wickets,
                legal_balls=legal_balls,
                overs_label=_public_live_overs_label(legal_balls),
                last_six=[_public_live_ball_label(event) for event in last_rows],
                last_event=_public_live_event_out(rows[-1]),
            ),
        )

    first_innings = next((summary for summary in summaries if summary.innings == 1), None)
    second_innings = next((summary for summary in summaries if summary.innings == 2), None)

    return LiveScoreStateOut(
        match_id=match.id,
        status=match.status,
        match_overs=match.match_overs,
        revised_target_runs=match.revised_target_runs,
        dls_par_score=(
            dls_par_score(
                revised_target_runs=match.revised_target_runs,
                allotted_overs=match.match_overs,
                legal_balls=second_innings.legal_balls,
                wickets_lost=second_innings.wickets,
                effective_resource_percentage=match.dls_team2_resource_percentage,
                first_innings_runs=first_innings.runs if first_innings is not None else None,
                team1_resource_percentage=match.dls_team1_resource_percentage,
                g50=dls_g50_for_category(match.category),
            )
            if second_innings is not None
            else None
        ),
        current_innings=summaries[-1].innings if summaries else None,
        summaries=summaries,
        events=[_public_live_event_out(event) for event in events],
    )


@router.get("/matches/{match_id}/live", response_model=LiveScoreStateOut)
def public_live_score_state(match_id: int, db: Session = Depends(get_db)) -> LiveScoreStateOut:
    match = db.scalar(
        select(Match).where(Match.id == match_id, Match.is_published.is_(True)),
    )
    if match is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Match not found"})
    return _public_live_score_state(db, match)
