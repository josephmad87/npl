from datetime import datetime, timezone
from math import ceil

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import (
    require_admin_reader,
    require_admin_writer,
    require_competition_writer,
    require_content_writer,
    require_super_admin,
)
from app.api.pagination import PageParams, paginate_select, to_paginated
from app.core.security import hash_password
from app.db.session import get_db
from app.models.article import Article
from app.models.audit import AuditLog
from app.models.gallery import GalleryItem
from app.models.league import League, Season, SeasonTeam
from app.models.match import Match, MatchPlayerStat, MatchResult
from app.models.platform_settings import PlatformSettings
from app.models.player import Player
from app.models.team import Team
from app.models.user import User
from app.schemas.articles import ArticleCreate, ArticleOut, ArticleUpdate
from app.schemas.audit import AuditLogOut
from app.schemas.auth import AdminUserCreate, UserMe
from app.schemas.gallery import GalleryItemCreate, GalleryItemOut, GalleryItemUpdate
from app.schemas.leagues import LeagueCreate, LeagueOut, LeagueUpdate
from app.schemas.seasons import SeasonCreate, SeasonOut, SeasonPublicOut, SeasonUpdate
from app.schemas.matches import MatchCreate, MatchDetailOut, MatchResultIn, MatchUpdate
from app.schemas.media_upload import MediaUploadOut
from app.schemas.platform_settings import PlatformSettingsOut, PlatformSettingsPatch
from app.schemas.players import PlayerCreate, PlayerMatchAppearanceOut, PlayerOut, PlayerUpdate
from app.schemas.teams import TeamCreate, TeamOut, TeamUpdate
from app.services.audit import write_audit
from app.services.uploads import build_media_public_url, save_upload_file

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/uploads", response_model=MediaUploadOut, status_code=status.HTTP_201_CREATED)
def admin_upload_media(
    request: Request,
    file: UploadFile = File(...),
    kind: str = Form(default="misc"),
    _: User = Depends(require_admin_writer),
) -> MediaUploadOut:
    """Store a binary on disk (under ``MEDIA_ROOT``) and return a stable public URL."""
    from app.core.config import get_settings

    settings = get_settings()
    k = (kind or "misc").strip().lower() or "misc"
    storage_key = save_upload_file(settings, kind=k, file=file)
    url = build_media_public_url(settings, str(request.base_url), storage_key)
    return MediaUploadOut(url=url, path=storage_key)


@router.get("/users", response_model=dict)
def admin_list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
    page_params: PageParams = Depends(),
) -> dict:
    stmt = select(User).order_by(User.email)
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    return to_paginated([UserMe.model_validate(r) for r in rows], total, page_params.page, page_params.page_size).model_dump()


@router.get("/audit-logs", response_model=dict)
def admin_list_audit_logs(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
    page_params: PageParams = Depends(),
) -> dict:
    count_raw = db.scalar(select(func.count()).select_from(AuditLog))
    total = int(count_raw) if count_raw is not None else 0
    offset = (page_params.page - 1) * page_params.page_size
    stmt = (
        select(AuditLog, User.email)
        .outerjoin(User, AuditLog.actor_user_id == User.id)
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(page_params.page_size)
    )
    rows = list(db.execute(stmt).all())
    items = [
        AuditLogOut(
            id=log.id,
            actor_user_id=log.actor_user_id,
            actor_email=email,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            summary=log.summary,
            created_at=log.created_at,
        )
        for log, email in rows
    ]
    pages = ceil(total / page_params.page_size) if page_params.page_size else 0
    return {
        "items": [i.model_dump(mode="json") for i in items],
        "total": total,
        "page": page_params.page,
        "page_size": page_params.page_size,
        "pages": pages,
    }


def _season_team_ids(db: Session, season_id: int) -> list[int]:
    return list(db.scalars(select(SeasonTeam.team_id).where(SeasonTeam.season_id == season_id)).all())


