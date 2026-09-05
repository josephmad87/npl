from __future__ import annotations

import re

_LEGACY_TOSS_PATTERN = re.compile(
    r"^(.+?)\s+won\s+the\s+toss(?:\s+and)?\s+"
    r"(?:chose|elected|decided|opted)\s+to\s+"
    r"(bat|bowl|field)(?:\s+first)?(?:[.;].*)?$",
    re.IGNORECASE,
)
_CONCISE_TOSS_PATTERN = re.compile(
    r"^(.+?)\s+opt(?:s|ed)?\s+to\s+"
    r"(bat|bowl|field)(?:\s+first)?[.]?$",
    re.IGNORECASE,
)


def build_toss_summary(team_name: str, decision: str) -> str:
    clean_name = " ".join(team_name.split())
    clean_decision = decision.strip().lower()
    if clean_decision == "field":
        clean_decision = "bowl"
    if clean_decision not in {"bat", "bowl"}:
        raise ValueError("Toss decision must be bat or bowl")
    return f"{clean_name} opt to {clean_decision}"


def normalize_toss_summary(value: str | None) -> str | None:
    clean = " ".join((value or "").split())
    if not clean:
        return None

    match = _LEGACY_TOSS_PATTERN.fullmatch(clean) or _CONCISE_TOSS_PATTERN.fullmatch(clean)
    if match is None:
        return clean
    return build_toss_summary(match.group(1), match.group(2))
