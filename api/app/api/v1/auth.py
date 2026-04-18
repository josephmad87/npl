from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token_safe,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse, UserMe, UserMeUpdate

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == body.email))
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_credentials", "message": "Incorrect email or password"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "user_inactive", "message": "Account is disabled"},
        )
    extra = {"role": user.role}
    access = create_access_token(str(user.id), extra_claims=extra)
    refresh = create_refresh_token(str(user.id))
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    payload = decode_token_safe(body.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_refresh", "message": "Invalid refresh token"},
        )
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(status_code=401, detail={"code": "invalid_refresh", "message": "Invalid refresh token"})
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail={"code": "invalid_refresh", "message": "Invalid refresh token"})
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail={"code": "invalid_refresh", "message": "Invalid refresh token"})
    extra = {"role": user.role}
    access = create_access_token(str(user.id), extra_claims=extra)
    new_refresh = create_refresh_token(str(user.id))
    return TokenResponse(access_token=access, refresh_token=new_refresh)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout() -> None:
    """Client should discard tokens; optional server-side revocation can be added later."""
    return None


@router.get("/me", response_model=UserMe)
def me(current: User = Depends(get_current_user)) -> UserMe:
    return current


@router.patch("/me", response_model=UserMe)
def patch_me(
    body: UserMeUpdate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserMe:
    data = body.model_dump(exclude_unset=True)
    if not data:
        return current

    if "full_name" in data:
        raw = data["full_name"]
        if raw is None:
            current.full_name = None
        else:
            t = str(raw).strip()
            current.full_name = t if t else None

    new_pw = data.get("new_password")
    cur_pw = data.get("current_password")
    if new_pw:
        if not cur_pw:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "current_password_required",
                    "message": "Current password is required to set a new password.",
                },
            )
        if not verify_password(str(cur_pw), current.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "invalid_current_password",
                    "message": "Current password is incorrect.",
                },
            )
        current.hashed_password = hash_password(str(new_pw))
    elif cur_pw is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "new_password_required",
                "message": "Provide new_password when sending current_password.",
            },
        )

    db.add(current)
    db.commit()
    db.refresh(current)
    return current