def _set_season_teams(db: Session, season_id: int, team_ids: list[int] | None) -> None:
    if team_ids is None:
        return
    db.execute(delete(SeasonTeam).where(SeasonTeam.season_id == season_id))
    for tid in team_ids:
        db.add(SeasonTeam(season_id=season_id, team_id=tid))


def _assert_match_teams_in_season(db: Session, season_id: int | None, home_id: int, away_id: int) -> None:
    if season_id is None:
        return
    allowed = set(_season_team_ids(db, season_id))
    if not allowed:
        return
    if home_id not in allowed or away_id not in allowed:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "validation",
                "message": "When a season has a roster, home and away teams must be in that roster.",
            },
        )


@router.post("/users", response_model=UserMe, status_code=status.HTTP_201_CREATED)
def create_admin_user(
    body: AdminUserCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_super_admin),
) -> User:
    if db.scalar(select(User).where(User.email == body.email)):
        raise HTTPException(status_code=409, detail={"code": "conflict", "message": "Email already registered"})
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
        is_active=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "conflict", "message": "Could not create user"})
    db.refresh(user)
    write_audit(
        db,
        actor_user_id=actor.id,
        action="user_create",
        entity_type="user",
        entity_id=user.id,
        summary=f"Created user {user.email} as {user.role}",
    )
    db.commit()
    return user


@router.get("/teams", response_model=dict)
def admin_list_teams(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
    page_params: PageParams = Depends(),
    category: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None),
) -> dict:
    stmt = select(Team)
    if category:
        stmt = stmt.where(Team.category == category)
    if status_filter:
        stmt = stmt.where(Team.status == status_filter)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Team.name.ilike(like), Team.slug.ilike(like)))
    stmt = stmt.order_by(Team.name)
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    return to_paginated([TeamOut.model_validate(r) for r in rows], total, page_params.page, page_params.page_size).model_dump()


@router.post("/teams", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def admin_create_team(
    body: TeamCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_competition_writer),
) -> Team:
    team = Team(**body.model_dump())
    db.add(team)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "conflict", "message": "Slug or data conflict"})
    db.refresh(team)
    write_audit(db, actor_user_id=actor.id, action="create", entity_type="team", entity_id=team.id, summary=team.name)
    db.commit()
    return team


@router.patch("/teams/{team_id}", response_model=TeamOut)
def admin_update_team(
    team_id: int,
    body: TeamUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_competition_writer),
) -> Team:
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Team not found"})
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(team, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "conflict", "message": "Slug or data conflict"})
    db.refresh(team)
    write_audit(db, actor_user_id=actor.id, action="update", entity_type="team", entity_id=team.id, summary=team.name)
    db.commit()
    return team


@router.delete("/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_competition_writer),
) -> None:
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Team not found"})
    team.status = "inactive"
    db.commit()
    write_audit(db, actor_user_id=actor.id, action="archive", entity_type="team", entity_id=team.id, summary=team.name)
    db.commit()


@router.get("/players", response_model=dict)
def admin_list_players(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
    page_params: PageParams = Depends(),
    team_id: int | None = Query(default=None),
    q: str | None = Query(default=None),
) -> dict:
    stmt = select(Player)
    if team_id is not None:
        stmt = stmt.where(Player.team_id == team_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Player.full_name.ilike(like), Player.slug.ilike(like)))
    stmt = stmt.order_by(Player.full_name)
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    return to_paginated([PlayerOut.model_validate(r) for r in rows], total, page_params.page, page_params.page_size).model_dump()


@router.post("/players", response_model=PlayerOut, status_code=status.HTTP_201_CREATED)
def admin_create_player(
    body: PlayerCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_competition_writer),
) -> Player:
    if db.get(Team, body.team_id) is None:
        raise HTTPException(status_code=400, detail={"code": "validation", "message": "Invalid team_id"})
    data = body.model_dump()
    player = Player(**data)
    db.add(player)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "conflict", "message": "Slug or data conflict"})
    db.refresh(player)
    write_audit(db, actor_user_id=actor.id, action="create", entity_type="player", entity_id=player.id, summary=player.full_name)
    db.commit()
    return player


