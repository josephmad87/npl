from app.schemas.matches import MatchCreate, MatchUpdate
from app.services.match_toss import build_toss_summary, normalize_toss_summary


def test_build_toss_summary_uses_concise_copy() -> None:
    assert build_toss_summary("Triangle Cricket Club", "bat") == "Triangle Cricket Club opt to bat"
    assert build_toss_summary("Takashinga Patriots 1", "bowl") == "Takashinga Patriots 1 opt to bowl"


def test_normalize_historical_toss_summary() -> None:
    assert (
        normalize_toss_summary(
            "Triangle Cricket Club won the toss and chose to bat first. Triangle Cricket Club batting first.",
        )
        == "Triangle Cricket Club opt to bat"
    )
    assert (
        normalize_toss_summary(
            "Takashinga Patriots 1 won the toss and chose to bowl first. Amakhosi 2 Cricket Club batting first.",
        )
        == "Takashinga Patriots 1 opt to bowl"
    )


def test_match_write_schemas_normalize_recognised_toss_copy() -> None:
    created = MatchCreate(
        category="mens",
        home_team_id=1,
        away_team_id=2,
        toss_info="Home Club won the toss and chose to bat first. Home Club batting first.",
    )
    updated = MatchUpdate(toss_info="Away Club opted to field first.")

    assert created.toss_info == "Home Club opt to bat"
    assert updated.toss_info == "Away Club opt to bowl"
