import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.mfa import (
    build_totp_uri,
    consume_recovery_code,
    decrypt_totp_secret,
    dump_recovery_code_hashes,
    encrypt_totp_secret,
    generate_recovery_codes,
    generate_totp_secret,
    load_recovery_code_hashes,
    totp_qr_data_uri,
    verify_totp,
)
from app.core.security import (
    create_access_token,
    create_mfa_challenge_token,
    create_refresh_token,
    decode_token_safe,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    MfaChallengeRequest,
    MfaEnrollmentConfirmOut,
    MfaEnrollmentOut,
    MfaEnrollmentRequiredLoginResponse,
    MfaRequiredLoginResponse,
    MfaVerificationRequest,
    RefreshRequest,
    TokenResponse,
    UserMe,
    UserMeUpdate,
)
from app.services.audit import write_audit

router = APIRouter(prefix="/auth", tags=["auth"])

# A real bcrypt hash keeps unknown-user and wrong-password login work comparable,
# reducing account-enumeration timing differences.
DUMMY_PASSWORD_HASH = "$2b$12$VJp5D0ojQ2kQiN1lCyUG0.qHHQ0WWCOmc5GWzqVJibhdMb4RiAGMK"


def _issue_tokens(user: User) -> TokenResponse:
    extra = {"role": user.role, "mfa": True}
    return TokenResponse(
        access_token=create_access_token(str(user.id), extra_claims=extra),
        refresh_token=create_refresh_token(str(user.id), extra_claims={"mfa": True}),
    )


def _challenge_user(token: str, *, purpose: str, db: Session) -> User:
    payload = decode_token_safe(token)
    if (
        payload is None
        or payload.get("type") != "mfa_challenge"
        or payload.get("purpose") != purpose
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_mfa_challenge", "message": "The MFA sign-in session has expired."},
        )
    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_mfa_challenge", "message": "The MFA sign-in session has expired."},
        )
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_mfa_challenge", "message": "The MFA sign-in session has expired."},
        )
    return user


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = db.scalar(select(User).where(User.email == body.email))
    password_matches = verify_password(
        body.password,
        user.hashed_password if user is not None else DUMMY_PASSWORD_HASH,
    )
    if user is None or not password_matches:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_credentials", "message": "Incorrect email or password"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "user_inactive", "message": "Account is disabled"},
        )
    if user.mfa_enabled:
        return MfaRequiredLoginResponse(
            challenge_token=create_mfa_challenge_token(str(user.id), purpose="login"),
        )
    return MfaEnrollmentRequiredLoginResponse(
        challenge_token=create_mfa_challenge_token(str(user.id), purpose="enrollment"),
    )


@router.post("/mfa/enroll", response_model=MfaEnrollmentOut)
def enroll_mfa(body: MfaChallengeRequest, db: Session = Depends(get_db)) -> MfaEnrollmentOut:
    user = _challenge_user(body.challenge_token, purpose="enrollment", db=db)
    if user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "mfa_already_enabled", "message": "MFA is already enabled for this account."},
        )

    secret = generate_totp_secret()
    uri = build_totp_uri(secret, user.email)
    user.mfa_secret_encrypted = encrypt_totp_secret(secret)
    user.mfa_recovery_codes = None
    user.mfa_confirmed_at = None
    db.add(user)
    db.commit()
    return MfaEnrollmentOut(secret=secret, otpauth_uri=uri, qr_data_uri=totp_qr_data_uri(uri))


@router.post("/mfa/confirm-enrollment", response_model=MfaEnrollmentConfirmOut)
def confirm_mfa_enrollment(
    body: MfaVerificationRequest,
    db: Session = Depends(get_db),
) -> MfaEnrollmentConfirmOut:
    user = _challenge_user(body.challenge_token, purpose="enrollment", db=db)
    secret = decrypt_totp_secret(user.mfa_secret_encrypted or "")
    if user.mfa_enabled or secret is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "mfa_enrollment_unavailable", "message": "Start MFA enrollment again."},
        )
    if not verify_totp(secret, body.code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_mfa_code", "message": "The verification code is incorrect or expired."},
        )

    recovery_codes = generate_recovery_codes()
    user.mfa_enabled = True
    user.mfa_recovery_codes = dump_recovery_code_hashes(recovery_codes)
    user.mfa_confirmed_at = datetime.now(timezone.utc)
    write_audit(
        db,
        actor_user_id=user.id,
        action="enable_mfa",
        entity_type="user",
        entity_id=user.id,
        summary="Authenticator MFA enabled",
    )
    db.add(user)
    db.commit()
    return MfaEnrollmentConfirmOut(tokens=_issue_tokens(user), recovery_codes=recovery_codes)


@router.post("/mfa/verify", response_model=TokenResponse)
def verify_mfa_login(body: MfaVerificationRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = _challenge_user(body.challenge_token, purpose="login", db=db)
    secret = decrypt_totp_secret(user.mfa_secret_encrypted or "")
    if not user.mfa_enabled or secret is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "mfa_not_enabled", "message": "MFA enrollment is required."},
        )

    if verify_totp(secret, body.code):
        return _issue_tokens(user)

    used_recovery_code, remaining_hashes = consume_recovery_code(
        load_recovery_code_hashes(user.mfa_recovery_codes),
        body.code,
    )
    if not used_recovery_code:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_mfa_code", "message": "The verification or recovery code is incorrect."},
        )

    user.mfa_recovery_codes = json.dumps(remaining_hashes, separators=(",", ":"))
    write_audit(
        db,
        actor_user_id=user.id,
        action="use_mfa_recovery_code",
        entity_type="user",
        entity_id=user.id,
        summary=f"MFA recovery code used; {len(remaining_hashes)} remaining",
    )
    db.add(user)
    db.commit()
    return _issue_tokens(user)


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
    if not user.mfa_enabled or payload.get("mfa") is not True:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "mfa_required", "message": "Sign in again to complete MFA."},
        )
    return _issue_tokens(user)


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