@router.patch("/players/{player_id}", response_model=PlayerOut)
def admin_update_player(
    player_id: int,
    body: PlayerUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_competition_writer),
) -> Player:
    player = db.get(Player, player_id)
    if player is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Player not found"})
    payload = body.model_dump(exclude_unset=True)
    if "team_id" in payload and payload["team_id"] is not None and db.get(Team, payload["team_id"]) is None:
        raise HTTPException(status_code=400, detail={"code": "validation", "message": "Invalid team_id"})
    for k, v in payload.items():
        setattr(player, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "conflict", "message": "Slug or data conflict"})
    db.refresh(player)
    write_audit(db, actor_user_id=actor.id, action="update", entity_type="player", entity_id=player.id, summary=player.full_name)
    db.commit()
    return player


@router.get("/players/{player_id}/match-appearances", response_model=list[PlayerMatchAppearanceOut])
def admin_player_match_appearances(
    player_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
) -> list[PlayerMatchAppearanceOut]:
    if db.get(Player, player_id) is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Player not found"})
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
        lg = m.season.league.name if m.season and m.season.league else None
        sn = m.season.name if m.season else None
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
            )
        )
    return out


@router.get("/leagues", response_model=dict)
def admin_list_leagues(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
    page_params: PageParams = Depends(),
) -> dict:
    stmt = select(League).order_by(League.name)
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    items = [LeagueOut.model_validate(r) for r in rows]
    return to_paginated(items, total, page_params.page, page_params.page_size).model_dump()


@router.post("/leagues", response_model=LeagueOut, status_code=status.HTTP_201_CREATED)
def admin_create_league(
    body: LeagueCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_competition_writer),
) -> League:
    league = League(**body.model_dump())
    db.add(league)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "conflict", "message": "Slug or data conflict"})
    db.refresh(league)
    write_audit(db, actor_user_id=actor.id, action="create", entity_type="league", entity_id=league.id, summary=league.name)
    db.commit()
    return league


@router.patch("/leagues/{league_id}", response_model=LeagueOut)
def admin_update_league(
    league_id: int,
    body: LeagueUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_competition_writer),
) -> League:
    league = db.get(League, league_id)
    if league is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "League not found"})
    payload = body.model_dump(exclude_unset=True)
    for k, v in payload.items():
        setattr(league, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "conflict", "message": "Slug or data conflict"})
    db.refresh(league)
    write_audit(db, actor_user_id=actor.id, action="update", entity_type="league", entity_id=league.id, summary=league.name)
    db.commit()
    return league


def _season_public(db: Session, row: Season) -> SeasonPublicOut:
    base = SeasonOut.model_validate(row).model_dump()
    return SeasonPublicOut.model_validate({**base, "team_ids": _season_team_ids(db, row.id)})


@router.get("/seasons", response_model=dict)
def admin_list_seasons(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
    page_params: PageParams = Depends(),
    league_id: int | None = Query(default=None),
) -> dict:
    stmt = select(Season).order_by(Season.start_date.desc().nullslast(), Season.id.desc())
    if league_id is not None:
        stmt = stmt.where(Season.league_id == league_id)
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    items = [_season_public(db, r) for r in rows]
    return to_paginated(items, total, page_params.page, page_params.page_size).model_dump()


@router.get("/leagues/{league_id}/seasons", response_model=dict)
def admin_list_seasons_for_league(
    league_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
    page_params: PageParams = Depends(),
) -> dict:
    if db.get(League, league_id) is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "League not found"})
    stmt = select(Season).where(Season.league_id == league_id).order_by(Season.start_date.desc().nullslast(), Season.id.desc())
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    items = [_season_public(db, r) for r in rows]
    return to_paginated(items, total, page_params.page, page_params.page_size).model_dump()


