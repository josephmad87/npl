"""DLS Standard Edition resource helpers for live par-score schedules.

The scorer remains responsible for entering the official revised target from
the current ICC DLS calculator. These helpers use the published Standard
Edition resource curve to advance the par score after each legal delivery and
wicket.
"""

from decimal import Decimal
from math import exp, floor


# Parameters fitted to the ICC's published ball-by-ball Standard Edition table.
# The resulting values match the one-decimal table within 0.1 percentage point.
_RESOURCE_ASYMPTOTES = (
    134.046001968,
    118.509232324,
    101.887467604,
    84.449956260,
    67.016766786,
    50.267822321,
    35.118082767,
    21.990273267,
    11.909431012,
    4.700691469,
)
_RESOURCE_DECAY = (
    3.674312545,
    3.673880762,
    3.673855603,
    3.674346849,
    3.673867339,
    3.674567327,
    3.673945370,
    3.672656053,
    3.682887590,
    3.617408698,
)


def cricket_overs_to_balls(value: Decimal | float | int | str) -> int:
    overs = Decimal(str(value))
    whole = int(overs)
    fractional_balls = (overs - Decimal(whole)) * 10
    if fractional_balls != fractional_balls.to_integral_value():
        raise ValueError("Overs must use cricket notation, for example 20.0 or 19.4.")
    fraction = int(fractional_balls)
    if overs <= 0 or fraction < 0 or fraction > 5:
        raise ValueError("Overs must use cricket notation, for example 20.0 or 19.4.")
    return (whole * 6) + fraction


def dls_resource_percentage(remaining_balls: int, wickets_lost: int) -> float:
    if remaining_balls <= 0 or wickets_lost >= 10:
        return 0.0

    wickets = max(0, min(9, wickets_lost))
    overs = min(300, remaining_balls) / 6
    asymptote = _RESOURCE_ASYMPTOTES[wickets]
    decay = _RESOURCE_DECAY[wickets]
    return asymptote * (1 - exp((-decay * overs) / asymptote))


def dls_par_score(
    *,
    revised_target_runs: int | None,
    allotted_overs: Decimal | float | int | str,
    legal_balls: int,
    wickets_lost: int,
    effective_resource_percentage: Decimal | float | None = None,
) -> int | None:
    if revised_target_runs is None or revised_target_runs < 1:
        return None

    allotted_balls = cricket_overs_to_balls(allotted_overs)
    default_resource = dls_resource_percentage(allotted_balls, 0)
    effective_resource = (
        float(effective_resource_percentage)
        if effective_resource_percentage is not None
        else default_resource
    )
    if effective_resource <= 0:
        return revised_target_runs - 1

    remaining_resource = dls_resource_percentage(
        max(0, allotted_balls - legal_balls),
        wickets_lost,
    )
    used_resource = max(0.0, min(effective_resource, effective_resource - remaining_resource))
    par = floor(((revised_target_runs - 1) * used_resource / effective_resource) + 1e-9)
    return max(0, min(revised_target_runs - 1, par))
