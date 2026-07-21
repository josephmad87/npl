from datetime import datetime, timezone
from math import ceil

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import (
    get_current_user,
    require_admin_reader,
    require_admin_writer,
    require_competition_writer,
    require_content_writer,
    require_super_admin,
)
from app.api.pagination import PageParams, paginate_select, to_paginated
from app.core.security import hash_password
from app.db.session import get_db
from app.models.about_content import AboutContent
from app.models.article import Article
from app.models.audit import AuditLog
from app.models.contact_message import ContactMessage
from app.models.gallery import GalleryItem
from app.models.sponsor import Sponsor
from app.models.league import League, Season, SeasonTeam
from app.models.match import (
    Match,
    MatchBallEvent,
    MatchDaySquadPlayer,
    MatchPlayerStat,
    MatchResult,
    MatchScorerAssignment,
)
from app.models.merchandise import MerchandiseOrder, MerchandiseProduct
from app.models.platform_settings import PlatformSettings
from app.models.player import Player
from app.models.team import Team
from app.models.user import User
from app.schemas.about_content import AboutContentBody, AboutContentOut
from app.schemas.contact_message import ContactMessageOut, ContactMessageUpdate
from app.schemas.articles import ArticleCreate, ArticleOut, ArticleUpdate
from app.schemas.audit import AuditLogOut
from app.schemas.auth import AdminUserCreate, AdminUserUpdate, UserMe
from app.schemas.gallery import GalleryItemCreate, GalleryItemOut, GalleryItemUpdate
from app.schemas.leagues import LeagueCreate, LeagueOut, LeagueUpdate
from app.schemas.seasons import SeasonCreate, SeasonOut, SeasonPublicOut, SeasonUpdate
from app.schemas.matches import (
    LiveBallEventIn,
    LiveBallEventOut,
    LiveScoreCompleteIn,
    LiveScoreStartIn,
    LiveScoreStateOut,
    LiveScoreInningsSummaryOut,
    MatchLiveSetupIn,
    MatchBulkCancelIn,
    MatchCreate,
    MatchDetailOut,
    MatchResultIn,
    MatchScorerAssignmentIn,
    MatchScorerAssignmentOut,
    MatchSquadOut,
    MatchSquadPlayerOut,
    MatchSquadSaveIn,
    MatchSquadTeamOut,
    MatchUpdate,
)
from app.schemas.merchandise import (
    MerchandiseOrderOut,
    MerchandiseOrderUpdate,
    MerchandiseProductCreate,
    MerchandiseProductOut,
    MerchandiseProductUpdate,
)
from app.schemas.media_upload import MediaUploadOut
from app.schemas.platform_settings import PlatformSettingsOut, PlatformSettingsPatch
from app.schemas.sponsor import SponsorCreate, SponsorOut, SponsorUpdate
from app.schemas.players import (
    PlayerBulkStatusIn,
    PlayerCreate,
    PlayerMatchAppearanceOut,
    PlayerOut,
    PlayerUpdate,
    SeasonMarkNonRosterInactiveIn,
    TeamPlayersBulkStatusIn,
)
from app.schemas.teams import TeamBulkArchiveIn, TeamCreate, TeamOut, TeamUpdate
from app.services.audit import write_audit
from app.services.cricket_overs import normalize_cricket_overs
from app.services.player_stats import (
    affected_player_ids_for_match,
    recompute_all_player_career_stats,
    recompute_player_career_stats,
)
from app.services.uploads import build_media_public_url, save_upload_file

router = APIRouter(prefix="/admin", tags=["admin"])


def _normalize_sponsor_link_url(link_url: str | None) -> str | None:
    if link_url is None:
        return None
    trimmed = link_url.strip()
    if not trimmed:
        return None
    if not trimmed.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "link_url must start with http:// or https://"},
        )
    return trimmed


def _sponsor_out(sp: Sponsor, team_name: str | None) -> SponsorOut:
    return SponsorOut(
        id=sp.id,
        name=sp.name,
        image_url=sp.image_url,
        link_url=sp.link_url,
        team_id=sp.team_id,
        team_name=team_name,
        created_at=sp.created_at,
    )

@router.get("/merchandise", response_model=dict)
def admin_list_merchandise(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
    page_params: PageParams = Depends(),
    status_filter: str | None = Query(default=None, alias="status"),
) -> dict:
    stmt = select(MerchandiseProduct)

    if status_filter:
        stmt = stmt.where(MerchandiseProduct.status == status_filter)

    stmt = stmt.order_by(
        MerchandiseProduct.sort_order,
        MerchandiseProduct.name,
    )

    rows, total = paginate_select(
        db,
        stmt,
        page=page_params.page,
        page_size=page_params.page_size,
    )

    return to_paginated(
        [MerchandiseProductOut.model_validate(r) for r in rows],
        total,
        page_params.page,
        page_params.page_size,
    ).model_dump()


@router.post(
    "/merchandise",
    response_model=MerchandiseProductOut,
    status_code=status.HTTP_201_CREATED,
)
def admin_create_merchandise(
    body: MerchandiseProductCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_content_writer),
) -> MerchandiseProductOut:
    if body.team_id is not None and db.get(Team, body.team_id) is None:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "validation",
                "message": "Team not found for team_id.",
            },
        )

    product = MerchandiseProduct(**body.model_dump())

    db.add(product)
    db.commit()
    db.refresh(product)

    write_audit(
        db,
        actor_user_id=actor.id,
        action="create",
        entity_type="merchandise_product",
        entity_id=product.id,
        summary=product.name,
    )
    db.commit()

    return MerchandiseProductOut.model_validate(product)


@router.get("/merchandise/orders", response_model=dict)
def admin_list_merchandise_orders(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
    page_params: PageParams = Depends(),
    status_filter: str | None = Query(default=None, alias="status"),
) -> dict:
    stmt = select(MerchandiseOrder)

    if status_filter:
        stmt = stmt.where(MerchandiseOrder.status == status_filter)

    stmt = stmt.order_by(MerchandiseOrder.created_at.desc())

    rows, total = paginate_select(
        db,
        stmt,
        page=page_params.page,
        page_size=page_params.page_size,
    )

    return to_paginated(
        [MerchandiseOrderOut.model_validate(r) for r in rows],
        total,
        page_params.page,
        page_params.page_size,
    ).model_dump()


@router.patch(
    "/merchandise/orders/{order_id}",
    response_model=MerchandiseOrderOut,
)
def admin_update_merchandise_order(
    order_id: int,
    body: MerchandiseOrderUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_content_writer),
) -> MerchandiseOrderOut:
    order = db.get(MerchandiseOrder, order_id)

    if order is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "not_found",
                "message": "Merchandise order not found",
            },
        )

    patch = body.model_dump(exclude_unset=True)

    if "team_id" in patch and patch["team_id"] is not None:
        if db.get(Team, patch["team_id"]) is None:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "validation",
                    "message": "Team not found for team_id.",
                },
            )
    

    for k, v in patch.items():
        setattr(order, k, v)

    db.commit()
    db.refresh(order)

    write_audit(
        db,
        actor_user_id=actor.id,
        action="update",
        entity_type="merchandise_order",
        entity_id=order.id,
        summary=f"{order.product_name} order from {order.customer_name}",
    )
    db.commit()

    return MerchandiseOrderOut.model_validate(order)


@router.get(
    "/merchandise/{product_id}",
    response_model=MerchandiseProductOut,
)
def admin_get_merchandise(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
) -> MerchandiseProductOut:
    product = db.get(MerchandiseProduct, product_id)

    if product is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "not_found",
                "message": "Merchandise product not found",
            },
        )

    return MerchandiseProductOut.model_validate(product)


@router.patch(
    "/merchandise/{product_id}",
    response_model=MerchandiseProductOut,
)
def admin_update_merchandise(
    product_id: int,
    body: MerchandiseProductUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_content_writer),
) -> MerchandiseProductOut:
    product = db.get(MerchandiseProduct, product_id)

    if product is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "not_found",
                "message": "Merchandise product not found",
            },
        )

    patch = body.model_dump(exclude_unset=True)

    for k, v in patch.items():
        setattr(product, k, v)

    db.commit()
    db.refresh(product)

    write_audit(
        db,
        actor_user_id=actor.id,
        action="update",
        entity_type="merchandise_product",
        entity_id=product.id,
        summary=product.name,
    )
    db.commit()

    return MerchandiseProductOut.model_validate(product)


@router.delete(
    "/merchandise/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def admin_archive_merchandise(
    product_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_content_writer),
) -> None:
    product = db.get(MerchandiseProduct, product_id)

    if product is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "not_found",
                "message": "Merchandise product not found",
            },
        )

    product.status = "inactive"
    db.commit()

    write_audit(
        db,
        actor_user_id=actor.id,
        action="archive",
        entity_type="merchandise_product",
        entity_id=product.id,
        summary=product.name,
    )
    db.commit()


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


_PLAYER_STATUSES = frozenset({"active", "inactive", "injured"})


def _validate_player_status(status: str) -> str:
    s = status.strip().lower()
    if s not in _PLAYER_STATUSES:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "validation",
                "message": f"status must be one of: {', '.join(sorted(_PLAYER_STATUSES))}",
            },
        )
    return s


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