@router.post("/leagues/{league_id}/seasons", response_model=SeasonPublicOut, status_code=status.HTTP_201_CREATED)
def admin_create_season(
    league_id: int,
    body: SeasonCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_competition_writer),
) -> SeasonPublicOut:
    if db.get(League, league_id) is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "League not found"})
    data = body.model_dump(exclude={"team_ids"})
    season = Season(league_id=league_id, **data)
    db.add(season)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "conflict", "message": "Slug or data conflict"})
    _set_season_teams(db, season.id, body.team_ids)
    db.commit()
    db.refresh(season)
    write_audit(db, actor_user_id=actor.id, action="create", entity_type="season", entity_id=season.id, summary=season.name)
    db.commit()
    return _season_public(db, season)


@router.patch("/seasons/{season_id}", response_model=SeasonPublicOut)
def admin_update_season(
    season_id: int,
    body: SeasonUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_competition_writer),
) -> SeasonPublicOut:
    season = db.get(Season, season_id)
    if season is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Season not found"})
    payload = body.model_dump(exclude_unset=True)
    team_ids = payload.pop("team_ids", None)
    for k, v in payload.items():
        setattr(season, k, v)
    if team_ids is not None:
        _set_season_teams(db, season.id, team_ids)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "conflict", "message": "Slug or data conflict"})
    db.refresh(season)
    write_audit(db, actor_user_id=actor.id, action="update", entity_type="season", entity_id=season.id, summary=season.name)
    db.commit()
    return _season_public(db, season)


@router.get("/matches", response_model=dict)
def admin_list_matches(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
    page_params: PageParams = Depends(),
    season_id: int | None = Query(default=None),
    league_id: int | None = Query(default=None),
    team_id: int | None = Query(default=None),
) -> dict:
    stmt = (
        select(Match)
        .options(
            joinedload(Match.result),
            selectinload(Match.player_stats),
            joinedload(Match.season).joinedload(Season.league),
        )
        .order_by(Match.match_date.desc().nullslast(), Match.id.desc())
    )
    if season_id is not None:
        stmt = stmt.where(Match.season_id == season_id)
    if league_id is not None:
        stmt = stmt.join(Season, Match.season_id == Season.id).where(Season.league_id == league_id)
    if team_id is not None:
        stmt = stmt.where(or_(Match.home_team_id == team_id, Match.away_team_id == team_id))
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    return to_paginated([MatchDetailOut.model_validate(r) for r in rows], total, page_params.page, page_params.page_size).model_dump()


