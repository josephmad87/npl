from decimal import Decimal

from app.schemas.matches import LiveScoreCompleteIn, MatchLiveSetupIn


def test_live_match_setup_preserves_match_overs() -> None:
    body = MatchLiveSetupIn(
        toss_winner_team_id=1,
        toss_decision="bat",
        batting_first_team_id=1,
        match_overs="20.0",
    )

    assert body.match_overs == Decimal("20.0")


def test_live_score_complete_preserves_match_overs() -> None:
    body = LiveScoreCompleteIn(status="completed", match_overs="20.0")

    assert body.match_overs == Decimal("20.0")
