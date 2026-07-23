"""ICC DLS Standard Edition calculations for interrupted limited-overs matches.

The ICC distributes the current Professional Edition calculator separately.
These helpers implement the ICC-published Standard Edition fallback: its
resource table, revised-target formula, and live par-score schedule.
"""

from decimal import Decimal
from math import exp, floor


# Parameters fitted to the ICC's published ball-by-ball Standard Edition table.
# Standard Edition calculations use the table's published one-decimal values.
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
    return round(asymptote * (1 - exp((-decay * overs) / asymptote)), 1)


def revised_resource_percentage(
    *,
    effective_resource_percentage: Decimal | float | None,
    previous_allotted_balls: int,
    revised_allotted_balls: int,
    legal_balls: int,
    wickets_lost: int,
) -> float:
    """Return the innings resource after changing its allotted length.

    Resource lost at an interruption is the difference between the resources
    remaining immediately before and after the revision. Passing the previously
    saved effective resource supports more than one interruption in an innings.
    """

    if legal_balls < 0 or revised_allotted_balls < legal_balls:
        raise ValueError("Revised overs cannot be less than the legal balls already bowled.")

    effective_resource = (
        float(effective_resource_percentage)
        if effective_resource_percentage is not None
        else dls_resource_percentage(previous_allotted_balls, 0)
    )
    previous_remaining = dls_resource_percentage(
        max(0, previous_allotted_balls - legal_balls),
        wickets_lost,
    )
    revised_remaining = dls_resource_percentage(
        max(0, revised_allotted_balls - legal_balls),
        wickets_lost,
    )
    revised_resource = effective_resource - (previous_remaining - revised_remaining)
    return round(max(revised_remaining, revised_resource), 3)


def dls_g50_for_category(category: str) -> int:
    """Return the ICC Standard Edition average 50-over score for a match."""

    normalized = category.strip().lower()
    if normalized in {"mens", "men", "male", "senior_mens", "senior-men"}:
        return 245
    return 200


def dls_revised_target(
    *,
    first_innings_runs: int,
    team1_resource_percentage: Decimal | float,
    team2_resource_percentage: Decimal | float,
    g50: int,
) -> int:
    """Calculate the winning target using the published ICC DLS formula."""

    resource_1 = float(team1_resource_percentage)
    resource_2 = float(team2_resource_percentage)
    if first_innings_runs < 0:
        raise ValueError("First-innings runs cannot be negative.")
    if resource_1 <= 0 or resource_2 < 0:
        raise ValueError("DLS resource percentages must be positive.")
    if g50 <= 0:
        raise ValueError("G50 must be positive.")

    if resource_2 < resource_1:
        target_score = floor(first_innings_runs * resource_2 / resource_1)
    elif resource_2 > resource_1:
        target_score = floor(
            first_innings_runs + ((resource_2 - resource_1) * g50 / 100),
        )
    else:
        target_score = first_innings_runs
    return target_score + 1


def dls_par_score(
    *,
    revised_target_runs: int | None,
    allotted_overs: Decimal | float | int | str,
    legal_balls: int,
    wickets_lost: int,
    effective_resource_percentage: Decimal | float | None = None,
    first_innings_runs: int | None = None,
    team1_resource_percentage: Decimal | float | None = None,
    g50: int | None = None,
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
    if (
        first_innings_runs is not None
        and team1_resource_percentage is not None
        and g50 is not None
    ):
        resource_1 = float(team1_resource_percentage)
        if used_resource < resource_1:
            par = floor((first_innings_runs * used_resource / resource_1) + 1e-9)
        elif used_resource > resource_1:
            par = floor(
                first_innings_runs + ((used_resource - resource_1) * g50 / 100) + 1e-9,
            )
        else:
            par = first_innings_runs
    else:
        par = floor(((revised_target_runs - 1) * used_resource / effective_resource) + 1e-9)
    return max(0, min(revised_target_runs - 1, par))
