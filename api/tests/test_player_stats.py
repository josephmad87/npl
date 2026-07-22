from decimal import Decimal
from types import SimpleNamespace

from app.services.player_stats import recompute_player_career_stats


class _Rows:
    def __init__(self, rows: list[tuple[object, object]]) -> None:
        self._rows = rows

    def all(self) -> list[tuple[object, object]]:
        return self._rows


class _Session:
    def __init__(self, player: object, stats: list[object]) -> None:
        self.player = player
        self.stats = stats

    def get(self, _model: object, _player_id: int) -> object:
        return self.player

    def execute(self, _statement: object) -> _Rows:
        return _Rows([(stat, SimpleNamespace()) for stat in self.stats])

    def scalar(self, _statement: object) -> int:
        return 0


def test_recompute_player_career_stats_includes_all_fielding_credits() -> None:
    player = SimpleNamespace()
    stats = [
        SimpleNamespace(
            match_id=10,
            dismissal="not out",
            runs=12,
            balls_faced=10,
            wickets=0,
            runs_conceded=0,
            overs=Decimal("0.0"),
            catches=2,
            stumpings=1,
            run_outs=1,
        ),
        SimpleNamespace(
            match_id=11,
            dismissal="did not bat",
            runs=0,
            balls_faced=0,
            wickets=0,
            runs_conceded=0,
            overs=Decimal("0.0"),
            catches=1,
            stumpings=2,
            run_outs=3,
        ),
    ]

    recompute_player_career_stats(_Session(player, stats), [1])  # type: ignore[arg-type]

    assert player.catches == 3
    assert player.stumpings == 3
    assert player.run_outs == 4
