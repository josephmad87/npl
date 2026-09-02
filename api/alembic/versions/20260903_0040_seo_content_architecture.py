"""Add persistent SEO redirects and managed information pages.

Revision ID: 20260903_0040
Revises: 20260902_0039
"""

from collections.abc import Sequence
import re
import unicodedata
from urllib.parse import quote

import sqlalchemy as sa
from alembic import op

revision: str = "20260903_0040"
down_revision: str | None = "20260902_0039"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SITE_PAGE_SLUGS = (
    "privacy",
    "terms",
    "support",
    "account-deletion",
    "competition",
    "safeguarding",
    "scorecard-corrections",
    "supporters",
)

LEGACY_REDIRECTS = (
    ("/about", "/about-us"),
    ("/contact", "/contact-us"),
    ("/live-scores", "/live"),
    ("/scores", "/live"),
    ("/shop", "/merchandise"),
    ("/merch", "/merchandise"),
    ("/ladies", "/women"),
    ("/ladies/fixtures", "/women/fixtures"),
    ("/ladies/results", "/women/results"),
    ("/ladies/teams", "/women/teams"),
)


def _seo_slug(value: str, *, fallback: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    normalised = ascii_value.strip().lower().replace("&", "and")
    normalised = normalised.replace("'", "").replace("’", "")
    normalised = re.sub(r"[^a-z0-9]+", "-", normalised).strip("-")
    return normalised or fallback


def _canonical_slug_updates(
    rows: list[dict[str, object]],
    *,
    scope_key: str | None = None,
) -> dict[int, tuple[str, str]]:
    """Return id -> (old, new), preserving valid slugs and avoiding collisions."""
    reserved: dict[object, set[str]] = {}
    for row in rows:
        scope = row.get(scope_key) if scope_key else "global"
        old = str(row["slug"])
        if old == _seo_slug(old, fallback=f"item-{row['id']}"):
            reserved.setdefault(scope, set()).add(old)

    updates: dict[int, tuple[str, str]] = {}
    for row in rows:
        row_id = int(row["id"])
        scope = row.get(scope_key) if scope_key else "global"
        used = reserved.setdefault(scope, set())
        old = str(row["slug"])
        base = _seo_slug(old, fallback=f"item-{row_id}")
        if old == base:
            continue
        candidate = base
        suffix = 2
        if candidate in used:
            candidate = f"{base}-{row_id}"
        while candidate in used:
            candidate = f"{base}-{row_id}-{suffix}"
            suffix += 1
        used.add(candidate)
        updates[row_id] = (old, candidate)
    return updates


def _upsert_redirect(connection: sa.Connection, source: str, target: str) -> None:
    if source == target:
        return
    connection.execute(
        sa.text(
            "INSERT INTO seo_redirects "
            "(source_path, target_path, status_code, is_active) "
            "VALUES (:source, :target, 301, true) "
            "ON CONFLICT (source_path) DO UPDATE SET "
            "target_path = EXCLUDED.target_path, status_code = 301, "
            "is_active = true, updated_at = now()",
        ),
        {"source": source, "target": target},
    )


def _path_segment(value: str) -> str:
    return quote(value, safe="-._~")


def _migrate_existing_slugs() -> None:
    connection = op.get_bind()
    table_configs = (
        ("teams", "/teams", None),
        ("players", "/players", None),
        ("articles", "/news", None),
        ("leagues", "/leagues", None),
    )
    league_rows = [
        dict(row)
        for row in connection.execute(
            sa.text("SELECT id, slug FROM leagues ORDER BY id"),
        ).mappings()
    ]
    season_rows = [
        dict(row)
        for row in connection.execute(
            sa.text("SELECT id, league_id, slug FROM seasons ORDER BY league_id, id"),
        ).mappings()
    ]

    all_updates: dict[str, dict[int, tuple[str, str]]] = {}
    for table_name, _, _ in table_configs:
        rows = (
            league_rows
            if table_name == "leagues"
            else [
                dict(row)
                for row in connection.execute(
                    sa.text(f"SELECT id, slug FROM {table_name} ORDER BY id"),
                ).mappings()
            ]
        )
        all_updates[table_name] = _canonical_slug_updates(rows)
    all_updates["seasons"] = _canonical_slug_updates(season_rows, scope_key="league_id")

    for table_name, prefix, _ in table_configs:
        for row_id, (old, new) in all_updates[table_name].items():
            connection.execute(
                sa.text(f"UPDATE {table_name} SET slug = :slug WHERE id = :id"),
                {"slug": new, "id": row_id},
            )
            _upsert_redirect(
                connection,
                f"{prefix}/{_path_segment(old)}",
                f"{prefix}/{new}",
            )

    league_original = {int(row["id"]): str(row["slug"]) for row in league_rows}
    league_current = {
        league_id: all_updates["leagues"].get(league_id, (slug, slug))[1] for league_id, slug in league_original.items()
    }
    for row in season_rows:
        season_id = int(row["id"])
        league_id = int(row["league_id"])
        old_season = str(row["slug"])
        new_season = all_updates["seasons"].get(
            season_id,
            (old_season, old_season),
        )[1]
        old_league = league_original[league_id]
        new_league = league_current[league_id]
        if new_season != old_season:
            connection.execute(
                sa.text("UPDATE seasons SET slug = :slug WHERE id = :id"),
                {"slug": new_season, "id": season_id},
            )
        _upsert_redirect(
            connection,
            f"/leagues/{_path_segment(old_league)}/seasons/{_path_segment(old_season)}",
            f"/leagues/{new_league}/seasons/{new_season}",
        )
        if old_league != new_league and old_season != new_season:
            _upsert_redirect(
                connection,
                f"/leagues/{new_league}/seasons/{_path_segment(old_season)}",
                f"/leagues/{new_league}/seasons/{new_season}",
            )


def upgrade() -> None:
    op.create_table(
        "seo_redirects",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("source_path", sa.String(length=2048), nullable=False),
        sa.Column("target_path", sa.String(length=2048), nullable=False),
        sa.Column("status_code", sa.Integer(), server_default="301", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status_code = 301", name="seo_redirect_status_permanent"),
        sa.CheckConstraint("source_path LIKE '/%' AND source_path NOT LIKE '//%'", name="seo_redirect_source_local"),
        sa.CheckConstraint("target_path LIKE '/%' AND target_path NOT LIKE '//%'", name="seo_redirect_target_local"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_path"),
    )
    op.create_index("ix_seo_redirects_source_path", "seo_redirects", ["source_path"], unique=True)
    op.create_index("ix_seo_redirects_is_active", "seo_redirects", ["is_active"])
    redirects_table = sa.table(
        "seo_redirects",
        sa.column("source_path", sa.String()),
        sa.column("target_path", sa.String()),
        sa.column("status_code", sa.Integer()),
        sa.column("is_active", sa.Boolean()),
    )
    op.bulk_insert(
        redirects_table,
        [
            {
                "source_path": source,
                "target_path": target,
                "status_code": 301,
                "is_active": True,
            }
            for source, target in LEGACY_REDIRECTS
        ],
    )
    _migrate_existing_slugs()

    op.drop_constraint("site_page_content_known_slug", "site_page_content", type_="check")
    allowed = ", ".join(f"'{slug}'" for slug in SITE_PAGE_SLUGS)
    op.create_check_constraint(
        "site_page_content_known_slug",
        "site_page_content",
        f"slug IN ({allowed})",
    )
    for slug in SITE_PAGE_SLUGS[4:]:
        op.execute(
            sa.text(
                "INSERT INTO site_page_content (slug) VALUES (:slug) ON CONFLICT (slug) DO NOTHING",
            ).bindparams(slug=slug),
        )


def downgrade() -> None:
    removable = ", ".join(f"'{slug}'" for slug in SITE_PAGE_SLUGS[4:])
    op.execute(f"DELETE FROM site_page_content WHERE slug IN ({removable})")
    op.drop_constraint("site_page_content_known_slug", "site_page_content", type_="check")
    allowed = ", ".join(f"'{slug}'" for slug in SITE_PAGE_SLUGS[:4])
    op.create_check_constraint(
        "site_page_content_known_slug",
        "site_page_content",
        f"slug IN ({allowed})",
    )
    op.drop_index("ix_seo_redirects_is_active", table_name="seo_redirects")
    op.drop_index("ix_seo_redirects_source_path", table_name="seo_redirects")
    op.drop_table("seo_redirects")
