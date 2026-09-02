from urllib.parse import quote, unquote, urlsplit

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.seo_redirect import SeoRedirect


def normalise_public_path(value: str) -> str:
    """Return a local path without query/fragment or unsafe external routing."""
    parsed = urlsplit(value.strip())
    if parsed.scheme or parsed.netloc:
        raise ValueError("SEO redirect paths must be local absolute paths")
    path = unquote(parsed.path)
    if not path.startswith("/") or path.startswith("//"):
        raise ValueError("SEO redirect paths must be local absolute paths")
    if len(path) > 1:
        path = path.rstrip("/")
    return quote(path, safe="/-._~")


def record_seo_redirect(db: Session, *, source_path: str, target_path: str) -> None:
    source = normalise_public_path(source_path)
    target = normalise_public_path(target_path)
    if source == target:
        return

    # A slug can be changed back to a historical value. Deactivate the old
    # reverse redirect first so the new canonical path never forms a loop.
    reverse = db.scalar(
        select(SeoRedirect).where(
            SeoRedirect.source_path == target,
            SeoRedirect.target_path == source,
        ),
    )
    if reverse is not None:
        reverse.is_active = False

    row = db.scalar(select(SeoRedirect).where(SeoRedirect.source_path == source))
    if row is None:
        row = SeoRedirect(source_path=source, target_path=target, status_code=301, is_active=True)
        db.add(row)
    else:
        row.target_path = target
        row.status_code = 301
        row.is_active = True

    # Collapse existing chains so every historical slug points directly to the
    # newest canonical URL and crawlers never traverse multiple redirects.
    for chained in db.scalars(
        select(SeoRedirect).where(
            SeoRedirect.target_path == source,
            SeoRedirect.source_path != target,
        ),
    ).all():
        chained.target_path = target
