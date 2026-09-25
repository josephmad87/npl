from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core import roles as role_const
from app.core.security import decode_token_safe
from app.db.session import get_db
from app.models.user import User
from app.models.supporter import SupporterAccount

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    payload = decode_token_safe(creds.credentials)
    if payload is None or payload.get("type") != "access" or payload.get("account_type") == "supporter":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_token", "message": "Could not validate credentials"},
        )
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(status_code=401, detail={"code": "invalid_token", "message": "Missing subject"})
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail={"code": "invalid_token", "message": "Invalid subject"})
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail={"code": "user_inactive", "message": "User not found or inactive"})
    return user


def _supporter_from_credentials(
    creds: HTTPAuthorizationCredentials | None,
    db: Session,
) -> SupporterAccount | None:
    if creds is None:
        return None
    payload = decode_token_safe(creds.credentials)
    if payload is None or payload.get("type") != "access" or payload.get("account_type") != "supporter":
        return None
    subject = str(payload.get("sub") or "")
    if not subject.startswith("supporter:"):
        return None
    try:
        supporter_id = int(subject.removeprefix("supporter:"))
    except ValueError:
        return None
    supporter = db.get(SupporterAccount, supporter_id)
    if supporter is None or not supporter.is_active:
        return None
    return supporter


def get_optional_supporter(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(optional_security)],
    db: Annotated[Session, Depends(get_db)],
) -> SupporterAccount | None:
    return _supporter_from_credentials(creds, db)


def get_current_supporter(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(optional_security)],
    db: Annotated[Session, Depends(get_db)],
) -> SupporterAccount:
    supporter = _supporter_from_credentials(creds, db)
    if supporter is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "supporter_auth_required", "message": "Sign in with a supporter account to continue."},
        )
    return supporter


def require_admin_reader(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not role_const.can_read_admin(user.role):
        raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "Insufficient permissions"})
    return user


def require_admin_writer(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not role_const.can_write_admin(user.role):
        raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "Write access required"})
    return user


def require_competition_writer(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not role_const.can_manage_competition(user.role):
        raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "Competition manager access required"})
    return user


def require_content_writer(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not role_const.can_manage_content(user.role):
        raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "Content editor access required"})
    return user


def require_super_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not role_const.can_manage_users(user.role):
        raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "Super admin access required"})
    return user