@router.post("/matches", response_model=MatchDetailOut, status_code=status.HTTP_201_CREATED)
def admin_create_match(
    body: MatchCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_competition_writer),
) -> Match:
    if body.home_team_id == body.away_team_id:
        raise HTTPException(status_code=400, detail={"code": "validation", "message": "Home and away must differ"})
    if db.get(Team, body.home_team_id) is None or db.get(Team, body.away_team_id) is None:
        raise HTTPException(status_code=400, detail={"code": "validation", "message": "Invalid team reference"})
    if body.season_id is not None and db.get(Season, body.season_id) is None:
        raise HTTPException(status_code=400, detail={"code": "validation", "message": "Invalid season_id"})
    _assert_match_teams_in_season(db, body.season_id, body.home_team_id, body.away_team_id)
    m = Match(**body.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    write_audit(
        db,
        actor_user_id=actor.id,
        action="create",
        entity_type="match",
        entity_id=m.id,
        summary=m.title if m.title is not None else f"Match {m.id}",
    )
    db.commit()
    m = db.scalar(
        select(Match)
        .options(
            joinedload(Match.home_team),
            joinedload(Match.away_team),
            joinedload(Match.season).joinedload(Season.league),
            joinedload(Match.result),
            selectinload(Match.player_stats),
        )
        .where(Match.id == m.id),
    )
    return m  # type: ignore[return-value]


@router.patch("/matches/{match_id}", response_model=MatchDetailOut)
def admin_update_match(
    match_id: int,
    body: MatchUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_competition_writer),
) -> Match:
    m = db.get(Match, match_id)
    if m is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Match not found"})
    payload = body.model_dump(exclude_unset=True)
    ht = payload.get("home_team_id", m.home_team_id)
    at = payload.get("away_team_id", m.away_team_id)
    if ht == at:
        raise HTTPException(status_code=400, detail={"code": "validation", "message": "Home and away must differ"})
    if "season_id" in payload and payload["season_id"] is not None and db.get(Season, payload["season_id"]) is None:
        raise HTTPException(status_code=400, detail={"code": "validation", "message": "Invalid season_id"})
    for k, v in payload.items():
        setattr(m, k, v)
    sid = m.season_id
    _assert_match_teams_in_season(db, sid, m.home_team_id, m.away_team_id)
    db.commit()
    db.refresh(m)
    write_audit(db, actor_user_id=actor.id, action="update", entity_type="match", entity_id=m.id, summary=m.title)
    db.commit()
    m2 = db.scalar(
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
    return m2  # type: ignore[return-value]


@router.post("/matches/{match_id}/result", response_model=MatchDetailOut)
def admin_set_match_result(
    match_id: int,
    body: MatchResultIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_competition_writer),
) -> Match:
    m = db.scalar(
        select(Match)
        .options(joinedload(Match.result), selectinload(Match.player_stats))
        .where(Match.id == match_id),
    )
    if m is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Match not found"})
    wt = body.winning_team_id
    if wt is not None and wt not in (m.home_team_id, m.away_team_id):
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "winning_team_id must be home or away team"},
        )
    if body.player_of_match_player_id is not None:
        p = db.get(Player, body.player_of_match_player_id)
        if p is None:
            raise HTTPException(status_code=400, detail={"code": "validation", "message": "Invalid player_of_match_player_id"})
    stats_in = body.player_stats
    pids = [s.player_id for s in stats_in]
    if len(pids) != len(set(pids)):
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "Duplicate player_id in player_stats"},
        )
    for row in stats_in:
        if row.team_id not in (m.home_team_id, m.away_team_id):
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "Each player_stats.team_id must be the match home or away team"},
            )
        if db.get(Player, row.player_id) is None:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": f"Unknown player_id {row.player_id} in player_stats"},
            )

    res = m.result
    result_payload = body.model_dump(exclude={"player_stats"})
    if res is None:
        res = MatchResult(match_id=m.id, **result_payload)
        db.add(res)
    else:
        for k, v in result_payload.items():
            setattr(res, k, v)
    m.status = "completed"
    db.execute(delete(MatchPlayerStat).where(MatchPlayerStat.match_id == m.id))
    for row in stats_in:
        ovr = None if row.overs is None else Decimal(str(row.overs))
        db.add(
            MatchPlayerStat(
                match_id=m.id,
                player_id=row.player_id,
                team_id=row.team_id,
                lineup_order=row.lineup_order,
                runs=row.runs,
                balls_faced=row.balls_faced,
                fours=row.fours,
                sixes=row.sixes,
                dismissal=row.dismissal,
                overs=ovr,
                maidens=row.maidens,
                runs_conceded=row.runs_conceded,
                wickets=row.wickets,
                catches=row.catches,
                stumpings=row.stumpings,
                run_outs=row.run_outs,
                notes=row.notes,
            )
        )
    db.commit()
    write_audit(
        db,
        actor_user_id=actor.id,
        action="result_set",
        entity_type="match",
        entity_id=m.id,
        summary=result_payload.get("score_summary"),
    )
    db.commit()
    m2 = db.scalar(
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
    return m2  # type: ignore[return-value]


@router.get("/news", response_model=dict)
def admin_list_news(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
    page_params: PageParams = Depends(),
    status_filter: str | None = Query(default=None, alias="status"),
) -> dict:
    stmt = select(Article).order_by(Article.updated_at.desc())
    if status_filter:
        stmt = stmt.where(Article.status == status_filter)
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    return to_paginated([ArticleOut.model_validate(r) for r in rows], total, page_params.page, page_params.page_size).model_dump()


@router.post("/news", response_model=ArticleOut, status_code=status.HTTP_201_CREATED)
def admin_create_news(
    body: ArticleCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_content_writer),
) -> Article:
    article = Article(**body.model_dump())
    db.add(article)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "conflict", "message": "Slug conflict"})
    db.refresh(article)
    write_audit(db, actor_user_id=actor.id, action="create", entity_type="article", entity_id=article.id, summary=article.title)
    db.commit()
    return article