def _active_super_admin_count(db: Session) -> int:
    raw = db.scalar(
        select(func.count())
        .select_from(User)
        .where(User.role == "super_admin", User.is_active.is_(True))
    )
    return int(raw or 0)


def _remove_scorer_from_open_matches(db: Session, user_id: int) -> int:
    rows = list(
        db.scalars(
            select(MatchScorerAssignment)
            .join(Match, MatchScorerAssignment.match_id == Match.id)
            .where(
                MatchScorerAssignment.user_id == user_id,
                Match.status.in_(("scheduled", "live", "postponed")),
            )
        ).all()
    )

    for row in rows:
        db.delete(row)

    return len(rows)


def _set_admin_user_active_status(
    db: Session,
    *,
    actor: User,
    user_id: int,
    is_active: bool,
) -> User:
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "User not found"},
        )

    if user.id == actor.id and not is_active:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "You cannot deactivate your own account."},
        )

    if user.role == "super_admin" and user.is_active and not is_active and _active_super_admin_count(db) <= 1:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "You cannot deactivate the last active super admin."},
        )

    removed_assignments = 0
    if user.role == "scorer" and not is_active:
        removed_assignments = _remove_scorer_from_open_matches(db, user.id)

    user.is_active = is_active
    db.commit()
    db.refresh(user)

    write_audit(
        db,
        actor_user_id=actor.id,
        action="user_activate" if is_active else "user_deactivate",
        entity_type="user",
        entity_id=user.id,
        summary=(
            f"{'Reactivated' if is_active else 'Deactivated'} user {user.email}"
            + (f" and removed {removed_assignments} open scorer assignment(s)" if removed_assignments else "")
        ),
    )
    db.commit()

    return user


@router.patch("/users/{user_id}", response_model=UserMe)
def admin_update_user(
    user_id: int,
    body: AdminUserUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_super_admin),
) -> User:
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "User not found"},
        )

    patch = body.model_dump(exclude_unset=True)
    next_role = patch.get("role", user.role)
    next_active = patch.get("is_active", user.is_active)

    if user.id == actor.id and next_active is False:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "You cannot deactivate your own account."},
        )

    if (
        user.role == "super_admin"
        and user.is_active
        and (next_role != "super_admin" or next_active is False)
        and _active_super_admin_count(db) <= 1
    ):
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "You cannot remove or deactivate the last active super admin."},
        )

    old_role = user.role
    removed_assignments = 0

    if "full_name" in patch:
        user.full_name = patch["full_name"]
    if "role" in patch:
        user.role = patch["role"]
    if "is_active" in patch:
        user.is_active = patch["is_active"]

    if old_role == "scorer" and user.is_active is False:
        removed_assignments = _remove_scorer_from_open_matches(db, user.id)

    db.commit()
    db.refresh(user)

    write_audit(
        db,
        actor_user_id=actor.id,
        action="user_update",
        entity_type="user",
        entity_id=user.id,
        summary=(
            f"Updated user {user.email}"
            + (f" and removed {removed_assignments} open scorer assignment(s)" if removed_assignments else "")
        ),
    )
    db.commit()

    return user


@router.delete("/users/{user_id}", response_model=UserMe)
def admin_deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_super_admin),
) -> User:
    return _set_admin_user_active_status(
        db,
        actor=actor,
        user_id=user_id,
        is_active=False,
    )


@router.post("/users/{user_id}/reactivate", response_model=UserMe)
def admin_reactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_super_admin),
) -> User:
    return _set_admin_user_active_status(
        db,
        actor=actor,
        user_id=user_id,
        is_active=True,
    )


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


def _assert_gallery_team_id(db: Session, team_id: int | None) -> None:
    if team_id is None:
        return
    if db.get(Team, team_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "validation", "message": "team_id must reference an existing team."},
        )


@router.get("/teams/{team_id}", response_model=TeamOut)
def admin_get_team(
    team_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
) -> Team:
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Team not found"})
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
    data = body.model_dump(exclude_unset=True)
    if "captain_player_id" in data:
        pid = data.pop("captain_player_id")
        if pid is None:
            team.captain_player_id = None
            team.captain = None
        else:
            pl = db.get(Player, pid)
            if pl is None or pl.team_id != team_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"code": "validation", "message": "Captain must be a player on this team."},
                )
            team.captain_player_id = pid
            team.captain = pl.full_name
    for k, v in data.items():
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


@router.post("/teams/bulk-archive", response_model=dict)
def admin_bulk_archive_teams(
    body: TeamBulkArchiveIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_competition_writer),
) -> dict:
    updated = 0
    skipped = 0
    for tid in body.team_ids:
        team = db.get(Team, tid)
        if team is None:
            skipped += 1
            continue
        if team.status == "inactive":
            skipped += 1
            continue
        team.status = "inactive"
        updated += 1
        write_audit(db, actor_user_id=actor.id, action="archive", entity_type="team", entity_id=team.id, summary=team.name)
    db.commit()
    return {"updated": updated, "skipped": skipped}


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


@router.post("/players/bulk-status", response_model=dict)
def admin_bulk_player_status(
    body: PlayerBulkStatusIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_competition_writer),
) -> dict:
    status_value = _validate_player_status(body.status)
    ids = list({pid for pid in body.player_ids if pid > 0})
    if not ids:
        raise HTTPException(status_code=400, detail={"code": "validation", "message": "player_ids required"})
    players = list(db.scalars(select(Player).where(Player.id.in_(ids))).all())
    for player in players:
        player.status = status_value
    db.commit()
    write_audit(
        db,
        actor_user_id=actor.id,
        action="bulk_status",
        entity_type="player",
        entity_id=0,
        summary=f"Set status={status_value} on {len(players)} player(s)",
    )
    db.commit()
    return {"updated": len(players)}


@router.post("/teams/{team_id}/players/bulk-status", response_model=dict)
def admin_team_players_bulk_status(
    team_id: int,
    body: TeamPlayersBulkStatusIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_competition_writer),
) -> dict:
    if db.get(Team, team_id) is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Team not found"})
    status_value = _validate_player_status(body.status)
    stmt = select(Player).where(Player.team_id == team_id)
    if body.only_statuses:
        allowed = {_validate_player_status(s) for s in body.only_statuses}
        stmt = stmt.where(Player.status.in_(allowed))
    players = list(db.scalars(stmt).all())
    for player in players:
        player.status = status_value
    db.commit()
    team = db.get(Team, team_id)
    write_audit(
        db,
        actor_user_id=actor.id,
        action="bulk_status",
        entity_type="player",
        entity_id=team_id,
        summary=f"Set status={status_value} on {len(players)} player(s) for team {team.name if team else team_id}",
    )
    db.commit()
    return {"updated": len(players)}


@router.get("/players/{player_id}", response_model=PlayerOut)
def admin_get_player(
    player_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
) -> Player:
    player = db.get(Player, player_id)
    if player is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Player not found"})
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
    previous_team_id = player.team_id
    payload = body.model_dump(exclude_unset=True)
    if "team_id" in payload and payload["team_id"] is not None and db.get(Team, payload["team_id"]) is None:
        raise HTTPException(status_code=400, detail={"code": "validation", "message": "Invalid team_id"})
    new_team_id = payload.get("team_id", previous_team_id)
    if new_team_id != previous_team_id:
        old_team = db.get(Team, previous_team_id)
        if old_team is not None and old_team.captain_player_id == player_id:
            old_team.captain_player_id = None
            old_team.captain = None
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
        lg = m.season.league.name if m.season and m.season.league else None
        sn = m.season.name if m.season else None
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


@router.post("/seasons/{season_id}/mark-non-roster-inactive", response_model=dict)
def admin_season_mark_non_roster_inactive(
    season_id: int,
    body: SeasonMarkNonRosterInactiveIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_competition_writer),
) -> dict:
    season = db.get(Season, season_id)
    if season is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Season not found"})
    roster_ids = set(_season_team_ids(db, season_id))
    stmt = select(Player)
    if roster_ids:
        stmt = stmt.where(Player.team_id.notin_(roster_ids))
    if body.only_statuses:
        allowed = {_validate_player_status(s) for s in body.only_statuses}
        stmt = stmt.where(Player.status.in_(allowed))
    players = list(db.scalars(stmt).all())
    team_ids_affected: set[int] = set()
    for player in players:
        player.status = "inactive"
        team_ids_affected.add(player.team_id)
    db.commit()
    write_audit(
        db,
        actor_user_id=actor.id,
        action="bulk_status",
        entity_type="player",
        entity_id=season_id,
        summary=f"Marked {len(players)} non-roster player(s) inactive for season {season.name}",
    )
    db.commit()
    return {"updated": len(players), "team_ids_affected": sorted(team_ids_affected)}


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


@router.post("/matches/bulk-cancel")
def admin_bulk_cancel_matches(
    body: MatchBulkCancelIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_super_admin),
) -> dict[str, int]:
    match_ids = sorted({int(match_id) for match_id in body.match_ids})

    if not match_ids:
        return {"deleted": 0}

    matches = list(
        db.scalars(
            select(Match).where(Match.id.in_(match_ids))
        )
    )

    if not matches:
        return {"deleted": 0}

    for match in matches:
        write_audit(
            db,
            actor_user_id=actor.id,
            action="delete",
            entity_type="match",
            entity_id=match.id,
            summary=f"Deleted fixture {match.id}",
        )

    db.execute(
        delete(MatchPlayerStat).where(MatchPlayerStat.match_id.in_(match_ids))
    )
    db.execute(
        delete(MatchResult).where(MatchResult.match_id.in_(match_ids))
    )
    db.execute(
        delete(Match).where(Match.id.in_(match_ids))
    )

    db.commit()

    return {"deleted": len(matches)}


