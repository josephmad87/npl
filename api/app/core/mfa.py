import base64
import hashlib
import hmac
import io
import json
import secrets
import struct
import time
from urllib.parse import quote, urlencode

import qrcode
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


TOTP_DIGITS = 6
TOTP_PERIOD_SECONDS = 30
RECOVERY_CODE_COUNT = 8
_RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def build_totp_uri(secret: str, email: str) -> str:
    issuer = "NPL Admin"
    label = quote(f"{issuer}:{email}", safe="")
    query = urlencode(
        {
            "secret": secret,
            "issuer": issuer,
            "algorithm": "SHA1",
            "digits": str(TOTP_DIGITS),
            "period": str(TOTP_PERIOD_SECONDS),
        },
    )
    return f"otpauth://totp/{label}?{query}"


def totp_qr_data_uri(uri: str) -> str:
    image = qrcode.make(uri)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _decode_base32(secret: str) -> bytes:
    normalized = secret.strip().replace(" ", "").upper()
    padding = "=" * ((8 - len(normalized) % 8) % 8)
    return base64.b32decode(normalized + padding, casefold=True)


def _totp_at(secret: str, timestamp: int) -> str:
    counter = timestamp // TOTP_PERIOD_SECONDS
    digest = hmac.new(_decode_base32(secret), struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    binary = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(binary % (10**TOTP_DIGITS)).zfill(TOTP_DIGITS)


def verify_totp(secret: str, code: str, *, timestamp: int | None = None, window: int = 1) -> bool:
    normalized = "".join(character for character in code if character.isdigit())
    if len(normalized) != TOTP_DIGITS:
        return False
    now = int(time.time() if timestamp is None else timestamp)
    return any(
        hmac.compare_digest(_totp_at(secret, now + (offset * TOTP_PERIOD_SECONDS)), normalized)
        for offset in range(-window, window + 1)
    )


def _fernet() -> Fernet:
    secret_key = get_settings().secret_key.encode("utf-8")
    derived = hashlib.sha256(b"npl-admin-mfa-v1:" + secret_key).digest()
    return Fernet(base64.urlsafe_b64encode(derived))


def encrypt_totp_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode("ascii")).decode("ascii")


def decrypt_totp_secret(encrypted: str) -> str | None:
    try:
        return _fernet().decrypt(encrypted.encode("ascii")).decode("ascii")
    except (InvalidToken, ValueError):
        return None


def normalize_recovery_code(code: str) -> str:
    return "".join(character for character in code.upper() if character.isalnum())


def generate_recovery_codes() -> list[str]:
    codes: list[str] = []
    for _ in range(RECOVERY_CODE_COUNT):
        raw = "".join(secrets.choice(_RECOVERY_ALPHABET) for _ in range(12))
        codes.append("-".join((raw[:4], raw[4:8], raw[8:])))
    return codes


def hash_recovery_code(code: str) -> str:
    signing_key = hashlib.sha256(b"npl-admin-recovery-v1:" + get_settings().secret_key.encode("utf-8")).digest()
    return hmac.new(signing_key, normalize_recovery_code(code).encode("ascii"), hashlib.sha256).hexdigest()


def dump_recovery_code_hashes(codes: list[str]) -> str:
    return json.dumps([hash_recovery_code(code) for code in codes], separators=(",", ":"))


def load_recovery_code_hashes(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return []
    if not isinstance(parsed, list):
        return []
    return [item for item in parsed if isinstance(item, str)]


def consume_recovery_code(stored_hashes: list[str], code: str) -> tuple[bool, list[str]]:
    candidate = hash_recovery_code(code)
    for index, stored in enumerate(stored_hashes):
        if hmac.compare_digest(stored, candidate):
            return True, stored_hashes[:index] + stored_hashes[index + 1 :]
    return False, stored_hashes
