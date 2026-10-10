"""Allow all managed website pages in site_page_content.

Revision ID: 20261010_0049
Revises: 20261006_0048
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261010_0049"
down_revision: str | None = "20261006_0048"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Keep this list in sync with SitePageSlug in app.schemas.site_page_content.
SITE_PAGE_SLUGS = (
    "home",
    "mens",
    "women",
    "youth",
    "fixtures",
    "results",
    "teams",
    "seasons",
    "news",
    "gallery",
    "merchandise",
    "merchandise-product",
    "order-tracking",
    "live",
    "compare-teams",
    "about-us",
    "contact-us",
    "search",
    "my-npl",
    "team-profile",
    "player-profile",
    "match-centre",
    "league-season",
    "site-footer",
    "not-found",
    "privacy",
    "terms",
    "support",
    "account-deletion",
    "competition",
    "safeguarding",
    "scorecard-corrections",
    "supporters",
)

PREVIOUS_SITE_PAGE_SLUGS = (
    "privacy",
    "terms",
    "support",
    "account-deletion",
    "competition",
    "safeguarding",
    "scorecard-corrections",
    "supporters",
)


def _slug_constraint(slugs: tuple[str, ...]) -> str:
    return "slug IN (" + ", ".join(f"'{slug}'" for slug in slugs) + ")"


def upgrade() -> None:
    op.drop_constraint("site_page_content_known_slug", "site_page_content", type_="check")
    op.create_check_constraint(
        "site_page_content_known_slug",
        "site_page_content",
        _slug_constraint(SITE_PAGE_SLUGS),
    )


def downgrade() -> None:
    existing = op.get_bind().execute(
        sa.text("SELECT slug FROM site_page_content WHERE slug NOT IN :slugs LIMIT 1")
        .bindparams(sa.bindparam("slugs", expanding=True)),
        {"slugs": PREVIOUS_SITE_PAGE_SLUGS},
    ).scalar_one_or_none()
    if existing is not None:
        raise RuntimeError("Remove or migrate newly managed site-page content before downgrading")
    op.drop_constraint("site_page_content_known_slug", "site_page_content", type_="check")
    op.create_check_constraint(
        "site_page_content_known_slug",
        "site_page_content",
        _slug_constraint(PREVIOUS_SITE_PAGE_SLUGS),
    )