@router.get("/matches/{match_id}", response_model=MatchDetailOut)
def admin_get_match(
    match_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
) -> Match:
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
    previous_status = m.status
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
    next_status = payload.get("status", m.status)
    if next_status == "completed" and previous_status != "completed":
        has_result = m.result is not None
        has_scorecard = db.scalar(
            select(MatchPlayerStat.id).where(MatchPlayerStat.match_id == match_id).limit(1),
        ) is not None
        if not has_result and not has_scorecard:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "validation",
                    "message": "Use Result & scorecard to mark a match completed.",
                },
            )
    affected_ids = affected_player_ids_for_match(db, match_id)
    if previous_status == "completed" and next_status != "completed":
        db.execute(delete(MatchResult).where(MatchResult.match_id == match_id))
        db.execute(delete(MatchPlayerStat).where(MatchPlayerStat.match_id == match_id))
        recompute_player_career_stats(db, affected_ids)
    elif previous_status == "completed" or next_status == "completed":
        recompute_player_career_stats(db, affected_ids)
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


@router.post("/players/recompute-stats", response_model=dict)
def admin_recompute_player_stats(
    db: Session = Depends(get_db),
    actor: User = Depends(require_super_admin),
) -> dict:
    """Backfill career totals on all players from completed-match scorecards."""
    count = recompute_all_player_career_stats(db)
    db.commit()
    write_audit(
        db,
        actor_user_id=actor.id,
        action="recompute_stats",
        entity_type="player",
        entity_id=0,
        summary=f"Recomputed career stats for {count} player(s)",
    )
    db.commit()
    return {"updated": count}

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
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Match not found"},
        )

    outcome = (body.outcome or "win").strip().lower()

    if outcome not in {"win", "tie", "no_result"}:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "validation",
                "message": "outcome must be one of: win, tie, no_result",
            },
        )

    wt = body.winning_team_id

    if outcome == "win":
        if wt is None:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "validation",
                    "message": "winning_team_id is required when outcome is win",
                },
            )

        if wt not in (m.home_team_id, m.away_team_id):
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "validation",
                    "message": "winning_team_id must be home or away team",
                },
            )
    else:
        wt = None

    bft = body.batting_first_team_id

    if bft is not None and bft not in (m.home_team_id, m.away_team_id):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "validation",
                "message": "batting_first_team_id must be home or away team",
            },
        )

    if body.player_of_match_player_id is not None:
        p = db.get(Player, body.player_of_match_player_id)

        if p is None:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "validation",
                    "message": "Invalid player_of_match_player_id",
                },
            )

    affected_player_ids = affected_player_ids_for_match(db, m.id)
    stats_in = body.player_stats

    affected_player_ids.update(s.player_id for s in stats_in)

    if body.player_of_match_player_id is not None:
        affected_player_ids.add(body.player_of_match_player_id)

    pids = [s.player_id for s in stats_in]

    if len(pids) != len(set(pids)):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "validation",
                "message": "Duplicate player_id in player_stats",
            },
        )

    for row in stats_in:
        if row.team_id not in (m.home_team_id, m.away_team_id):
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "validation",
                    "message": "Each player_stats.team_id must be the match home or away team",
                },
            )

        if db.get(Player, row.player_id) is None:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "validation",
                    "message": f"Unknown player_id {row.player_id} in player_stats",
                },
            )

    result_payload = body.model_dump(exclude={"player_stats"})
    result_payload["outcome"] = outcome
    result_payload["winning_team_id"] = wt

    if outcome == "tie" and not result_payload.get("margin_text"):
        result_payload["margin_text"] = "Match tied"

    if outcome == "no_result" and not result_payload.get("margin_text"):
        result_payload["margin_text"] = "No result"

    res = m.result

    if res is None:
        res = MatchResult(match_id=m.id, **result_payload)
        db.add(res)
    else:
        for k, v in result_payload.items():
            setattr(res, k, v)

    m.status = "completed"

    db.execute(delete(MatchPlayerStat).where(MatchPlayerStat.match_id == m.id))

    for row in stats_in:
        ovr = normalize_cricket_overs(row.overs)

        db.add(
            MatchPlayerStat(
                match_id=m.id,
                player_id=row.player_id,
                team_id=row.team_id,
                lineup_order=row.lineup_order,
                batting_order=row.batting_order,
                bowling_order=row.bowling_order,
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

    recompute_player_career_stats(db, affected_player_ids)

    db.commit()

    write_audit(
        db,
        actor_user_id=actor.id,
        action="result_set",
        entity_type="match",
        entity_id=m.id,
        summary=result_payload.get("score_summary") or result_payload.get("margin_text"),
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
    payload = body.model_dump(exclude_unset=True)
    for k, v in payload.items():
        setattr(article, k, v)
    if payload.get("status") == "published" and article.published_at is None:
        article.published_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "conflict", "message": "Slug conflict"})
    db.refresh(article)
    write_audit(db, actor_user_id=actor.id, action="update", entity_type="article", entity_id=article.id, summary=article.title)
    db.commit()
    return article


@router.get("/news/{article_id}", response_model=ArticleOut)
def admin_get_news(
    article_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
) -> Article:
    article = db.get(Article, article_id)
    if article is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Article not found"})
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
    payload = body.model_dump()
    _assert_gallery_team_id(db, payload.get("team_id"))
    item = GalleryItem(**payload, uploaded_by_user_id=actor.id)
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


@router.get("/gallery/{item_id}", response_model=GalleryItemOut)
def admin_get_gallery(
    item_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
) -> GalleryItem:
    item = db.get(GalleryItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Gallery item not found"})
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
    patch = body.model_dump(exclude_unset=True)
    if "team_id" in patch:
        _assert_gallery_team_id(db, patch["team_id"])
    for k, v in patch.items():
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


def _get_or_create_about_row(db: Session) -> AboutContent:
    row = db.get(AboutContent, 1)
    if row is None:
        row = AboutContent(id=1, body={})
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _coerce_about_body(raw: object) -> AboutContentBody:
    if not raw or not isinstance(raw, dict):
        return AboutContentBody()
    try:
        return AboutContentBody.model_validate(raw)
    except Exception:
        return AboutContentBody()


def _about_row_to_out(row: AboutContent) -> AboutContentOut:
    body = _coerce_about_body(row.body)
    return AboutContentOut(
        **body.model_dump(),
        updated_at=row.updated_at,
    )


@router.get("/about", response_model=AboutContentOut)
def admin_get_about(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
) -> AboutContentOut:
    row = _get_or_create_about_row(db)
    return _about_row_to_out(row)


@router.patch("/about", response_model=AboutContentOut)
def admin_patch_about(
    body: AboutContentBody,
    db: Session = Depends(get_db),
    actor: User = Depends(require_content_writer),
) -> AboutContentOut:
    row = _get_or_create_about_row(db)
    row.body = body.model_dump(mode="json")
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    write_audit(
        db,
        actor_user_id=actor.id,
        action="update",
        entity_type="about_content",
        entity_id="1",
        summary="About page",
    )
    db.commit()
    return _about_row_to_out(row)


@router.get("/sponsors", response_model=dict)
def admin_list_sponsors(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
    page_params: PageParams = Depends(),
) -> dict:
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
        _sponsor_out(sp, tn)
        for sp, tn in rows
    ]
    return to_paginated(items, total, page_params.page, page_params.page_size).model_dump()


@router.get("/sponsors/{sponsor_id}", response_model=SponsorOut)
def admin_get_sponsor(
    sponsor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
) -> SponsorOut:
    found = (
        db.execute(
            select(Sponsor, Team.name)
            .outerjoin(Team, Sponsor.team_id == Team.id)
            .where(Sponsor.id == sponsor_id),
        )
        .one_or_none()
    )
    if found is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Sponsor not found"})
    sp, team_name = found[0], found[1]
    return _sponsor_out(sp, team_name)


@router.post("/sponsors", response_model=SponsorOut, status_code=status.HTTP_201_CREATED)
def admin_create_sponsor(
    body: SponsorCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_content_writer),
) -> SponsorOut:
    if body.team_id is not None and db.get(Team, body.team_id) is None:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "Team not found for team_id."},
        )
    sp = Sponsor(
        name=body.name.strip(),
        image_url=(body.image_url or "").strip(),
        link_url=_normalize_sponsor_link_url(body.link_url),
        team_id=body.team_id,
    )
    db.add(sp)
    db.commit()
    db.refresh(sp)
    team_name = db.scalar(select(Team.name).where(Team.id == sp.team_id)) if sp.team_id is not None else None
    write_audit(
        db,
        actor_user_id=actor.id,
        action="create",
        entity_type="sponsor",
        entity_id=sp.id,
        summary=sp.name,
    )
    db.commit()
    return _sponsor_out(sp, team_name)


