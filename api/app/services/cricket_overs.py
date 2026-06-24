"""Cricket overs notation helpers (e.g. 4.3 = 4 overs and 3 balls)."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP


def normalize_cricket_overs(value: Decimal | float | int | str | None) -> Decimal | None:
    """Round to one decimal place and clamp ball digit to 0–5."""
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    raw = float(value)
    if raw <= 0:
        return None
    n = round(raw, 1)
    s = f"{n:.1f}".rstrip("0").rstrip(".")
    if "." not in s:
        return Decimal(s)
    whole, frac = s.split(".", 1)
    ball = min(5, int(frac[0]) if frac else 0)
    normalized = Decimal(f"{whole}.{ball}")
    return normalized.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def format_cricket_overs_display(value: Decimal | float | int | str | None) -> str:
    """Format overs for display with at most one decimal place."""
    normalized = normalize_cricket_overs(value)
    if normalized is None:
        return ""
    s = format(normalized, "f")
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s
