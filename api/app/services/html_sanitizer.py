"""Allow-list sanitisation for rich HTML accepted from the CMS."""

from __future__ import annotations

import nh3

STORY_TABLE_CLASSES = {
    "story-table",
    "story-table--standard",
    "story-table--striped",
    "story-table--compact",
    "story-table--minimal",
}


def sanitize_rich_html(value: str) -> str:
    """Remove executable markup while retaining normal article formatting."""
    if not value.strip():
        return ""
    return nh3.clean(
        value,
        clean_content_tags={"script", "style", "iframe", "object", "embed", "template"},
        allowed_classes={"table": STORY_TABLE_CLASSES},
        link_rel="noopener noreferrer",
        url_schemes={"http", "https", "mailto", "tel"},
    )