@router.patch("/sponsors/{sponsor_id}", response_model=SponsorOut)
def admin_update_sponsor(
    sponsor_id: int,
    body: SponsorUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_content_writer),
) -> SponsorOut:
    sp = db.get(Sponsor, sponsor_id)
    if sp is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Sponsor not found"})
    up = body.model_dump(exclude_unset=True)
    if "team_id" in up and up["team_id"] is not None and db.get(Team, up["team_id"]) is None:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "Team not found for team_id."},
        )
    if "name" in up and up["name"] is not None:
        sp.name = up["name"].strip()
    if "image_url" in up and up["image_url"] is not None:
        sp.image_url = up["image_url"].strip()
    if "link_url" in up:
        sp.link_url = _normalize_sponsor_link_url(up["link_url"])
    if "team_id" in up:
        sp.team_id = up["team_id"]
    db.commit()
    db.refresh(sp)
    team_name = db.scalar(select(Team.name).where(Team.id == sp.team_id)) if sp.team_id is not None else None
    write_audit(
        db,
        actor_user_id=actor.id,
        action="update",
        entity_type="sponsor",
        entity_id=sp.id,
        summary=sp.name,
    )
    db.commit()
    return _sponsor_out(sp, team_name)


@router.delete("/sponsors/{sponsor_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_sponsor(
    sponsor_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_content_writer),
) -> None:
    sp = db.get(Sponsor, sponsor_id)
    if sp is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Sponsor not found"})
    title = sp.name
    db.delete(sp)
    db.commit()
    write_audit(
        db,
        actor_user_id=actor.id,
        action="delete",
        entity_type="sponsor",
        entity_id=sponsor_id,
        summary=title,
    )
    db.commit()


@router.get("/contact-messages", response_model=dict)
def admin_list_contact_messages(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
    page_params: PageParams = Depends(),
) -> dict:
    stmt = select(ContactMessage).order_by(ContactMessage.created_at.desc())
    rows, total = paginate_select(db, stmt, page=page_params.page, page_size=page_params.page_size)
    items = [ContactMessageOut.model_validate(r) for r in rows]
    return to_paginated(items, total, page_params.page, page_params.page_size).model_dump()


@router.get("/contact-messages/{message_id}", response_model=ContactMessageOut)
def admin_get_contact_message(
    message_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
) -> ContactMessageOut:
    msg = db.get(ContactMessage, message_id)
    if msg is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Contact message not found"})
    return ContactMessageOut.model_validate(msg)


@router.patch("/contact-messages/{message_id}", response_model=ContactMessageOut)
def admin_update_contact_message(
    message_id: int,
    body: ContactMessageUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_content_writer),
) -> ContactMessageOut:
    msg = db.get(ContactMessage, message_id)
    if msg is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Contact message not found"})
    if body.read is not None:
        msg.read_at = datetime.now(timezone.utc) if body.read else None
    db.commit()
    db.refresh(msg)
    write_audit(
        db,
        actor_user_id=actor.id,
        action="update",
        entity_type="contact_message",
        entity_id=msg.id,
        summary=f"Marked {'read' if body.read else 'unread'}",
    )
    db.commit()
    return ContactMessageOut.model_validate(msg)


# ---------------------------------------------------------------------------
# Live scoring / scorer assignments
# ---------------------------------------------------------------------------

def _is_competition_actor(user: User) -> bool:
    return user.role in ("super_admin", "competition_manager")


def _assert_can_score_match(db: Session, match_id: int, actor: User) -> None:
    if _is_competition_actor(actor):
        return

    if actor.role == "scorer":
        assigned = db.scalar(
            select(MatchScorerAssignment.id).where(
                MatchScorerAssignment.match_id == match_id,
                MatchScorerAssignment.user_id == actor.id,
            ),
        )
        if assigned is not None:
            return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "forbidden", "message": "You are not assigned to score this match."},
    )


def _assert_live_team_ids(match: Match, *team_ids: int) -> None:
    allowed = {match.home_team_id, match.away_team_id}
    if any(tid not in allowed for tid in team_ids):
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "Team ids must belong to this match."},
        )


def _match_day_squad_ids(
    db: Session,
    match_id: int,
    team_id: int | None = None,
) -> set[int]:
    stmt = select(MatchDaySquadPlayer.player_id).where(MatchDaySquadPlayer.match_id == match_id)
    if team_id is not None:
        stmt = stmt.where(MatchDaySquadPlayer.team_id == team_id)
    return set(db.scalars(stmt).all())


def _assert_live_player(
    db: Session,
    player_id: int | None,
    team_ids: set[int],
    allowed_player_ids: set[int] | None = None,
    label: str = "Player",
) -> None:
    if player_id is None:
        return
    player = db.get(Player, player_id)
    if player is None or player.team_id not in team_ids:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": f"{label} must belong to the correct match team."},
        )
    if allowed_player_ids is not None and allowed_player_ids and player_id not in allowed_player_ids:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": f"{label} must be in the saved match day squad."},
        )


def _squad_player_out(row: MatchDaySquadPlayer) -> MatchSquadPlayerOut:
    return MatchSquadPlayerOut.model_validate(row)


def _match_squad_out(db: Session, match: Match) -> MatchSquadOut:
    rows = list(
        db.scalars(
            select(MatchDaySquadPlayer)
            .where(MatchDaySquadPlayer.match_id == match.id)
            .order_by(
                MatchDaySquadPlayer.team_id,
                MatchDaySquadPlayer.lineup_order,
                MatchDaySquadPlayer.id,
            ),
        ).all(),
    )
    teams: list[MatchSquadTeamOut] = []
    for team_id in (match.home_team_id, match.away_team_id):
        team_rows = [row for row in rows if row.team_id == team_id]
        teams.append(
            MatchSquadTeamOut(
                team_id=team_id,
                players=[_squad_player_out(row) for row in team_rows],
            ),
        )
    return MatchSquadOut(match_id=match.id, teams=teams)


def _validate_squad_player(db: Session, match: Match, team_id: int, player_id: int) -> None:
    if team_id not in {match.home_team_id, match.away_team_id}:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "Squad team ids must belong to this match."},
        )
    player = db.get(Player, player_id)
    if player is None or player.team_id != team_id:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "Squad players must belong to the selected team."},
        )


def _live_ball_label(event: MatchBallEvent) -> str:
    if event.is_dead_ball:
        if event.penalty_runs_batting:
            return f"P{event.penalty_runs_batting}"
        if event.penalty_runs_fielding:
            return f"P-fielding {event.penalty_runs_fielding}"
        return "Dead"

    if event.wicket_type:
        return "W"

    extras_type = (event.extras_type or "").strip().lower()
    if not extras_type:
        label = str(event.runs_batter)
    elif extras_type == "wide":
        label = "wd" if event.runs_extras == 1 else f"{event.runs_extras}wd"
    elif extras_type == "no_ball":
        label = "nb" if event.runs_batter == 0 else f"{event.runs_batter}+nb"
    elif extras_type == "bye":
        label = f"{event.runs_extras}b"
    elif extras_type == "leg_bye":
        label = f"{event.runs_extras}lb"
    elif extras_type == "no_ball_bye":
        label = f"nb+{max(0, event.runs_extras - 1)}b"
    elif extras_type == "no_ball_leg_bye":
        label = f"nb+{max(0, event.runs_extras - 1)}lb"
    elif extras_type == "penalty":
        label = f"P{event.penalty_runs_batting or event.penalty_runs_fielding}"
    else:
        code = extras_type.replace("_", " ")
        label = f"{event.runs_extras}{code[:2]}"

    if event.boundary_type:
        label = f"{label} boundary"
    if event.short_runs:
        label = f"{label} · {event.short_runs} short"
    return label

def _live_overs_label(legal_balls: int) -> str:
    return f"{legal_balls // 6}.{legal_balls % 6}"


def _live_event_out(event: MatchBallEvent) -> LiveBallEventOut:
    return LiveBallEventOut.model_validate(event)