@router.patch("/news/{article_id}", response_model=ArticleOut)
def admin_update_news(
    article_id: int,
    body: ArticleUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_content_writer),
) -> Article:
    article = db.get(Article, article_id)
    if article is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Article not found"})
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(article, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "conflict", "message": "Slug conflict"})
    db.refresh(article)
    write_audit(db, actor_user_id=actor.id, action="update", entity_type="article", entity_id=article.id, summary=article.title)
    db.commit()
    return article


@router.post("/news/{article_id}/publish", response_model=ArticleOut)
def admin_publish_news(
    article_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_content_writer),
) -> Article:
    article = db.get(Article, article_id)
    if article is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Article not found"})
    article.status = "published"
    if article.published_at is None:
        article.published_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(article)
    write_audit(db, actor_user_id=actor.id, action="publish", entity_type="article", entity_id=article.id, summary=article.title)
    db.commit()
    return article


@router.get("/gallery", response_model=dict)
def admin_list_gallery(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
    page_params: PageParams = Depends(),
) -> dict:
    stmt = select(GalleryItem).order_by(GalleryItem.created_at.desc())
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    return to_paginated([GalleryItemOut.model_validate(r) for r in rows], total, page_params.page, page_params.page_size).model_dump()


@router.post("/gallery", response_model=GalleryItemOut, status_code=status.HTTP_201_CREATED)
def admin_create_gallery(
    body: GalleryItemCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_content_writer),
) -> GalleryItem:
    item = GalleryItem(**body.model_dump(), uploaded_by_user_id=actor.id)
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "conflict", "message": "Slug conflict"})
    db.refresh(item)
    write_audit(db, actor_user_id=actor.id, action="create", entity_type="gallery_item", entity_id=item.id, summary=item.title)
    db.commit()
    return item


@router.patch("/gallery/{item_id}", response_model=GalleryItemOut)
def admin_update_gallery(
    item_id: int,
    body: GalleryItemUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_content_writer),
) -> GalleryItem:
    item = db.get(GalleryItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Gallery item not found"})
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "conflict", "message": "Slug conflict"})
    db.refresh(item)
    write_audit(db, actor_user_id=actor.id, action="update", entity_type="gallery_item", entity_id=item.id, summary=item.title)
    db.commit()
    return item


@router.delete("/gallery/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_gallery(
    item_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_content_writer),
) -> None:
    item = db.get(GalleryItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Gallery item not found"})
    title = item.title
    db.delete(item)
    db.commit()
    write_audit(db, actor_user_id=actor.id, action="delete", entity_type="gallery_item", entity_id=item_id, summary=title)
    db.commit()


def _get_or_create_platform_settings(db: Session) -> PlatformSettings:
    row = db.get(PlatformSettings, 1)
    if row is None:
        row = PlatformSettings(id=1, site_name="National Premier League")
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("/settings", response_model=PlatformSettingsOut)
def admin_get_platform_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
) -> PlatformSettingsOut:
    row = _get_or_create_platform_settings(db)
    return PlatformSettingsOut.model_validate(row)


@router.patch("/settings", response_model=PlatformSettingsOut)
def admin_patch_platform_settings(
    body: PlatformSettingsPatch,
    db: Session = Depends(get_db),
    actor: User = Depends(require_super_admin),
) -> PlatformSettingsOut:
    row = _get_or_create_platform_settings(db)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    write_audit(
        db,
        actor_user_id=actor.id,
        action="update",
        entity_type="platform_settings",
        entity_id="1",
        summary=row.site_name,
    )
    db.commit()
    return PlatformSettingsOut.model_validate(row)