def _validate_live_ball_event(body: LiveBallEventIn) -> None:
    extras_type = (body.extras_type or "").strip().lower() or None
    boundary_type = (body.boundary_type or "").strip().lower() or None
    wicket_type = (body.wicket_type or "").strip().lower() or None

    allowed_extras = {
        None,
        "wide",
        "no_ball",
        "bye",
        "leg_bye",
        "no_ball_bye",
        "no_ball_leg_bye",
        "penalty",
    }
    allowed_boundaries = {None, "four", "six", "overthrow_boundary"}
    allowed_wickets = {
        "bowled",
        "caught",
        "caught_and_bowled",
        "lbw",
        "run_out",
        "stumped",
        "hit_wicket",
        "retired_hurt",
        "retired_out",
        "retired_not_out",
        "hit_ball_twice",
        "obstructing_field",
        "timed_out",
    }

    if extras_type not in allowed_extras:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "validation",
                "message": "extras_type must be wide, no_ball, bye, leg_bye, no_ball_bye, no_ball_leg_bye, or penalty.",
            },
        )

    if boundary_type not in allowed_boundaries:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "boundary_type must be four, six, or overthrow_boundary."},
        )

    if boundary_type == "four" and body.boundary_runs != 4:
        raise HTTPException(status_code=400, detail={"code": "validation", "message": "A four boundary must have boundary_runs=4."})
    if boundary_type == "six" and body.boundary_runs != 6:
        raise HTTPException(status_code=400, detail={"code": "validation", "message": "A six boundary must have boundary_runs=6."})
    if boundary_type is None and body.boundary_runs not in (0,):
        raise HTTPException(status_code=400, detail={"code": "validation", "message": "boundary_runs requires a boundary_type."})

    if body.short_runs and body.completed_runs <= body.short_runs:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "completed_runs must be greater than short_runs when a short run is called."},
        )

    if body.penalty_runs_batting not in (0, 5, 10) or body.penalty_runs_fielding not in (0, 5, 10):
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "Penalty runs must be recorded in five-run units."},
        )

    if body.penalty_runs_batting and body.penalty_runs_fielding:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "One ball event cannot award penalties to both sides."},
        )

    if body.is_dead_ball:
        if body.is_legal_delivery:
            raise HTTPException(status_code=400, detail={"code": "validation", "message": "Dead ball events are not legal deliveries."})
        if body.runs_batter or body.runs_extras or wicket_type:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "Dead ball events cannot record batter runs, extras, or a wicket. Use penalty fields only if needed."},
            )
        return

    if extras_type is None:
        if body.runs_extras != 0:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "runs_extras requires an extras_type."},
            )

    if extras_type == "penalty":
        if body.runs_batter or body.runs_extras:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "Penalty events use penalty fields, not batter runs or extras."},
            )
        if not (body.penalty_runs_batting or body.penalty_runs_fielding):
            raise HTTPException(status_code=400, detail={"code": "validation", "message": "Penalty event must include penalty runs."})
        if body.is_legal_delivery:
            raise HTTPException(status_code=400, detail={"code": "validation", "message": "Standalone penalty events are not legal deliveries."})

    if extras_type == "wide":
        if body.is_legal_delivery:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "Wide balls are not legal deliveries."},
            )
        if body.runs_batter != 0:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "Runs from a Wide are extras, not batter runs."},
            )
        if body.runs_extras < 1:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "A Wide must include the one-run penalty."},
            )

    if extras_type == "no_ball":
        if body.is_legal_delivery:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "No-balls are not legal deliveries."},
            )
        if body.runs_extras < 1:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "A No-ball must include the one-run penalty."},
            )

    if extras_type in {"bye", "leg_bye"}:
        if not body.is_legal_delivery:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "Use no_ball_bye or no_ball_leg_bye when byes/leg-byes happen on a No-ball."},
            )
        if body.runs_batter != 0:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "Byes and leg-byes are extras, not batter runs."},
            )
        if body.runs_extras < 1:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "Byes and leg-byes must record at least one run."},
            )

    if extras_type in {"no_ball_bye", "no_ball_leg_bye"}:
        if body.is_legal_delivery:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "No-ball byes and no-ball leg-byes are not legal deliveries."},
            )
        if body.runs_batter != 0:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "No-ball byes/leg-byes are extras, not batter runs."},
            )
        if body.runs_extras < 2:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "No-ball byes/leg-byes must include the one-run No-ball penalty plus completed runs."},
            )

    if wicket_type:
        if wicket_type not in allowed_wickets:
            raise HTTPException(status_code=400, detail={"code": "validation", "message": "Unknown mode of dismissal."})
        if body.wicket_player_id is None and wicket_type not in {"timed_out"}:
            raise HTTPException(status_code=400, detail={"code": "validation", "message": "Choose the player who is out."})
        if wicket_type in {"caught", "run_out", "stumped"} and body.fielder_player_id is None:
            raise HTTPException(status_code=400, detail={"code": "validation", "message": "This dismissal requires a fielder."})
        if wicket_type in {"bowled", "lbw", "hit_wicket"} and body.fielder_player_id is not None:
            raise HTTPException(status_code=400, detail={"code": "validation", "message": "This dismissal should not record a fielder."})
        if extras_type == "wide" and wicket_type not in {"hit_wicket", "obstructing_field", "run_out", "stumped"}:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "After a Wide, the batter can only be out hit wicket, obstructing the field, run out, or stumped."},
            )
        if extras_type in {"no_ball", "no_ball_bye", "no_ball_leg_bye"} and wicket_type not in {"hit_wicket", "obstructing_field", "run_out"}:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "After a No-ball, the batter cannot be out bowled, caught, LBW, or stumped."},
            )
        if wicket_type == "run_out" and body.wicket_end is None:
            raise HTTPException(status_code=400, detail={"code": "validation", "message": "Run out requires the wicket end."})


def _assert_bowler_can_bowl_current_over(db: Session, match_id: int, body: LiveBallEventIn) -> None:
    if body.is_dead_ball:
        return
    if body.ball_number != 1 or body.over_number <= 0:
        return

    previous = db.scalar(
        select(MatchBallEvent)
        .where(
            MatchBallEvent.match_id == match_id,
            MatchBallEvent.innings == body.innings,
            MatchBallEvent.over_number == body.over_number - 1,
            MatchBallEvent.is_dead_ball.is_(False),
        )
        .order_by(MatchBallEvent.sequence_number.desc(), MatchBallEvent.id.desc()),
    )
    if previous is not None and previous.bowler_player_id == body.bowler_player_id:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "The same bowler cannot bowl consecutive overs."},
        )

def _live_score_state(db: Session, match: Match) -> LiveScoreStateOut:
    events = list(
        db.scalars(
            select(MatchBallEvent)
            .where(MatchBallEvent.match_id == match.id)
            .order_by(MatchBallEvent.sequence_number, MatchBallEvent.id),
        ).all(),
    )

    summaries: list[LiveScoreInningsSummaryOut] = []
    innings_numbers = sorted({event.innings for event in events})

    for innings in innings_numbers:
        rows = [event for event in events if event.innings == innings]
        if not rows:
            continue

        runs = sum(event.runs_batter + event.runs_extras + event.penalty_runs_batting for event in rows)
        wickets = sum(1 for event in rows if _live_event_counts_as_wicket(event))
        legal_balls = sum(1 for event in rows if event.is_legal_delivery)
        last_rows = rows[-6:]

        summaries.append(
            LiveScoreInningsSummaryOut(
                innings=innings,
                batting_team_id=rows[-1].batting_team_id,
                bowling_team_id=rows[-1].bowling_team_id,
                runs=runs,
                wickets=wickets,
                legal_balls=legal_balls,
                overs_label=_live_overs_label(legal_balls),
                last_six=[_live_ball_label(event) for event in last_rows],
                last_event=_live_event_out(rows[-1]),
            ),
        )

    current_innings = summaries[-1].innings if summaries else None

    return LiveScoreStateOut(
        match_id=match.id,
        status=match.status,
        current_innings=current_innings,
        summaries=summaries,
        events=[_live_event_out(event) for event in events],
    )


def _assignment_out(row: MatchScorerAssignment) -> MatchScorerAssignmentOut:
    return MatchScorerAssignmentOut(
        id=row.id,
        match_id=row.match_id,
        user_id=row.user_id,
        user_email=row.user.email if row.user else "",
        user_full_name=row.user.full_name if row.user else None,
        assigned_by_user_id=row.assigned_by_user_id,
        created_at=row.created_at,
    )


@router.get("/scorer/matches", response_model=list[MatchDetailOut])
def scorer_assigned_matches(
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> list[MatchDetailOut]:
    if actor.role == "scorer":
        stmt = (
            select(Match)
            .join(MatchScorerAssignment, MatchScorerAssignment.match_id == Match.id)
            .options(
                joinedload(Match.result),
                selectinload(Match.player_stats),
                joinedload(Match.season).joinedload(Season.league),
            )
            .where(MatchScorerAssignment.user_id == actor.id)
            .order_by(Match.match_date.desc().nullslast(), Match.id.desc())
        )
    elif _is_competition_actor(actor):
        stmt = (
            select(Match)
            .options(
                joinedload(Match.result),
                selectinload(Match.player_stats),
                joinedload(Match.season).joinedload(Season.league),
            )
            .where(Match.status.in_(("scheduled", "live")))
            .order_by(Match.match_date.desc().nullslast(), Match.id.desc())
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "forbidden", "message": "Scorer access required."},
        )

    matches = db.scalars(stmt).unique().all()
    return [MatchDetailOut.model_validate(match) for match in matches]


@router.get("/matches/{match_id}/scorers", response_model=list[MatchScorerAssignmentOut])
def admin_match_scorers(
    match_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_reader),
) -> list[MatchScorerAssignmentOut]:
    match = db.get(Match, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Match not found"})

    rows = list(
        db.scalars(
            select(MatchScorerAssignment)
            .options(joinedload(MatchScorerAssignment.user))
            .where(MatchScorerAssignment.match_id == match_id)
            .order_by(MatchScorerAssignment.id),
        ).all(),
    )
    return [_assignment_out(row) for row in rows]


@router.put("/matches/{match_id}/scorers", response_model=list[MatchScorerAssignmentOut])
def admin_set_match_scorers(
    match_id: int,
    body: MatchScorerAssignmentIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_competition_writer),
) -> list[MatchScorerAssignmentOut]:
    match = db.get(Match, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Match not found"})

    user_ids = list(dict.fromkeys(body.user_ids))
    users = list(db.scalars(select(User).where(User.id.in_(user_ids))).all()) if user_ids else []
    found_ids = {user.id for user in users}
    missing_ids = [user_id for user_id in user_ids if user_id not in found_ids]
    if missing_ids:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": f"Unknown scorer user id(s): {missing_ids}"},
        )

    invalid_users = [user.email for user in users if user.role != "scorer"]
    if invalid_users:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": f"Only scorer users can be assigned: {invalid_users}"},
        )

    db.execute(delete(MatchScorerAssignment).where(MatchScorerAssignment.match_id == match_id))
    for user in users:
        db.add(
            MatchScorerAssignment(
                match_id=match_id,
                user_id=user.id,
                assigned_by_user_id=actor.id,
            ),
        )
    db.commit()

    write_audit(
        db,
        actor_user_id=actor.id,
        action="assign_scorers",
        entity_type="match",
        entity_id=match_id,
        summary=f"Assigned {len(users)} scorer(s) to match {match_id}",
    )
    db.commit()

    rows = list(
        db.scalars(
            select(MatchScorerAssignment)
            .options(joinedload(MatchScorerAssignment.user))
            .where(MatchScorerAssignment.match_id == match_id)
            .order_by(MatchScorerAssignment.id),
        ).all(),
    )
    return [_assignment_out(row) for row in rows]


@router.get("/matches/{match_id}/squads", response_model=MatchSquadOut)
def admin_match_day_squad(
    match_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> MatchSquadOut:
    match = db.get(Match, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Match not found"})
    _assert_can_score_match(db, match_id, actor)
    return _match_squad_out(db, match)


@router.put("/matches/{match_id}/squads", response_model=MatchSquadOut)
def admin_save_match_day_squad(
    match_id: int,
    body: MatchSquadSaveIn,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> MatchSquadOut:
    match = db.get(Match, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Match not found"})
    _assert_can_score_match(db, match_id, actor)

    allowed_team_ids = {match.home_team_id, match.away_team_id}
    seen_players: set[int] = set()
    normalized: list[tuple[int, int, str, int, bool, bool]] = []

    for team in body.teams:
        if team.team_id not in allowed_team_ids:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "Squad team ids must belong to this match."},
            )

        playing_count = 0
        substitute_count = 0
        for idx, item in enumerate(team.players):
            if item.player_id in seen_players:
                raise HTTPException(
                    status_code=400,
                    detail={"code": "validation", "message": "A player can only appear once in a match day squad."},
                )
            seen_players.add(item.player_id)
            _validate_squad_player(db, match, team.team_id, item.player_id)

            if item.role == "playing_xi":
                playing_count += 1
            elif item.role == "substitute":
                substitute_count += 1
            else:
                raise HTTPException(
                    status_code=400,
                    detail={"code": "validation", "message": "Squad role must be playing_xi or substitute."},
                )

            normalized.append(
                (
                    team.team_id,
                    item.player_id,
                    item.role,
                    item.lineup_order or idx + 1,
                    item.is_captain,
                    item.is_wicketkeeper,
                ),
            )

        if playing_count > 11:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "Playing XI cannot contain more than 11 players."},
            )
        if substitute_count > 4:
            raise HTTPException(
                status_code=400,
                detail={"code": "validation", "message": "Substitutes cannot contain more than 4 players."},
            )

    db.execute(delete(MatchDaySquadPlayer).where(MatchDaySquadPlayer.match_id == match_id))
    for team_id, player_id, role, lineup_order, is_captain, is_wicketkeeper in normalized:
        db.add(
            MatchDaySquadPlayer(
                match_id=match_id,
                team_id=team_id,
                player_id=player_id,
                role=role,
                lineup_order=lineup_order,
                is_captain=is_captain,
                is_wicketkeeper=is_wicketkeeper,
                created_by_user_id=actor.id,
            ),
        )
    db.commit()

    write_audit(
        db,
        actor_user_id=actor.id,
        action="save_match_day_squad",
        entity_type="match",
        entity_id=match_id,
        summary=f"Saved match day squad for match {match_id}",
    )
    db.commit()

    return _match_squad_out(db, match)


@router.get("/matches/{match_id}/live", response_model=LiveScoreStateOut)
def admin_live_score_state(
    match_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> LiveScoreStateOut:
    match = db.get(Match, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Match not found"})
    _assert_can_score_match(db, match_id, actor)
    return _live_score_state(db, match)


@router.put("/matches/{match_id}/live/setup", response_model=MatchDetailOut)
def admin_save_live_match_setup(
    match_id: int,
    body: MatchLiveSetupIn,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> Match:
    match = db.get(Match, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Match not found"})
    _assert_can_score_match(db, match_id, actor)
    _assert_live_team_ids(match, body.toss_winner_team_id, body.batting_first_team_id)

    bowling_first_team_id = match.away_team_id if body.batting_first_team_id == match.home_team_id else match.home_team_id
    if body.toss_decision == "bat" and body.batting_first_team_id != body.toss_winner_team_id:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "If the toss winner chose to bat, that team must bat first."},
        )
    if body.toss_decision == "bowl" and body.batting_first_team_id == body.toss_winner_team_id:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "If the toss winner chose to bowl, the other team must bat first."},
        )

    toss_team = db.get(Team, body.toss_winner_team_id)
    batting_team = db.get(Team, body.batting_first_team_id)
    bowling_team = db.get(Team, bowling_first_team_id)
    if toss_team is None or batting_team is None or bowling_team is None:
        raise HTTPException(status_code=400, detail={"code": "validation", "message": "Invalid setup team."})

    decision_text = "bat first" if body.toss_decision == "bat" else "bowl first"
    match.toss_info = f"{toss_team.name} won the toss and chose to {decision_text}. {batting_team.name} batting first."
    match.match_overs = _match_overs_decimal(body.match_overs)

    umpire_names = [
        (body.umpire_1 or "").strip(),
        (body.umpire_2 or "").strip(),
        (body.reserve_umpire or "").strip(),
    ]
    match.umpires = ", ".join([name for name in umpire_names if name]) or None

    db.commit()
    db.refresh(match)

    write_audit(
        db,
        actor_user_id=actor.id,
        action="save_live_match_setup",
        entity_type="match",
        entity_id=match_id,
        summary=f"Saved live match setup for match {match_id}",
    )
    db.commit()
    return match


@router.post("/matches/{match_id}/live/start", response_model=LiveScoreStateOut)
def admin_start_live_score(
    match_id: int,
    body: LiveScoreStartIn,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> LiveScoreStateOut:
    match = db.get(Match, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Match not found"})
    _assert_can_score_match(db, match_id, actor)
    _assert_live_team_ids(match, body.batting_team_id, body.bowling_team_id)

    match.status = "live"
    db.commit()
    db.refresh(match)
    return _live_score_state(db, match)


@router.post("/matches/{match_id}/live/balls", response_model=LiveBallEventOut, status_code=status.HTTP_201_CREATED)
def admin_create_live_ball(
    match_id: int,
    body: LiveBallEventIn,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> LiveBallEventOut:
    match = db.get(Match, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Match not found"})
    _assert_can_score_match(db, match_id, actor)
    _assert_live_team_ids(match, body.batting_team_id, body.bowling_team_id)
    _validate_live_ball_event(body)

    batting_squad_ids = _match_day_squad_ids(db, match_id, body.batting_team_id)
    bowling_squad_ids = _match_day_squad_ids(db, match_id, body.bowling_team_id)
    batting_allowed = batting_squad_ids or None
    bowling_allowed = bowling_squad_ids or None

    _assert_live_player(
        db,
        body.striker_player_id,
        {body.batting_team_id},
        batting_allowed,
        "Striker",
    )
    _assert_live_player(
        db,
        body.non_striker_player_id,
        {body.batting_team_id},
        batting_allowed,
        "Non-striker",
    )
    _assert_live_player(
        db,
        body.bowler_player_id,
        {body.bowling_team_id},
        bowling_allowed,
        "Bowler",
    )
    _assert_live_player(
        db,
        body.wicket_player_id,
        {body.batting_team_id},
        batting_allowed,
        "Player out",
    )
    _assert_live_player(
        db,
        body.fielder_player_id,
        {body.bowling_team_id},
        bowling_allowed,
        "Fielder",
    )
    _assert_bowler_can_bowl_current_over(db, match_id, body)

    latest_sequence = db.scalar(
        select(func.max(MatchBallEvent.sequence_number)).where(MatchBallEvent.match_id == match_id),
    )
    next_sequence = int(latest_sequence or 0) + 1

    event = MatchBallEvent(
        match_id=match_id,
        sequence_number=next_sequence,
        created_by_user_id=actor.id,
        **body.model_dump(),
    )
    db.add(event)
    match.status = "live"
    db.commit()
    db.refresh(event)
    return _live_event_out(event)


@router.delete("/matches/{match_id}/live/balls/last", response_model=LiveScoreStateOut)
def admin_delete_last_live_ball(
    match_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> LiveScoreStateOut:
    match = db.get(Match, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Match not found"})
    _assert_can_score_match(db, match_id, actor)

    event = db.scalar(
        select(MatchBallEvent)
        .where(MatchBallEvent.match_id == match_id)
        .order_by(MatchBallEvent.sequence_number.desc(), MatchBallEvent.id.desc()),
    )
    if event is not None:
        db.delete(event)
        db.commit()

    return _live_score_state(db, match)

OUT_DISMISSALS = {
    "bowled",
    "caught",
    "caught_and_bowled",
    "lbw",
    "run_out",
    "stumped",
    "hit_wicket",
    "retired_out",
    "hit_ball_twice",
    "obstructing_field",
    "timed_out",
}

BOWLER_WICKET_DISMISSALS = {
    "bowled",
    "caught",
    "caught_and_bowled",
    "lbw",
    "stumped",
    "hit_wicket",
}


def _live_event_counts_as_wicket(event: MatchBallEvent) -> bool:
    return (event.wicket_type or "").strip().lower() in OUT_DISMISSALS


def _balls_to_cricket_overs_decimal(balls: int) -> Decimal:
    if balls <= 0:
        return Decimal("0.0")
    return Decimal(f"{balls // 6}.{balls % 6}")


def _match_overs_decimal(value: object | None) -> Decimal:
    normalized = normalize_cricket_overs(value)
    if normalized is None or normalized <= 0:
        return Decimal("40.0")
    return normalized


def _bowler_runs_for_live_event(event: MatchBallEvent) -> int:
    extras_type = (event.extras_type or "").strip().lower()
    runs = int(event.runs_batter or 0)

    if extras_type == "wide":
        runs += int(event.runs_extras or 0)
    elif extras_type == "no_ball":
        runs += int(event.runs_extras or 0)
    elif extras_type in {"no_ball_bye", "no_ball_leg_bye"}:
        runs += 1

    return runs


def _dismissal_text_for_live_event(
    event: MatchBallEvent,
    player_names: dict[int, str],
) -> str:
    if event.dismissal_text and event.dismissal_text.strip():
        return event.dismissal_text.strip()

    wicket_type = (event.wicket_type or "").strip().lower()
    bowler_name = player_names.get(event.bowler_player_id, f"#{event.bowler_player_id}")
    fielder_name = player_names.get(event.fielder_player_id or 0, "")

    if wicket_type == "bowled":
        return f"b {bowler_name}"
    if wicket_type == "caught":
        return f"c {fielder_name or 'fielder'} b {bowler_name}"
    if wicket_type == "caught_and_bowled":
        return f"c & b {bowler_name}"
    if wicket_type == "lbw":
        return f"lbw b {bowler_name}"
    if wicket_type == "run_out":
        return f"run out ({fielder_name})" if fielder_name else "run out"
    if wicket_type == "stumped":
        return f"st {fielder_name or 'wicketkeeper'} b {bowler_name}"
    if wicket_type == "hit_wicket":
        return f"hit wicket b {bowler_name}"
    if wicket_type == "retired_hurt":
        return "retired hurt"
    if wicket_type == "retired_not_out":
        return "retired not out"
    if wicket_type == "retired_out":
        return "retired out"
    if wicket_type == "hit_ball_twice":
        return "hit the ball twice"
    if wicket_type == "obstructing_field":
        return "obstructing the field"
    if wicket_type == "timed_out":
        return "timed out"
    return wicket_type.replace("_", " ") or "out"


def _team_name(db: Session, team_id: int) -> str:
    team = db.get(Team, team_id)
    return team.name if team is not None else f"Team {team_id}"


def _finalize_live_match_result(
    db: Session,
    match: Match,
    actor: User,
    match_overs_value: object | None = None,
) -> None:
    events = list(
        db.scalars(
            select(MatchBallEvent)
            .where(MatchBallEvent.match_id == match.id)
            .order_by(MatchBallEvent.sequence_number, MatchBallEvent.id),
        ).all(),
    )

    if not events:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation", "message": "Cannot finalize a match with no live scoring events."},
        )

    match_overs = _match_overs_decimal(match_overs_value if match_overs_value is not None else match.match_overs)
    match.match_overs = match_overs

    team_ids = {match.home_team_id, match.away_team_id}
    player_ids = {event.striker_player_id for event in events}
    player_ids.update(event.non_striker_player_id for event in events if event.non_striker_player_id)
    player_ids.update(event.bowler_player_id for event in events)
    player_ids.update(event.wicket_player_id for event in events if event.wicket_player_id)
    player_ids.update(event.fielder_player_id for event in events if event.fielder_player_id)
    player_rows = db.scalars(select(Player).where(Player.id.in_(player_ids))).all() if player_ids else []
    player_by_id = {player.id: player for player in player_rows}
    player_names = {player.id: player.full_name for player in player_rows}

    squad_rows = list(
        db.scalars(
            select(MatchDaySquadPlayer)
            .where(
                MatchDaySquadPlayer.match_id == match.id,
                MatchDaySquadPlayer.role == "playing_xi",
            )
            .order_by(MatchDaySquadPlayer.team_id, MatchDaySquadPlayer.lineup_order, MatchDaySquadPlayer.id),
        ).all(),
    )

    stat_by_player: dict[int, dict[str, object]] = {}
    next_lineup_order = {match.home_team_id: 1, match.away_team_id: 1}
    batting_order = {match.home_team_id: 1, match.away_team_id: 1}
    bowling_order = {match.home_team_id: 1, match.away_team_id: 1}

    def ensure_row(player_id: int | None, team_id: int | None = None, from_squad: bool = False) -> dict[str, object] | None:
        if player_id is None:
            return None
        player = player_by_id.get(player_id)
        resolved_team_id = team_id if team_id is not None else (player.team_id if player is not None else None)
        if resolved_team_id is None or resolved_team_id not in team_ids:
            return None
        if player_id in stat_by_player:
            if from_squad:
                stat_by_player[player_id]["from_squad"] = True
            return stat_by_player[player_id]
        lineup_order = next_lineup_order.get(resolved_team_id, 1)
        next_lineup_order[resolved_team_id] = lineup_order + 1
        row: dict[str, object] = {
            "player_id": player_id,
            "team_id": resolved_team_id,
            "lineup_order": lineup_order,
            "batting_order": None,
            "bowling_order": None,
            "runs": 0,
            "balls_faced": 0,
            "fours": 0,
            "sixes": 0,
            "dismissal": None,
            "overs_balls": 0,
            "maidens": 0,
            "runs_conceded": 0,
            "wickets": 0,
            "catches": 0,
            "stumpings": 0,
            "run_outs": 0,
            "notes": None,
            "from_squad": from_squad,
        }
        stat_by_player[player_id] = row
        return row

    for squad in squad_rows:
        next_lineup_order[squad.team_id] = max(next_lineup_order.get(squad.team_id, 1), squad.lineup_order + 1)
        row = ensure_row(squad.player_id, squad.team_id, from_squad=True)
        if row is not None:
            row["lineup_order"] = squad.lineup_order

    innings_meta: dict[int, dict[str, object]] = {}
    innings_by_number = sorted({event.innings for event in events})
    for innings in innings_by_number:
        rows = [event for event in events if event.innings == innings]
        if not rows:
            continue
        batting_team_id = rows[-1].batting_team_id
        bowling_team_id = rows[-1].bowling_team_id
        innings_meta[innings] = {
            "batting_team_id": batting_team_id,
            "bowling_team_id": bowling_team_id,
            "runs": 0,
            "wickets": 0,
            "legal_balls": 0,
        }

    bowling_over_runs: dict[tuple[int, int, int, int], int] = {}
    bowling_over_balls: dict[tuple[int, int, int, int], int] = {}
    extras_by_team = {
        match.home_team_id: {"wides": 0, "byes": 0, "no_balls": 0, "leg_byes": 0},
        match.away_team_id: {"wides": 0, "byes": 0, "no_balls": 0, "leg_byes": 0},
    }
    total_runs_by_team = {match.home_team_id: 0, match.away_team_id: 0}

    for event in events:
        innings = innings_meta.get(event.innings)
        if innings is not None:
            event_runs = int(event.runs_batter or 0) + int(event.runs_extras or 0) + int(event.penalty_runs_batting or 0)
            innings["runs"] = int(innings["runs"]) + event_runs
            total_runs_by_team[event.batting_team_id] += event_runs
            if event.penalty_runs_fielding:
                total_runs_by_team[event.bowling_team_id] += int(event.penalty_runs_fielding)
            if event.is_legal_delivery:
                innings["legal_balls"] = int(innings["legal_balls"]) + 1
            if _live_event_counts_as_wicket(event):
                innings["wickets"] = int(innings["wickets"]) + 1

        extras_type = (event.extras_type or "").strip().lower()
        team_extras = extras_by_team.setdefault(event.batting_team_id, {"wides": 0, "byes": 0, "no_balls": 0, "leg_byes": 0})
        if extras_type == "wide":
            team_extras["wides"] += int(event.runs_extras or 0)
        elif extras_type == "no_ball":
            team_extras["no_balls"] += int(event.runs_extras or 0)
        elif extras_type == "bye":
            team_extras["byes"] += int(event.runs_extras or 0)
        elif extras_type == "leg_bye":
            team_extras["leg_byes"] += int(event.runs_extras or 0)
        elif extras_type == "no_ball_bye":
            team_extras["no_balls"] += 1
            team_extras["byes"] += max(0, int(event.runs_extras or 0) - 1)
        elif extras_type == "no_ball_leg_bye":
            team_extras["no_balls"] += 1
            team_extras["leg_byes"] += max(0, int(event.runs_extras or 0) - 1)

        if not event.is_dead_ball:
            striker = ensure_row(event.striker_player_id, event.batting_team_id)
            if striker is not None:
                if striker["batting_order"] is None:
                    striker["batting_order"] = batting_order[event.batting_team_id]
                    batting_order[event.batting_team_id] += 1
                striker["runs"] = int(striker["runs"]) + int(event.runs_batter or 0)
                if event.is_legal_delivery:
                    striker["balls_faced"] = int(striker["balls_faced"]) + 1
                if event.boundary_type == "four" and event.runs_batter == 4:
                    striker["fours"] = int(striker["fours"]) + 1
                if event.boundary_type == "six" and event.runs_batter == 6:
                    striker["sixes"] = int(striker["sixes"]) + 1

            non_striker = ensure_row(event.non_striker_player_id, event.batting_team_id)
            if non_striker is not None and non_striker["batting_order"] is None:
                non_striker["batting_order"] = batting_order[event.batting_team_id]
                batting_order[event.batting_team_id] += 1

            bowler = ensure_row(event.bowler_player_id, event.bowling_team_id)
            if bowler is not None:
                if bowler["bowling_order"] is None:
                    bowler["bowling_order"] = bowling_order[event.bowling_team_id]
                    bowling_order[event.bowling_team_id] += 1
                bowler_runs = _bowler_runs_for_live_event(event)
                bowler["runs_conceded"] = int(bowler["runs_conceded"]) + bowler_runs
                if event.is_legal_delivery:
                    bowler["overs_balls"] = int(bowler["overs_balls"]) + 1
                key = (event.innings, event.bowling_team_id, event.over_number, event.bowler_player_id)
                bowling_over_runs[key] = bowling_over_runs.get(key, 0) + bowler_runs
                if event.is_legal_delivery:
                    bowling_over_balls[key] = bowling_over_balls.get(key, 0) + 1
                wicket_type = (event.wicket_type or "").strip().lower()
                if wicket_type in BOWLER_WICKET_DISMISSALS:
                    bowler["wickets"] = int(bowler["wickets"]) + 1

        wicket_type = (event.wicket_type or "").strip().lower()
        if wicket_type:
            out_row = ensure_row(event.wicket_player_id, event.batting_team_id)
            if out_row is not None:
                if out_row["batting_order"] is None:
                    out_row["batting_order"] = batting_order[event.batting_team_id]
                    batting_order[event.batting_team_id] += 1
                out_row["dismissal"] = _dismissal_text_for_live_event(event, player_names)

            if wicket_type == "caught":
                fielder = ensure_row(event.fielder_player_id, event.bowling_team_id)
                if fielder is not None:
                    fielder["catches"] = int(fielder["catches"]) + 1
            elif wicket_type == "caught_and_bowled":
                bowler = ensure_row(event.bowler_player_id, event.bowling_team_id)
                if bowler is not None:
                    bowler["catches"] = int(bowler["catches"]) + 1
            elif wicket_type == "stumped":
                fielder = ensure_row(event.fielder_player_id, event.bowling_team_id)
                if fielder is not None:
                    fielder["stumpings"] = int(fielder["stumpings"]) + 1
            elif wicket_type == "run_out":
                fielder = ensure_row(event.fielder_player_id, event.bowling_team_id)
                if fielder is not None:
                    fielder["run_outs"] = int(fielder["run_outs"]) + 1

    for key, balls in bowling_over_balls.items():
        if balls >= 6 and bowling_over_runs.get(key, 0) == 0:
            _innings, team_id, _over_number, bowler_id = key
            bowler = ensure_row(bowler_id, team_id)
            if bowler is not None:
                bowler["maidens"] = int(bowler["maidens"]) + 1

    for row in stat_by_player.values():
        if row["batting_order"] is not None and not row["dismissal"]:
            row["dismissal"] = "not out"
        elif row.get("from_squad") and row["batting_order"] is None:
            row["dismissal"] = "did not bat"

    innings_lines: list[str] = []
    for innings in innings_by_number:
        meta = innings_meta.get(innings)
        if meta is None:
            continue
        team_id = int(meta["batting_team_id"])
        team_runs = int(meta["runs"])
        team_wickets = int(meta["wickets"])
        team_balls = int(meta["legal_balls"])
        innings_lines.append(
            f"{_team_name(db, team_id)} {team_runs}/{team_wickets} ({_live_overs_label(team_balls)})",
        )

    outcome = "no_result"
    winning_team_id: int | None = None
    margin_text = "No result"
    if len(innings_by_number) >= 2:
        first = innings_meta[innings_by_number[0]]
        second = innings_meta[innings_by_number[1]]
        first_team_id = int(first["batting_team_id"])
        second_team_id = int(second["batting_team_id"])
        first_runs = int(first["runs"])
        second_runs = int(second["runs"])
        second_wickets = int(second["wickets"])
        if second_runs > first_runs:
            outcome = "win"
            winning_team_id = second_team_id
            margin_text = f"Won by {max(0, 10 - second_wickets)} wickets"
        elif first_runs > second_runs:
            outcome = "win"
            winning_team_id = first_team_id
            margin_text = f"Won by {first_runs - second_runs} runs"
        else:
            outcome = "tie"
            margin_text = "Match tied"
    elif innings_by_number:
        only = innings_meta[innings_by_number[0]]
        outcome = "no_result"
        margin_text = "No result"
        total_runs_by_team[int(only["batting_team_id"])] = int(only["runs"])

    batting_first_team_id = int(innings_meta[innings_by_number[0]]["batting_team_id"]) if innings_by_number else None
    score_summary = " · ".join(innings_lines) if innings_lines else None
    innings_breakdown = "\n".join(innings_lines) if innings_lines else None

    result_payload = {
        "outcome": outcome,
        "winning_team_id": winning_team_id,
        "batting_first_team_id": batting_first_team_id,
        "margin_text": margin_text,
        "score_summary": score_summary,
        "innings_breakdown": innings_breakdown,
        "top_performers": None,
        "player_of_match_player_id": None,
        "result_status": "official",
        "match_report": None,
        "home_allotted_overs": match_overs,
        "away_allotted_overs": match_overs,
        "home_extras_wides": extras_by_team[match.home_team_id]["wides"],
        "home_extras_byes": extras_by_team[match.home_team_id]["byes"],
        "home_extras_no_balls": extras_by_team[match.home_team_id]["no_balls"],
        "home_extras_leg_byes": extras_by_team[match.home_team_id]["leg_byes"],
        "away_extras_wides": extras_by_team[match.away_team_id]["wides"],
        "away_extras_byes": extras_by_team[match.away_team_id]["byes"],
        "away_extras_no_balls": extras_by_team[match.away_team_id]["no_balls"],
        "away_extras_leg_byes": extras_by_team[match.away_team_id]["leg_byes"],
    }

    affected_player_ids = affected_player_ids_for_match(db, match.id)
    affected_player_ids.update(stat_by_player.keys())

    res = match.result
    if res is None:
        res = MatchResult(match_id=match.id, **result_payload)
        db.add(res)
    else:
        for key, value in result_payload.items():
            setattr(res, key, value)

    db.execute(delete(MatchPlayerStat).where(MatchPlayerStat.match_id == match.id))

    for row in sorted(stat_by_player.values(), key=lambda r: (int(r["team_id"]), int(r["lineup_order"]))):
        db.add(
            MatchPlayerStat(
                match_id=match.id,
                player_id=int(row["player_id"]),
                team_id=int(row["team_id"]),
                lineup_order=int(row["lineup_order"]),
                batting_order=row["batting_order"],
                bowling_order=row["bowling_order"],
                runs=int(row["runs"]),
                balls_faced=int(row["balls_faced"]),
                fours=int(row["fours"]),
                sixes=int(row["sixes"]),
                dismissal=row["dismissal"],
                overs=_balls_to_cricket_overs_decimal(int(row["overs_balls"])),
                maidens=int(row["maidens"]),
                runs_conceded=int(row["runs_conceded"]),
                wickets=int(row["wickets"]),
                catches=int(row["catches"]),
                stumpings=int(row["stumpings"]),
                run_outs=int(row["run_outs"]),
                notes=row["notes"],
            ),
        )

    match.status = "completed"
    recompute_player_career_stats(db, affected_player_ids)


@router.post("/matches/{match_id}/live/complete", response_model=LiveScoreStateOut)
def admin_complete_live_score(
    match_id: int,
    body: LiveScoreCompleteIn,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> LiveScoreStateOut:
    match = db.scalar(
        select(Match)
        .options(joinedload(Match.result), selectinload(Match.player_stats))
        .where(Match.id == match_id),
    )
    if match is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Match not found"})
    _assert_can_score_match(db, match_id, actor)

    if body.status == "completed":
        _finalize_live_match_result(db, match, actor, body.match_overs)
        write_audit(
            db,
            actor_user_id=actor.id,
            action="finalize_live_score",
            entity_type="match",
            entity_id=match_id,
            summary=f"Finalized live score for match {match_id}",
        )
    else:
        match.status = body.status
        write_audit(
            db,
            actor_user_id=actor.id,
            action="complete_live_score",
            entity_type="match",
            entity_id=match_id,
            summary=f"Set live score status to {body.status} for match {match_id}",
        )

    db.commit()
    db.refresh(match)
    return _live_score_state(db, match)
