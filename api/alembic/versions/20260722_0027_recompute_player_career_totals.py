"""Recompute every stored player career total from completed scorecards.

Revision ID: 20260722_0027
Revises: 20260722_0026
Create Date: 2026-07-22
"""

from alembic import op


revision = "20260722_0027"
down_revision = "20260722_0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        WITH completed_stats AS (
            SELECT
                match_player_stats.*,
                LOWER(TRIM(COALESCE(match_player_stats.dismissal, ''))) AS dismissal_key,
                CASE
                    WHEN match_player_stats.overs IS NULL OR match_player_stats.overs <= 0 THEN 0
                    ELSE
                        TRUNC(match_player_stats.overs)::INTEGER * 6
                        + LEAST(
                            5,
                            TRUNC(
                                (match_player_stats.overs - TRUNC(match_player_stats.overs)) * 10
                            )::INTEGER
                        )
                END AS bowling_balls
            FROM match_player_stats
            JOIN matches ON matches.id = match_player_stats.match_id
            WHERE matches.status = 'completed'
        ),
        career AS (
            SELECT
                players.id AS player_id,
                COUNT(DISTINCT completed_stats.match_id)::INTEGER AS matches_played,
                COALESCE(SUM(
                    CASE WHEN completed_stats.dismissal_key <> 'did not bat'
                        THEN completed_stats.runs ELSE 0 END
                ), 0)::INTEGER AS runs_scored,
                COALESCE(SUM(
                    CASE WHEN completed_stats.dismissal_key <> 'did not bat'
                        THEN completed_stats.balls_faced ELSE 0 END
                ), 0)::INTEGER AS balls_faced,
                COUNT(*) FILTER (
                    WHERE completed_stats.dismissal_key <> ''
                      AND completed_stats.dismissal_key NOT IN (
                          'not out', 'retired hurt', 'did not bat'
                      )
                )::INTEGER AS outs,
                NULLIF(COALESCE(MAX(
                    CASE WHEN completed_stats.dismissal_key <> 'did not bat'
                        THEN completed_stats.runs ELSE 0 END
                ), 0), 0)::INTEGER AS highest_score,
                COALESCE(SUM(completed_stats.wickets), 0)::INTEGER AS wickets_taken,
                COALESCE(SUM(completed_stats.runs_conceded), 0)::INTEGER AS runs_conceded,
                COALESCE(SUM(completed_stats.bowling_balls), 0)::INTEGER AS bowling_balls,
                COALESCE(SUM(completed_stats.catches), 0)::INTEGER AS catches,
                COALESCE(SUM(completed_stats.stumpings), 0)::INTEGER AS stumpings,
                COALESCE(SUM(completed_stats.run_outs), 0)::INTEGER AS run_outs
            FROM players
            LEFT JOIN completed_stats ON completed_stats.player_id = players.id
            GROUP BY players.id
        ),
        best_bowling AS (
            SELECT DISTINCT ON (completed_stats.player_id)
                completed_stats.player_id,
                completed_stats.wickets::TEXT || '/' || completed_stats.runs_conceded::TEXT AS value
            FROM completed_stats
            WHERE completed_stats.wickets > 0
            ORDER BY
                completed_stats.player_id,
                completed_stats.wickets DESC,
                completed_stats.runs_conceded ASC
        ),
        awards AS (
            SELECT
                match_results.player_of_match_player_id AS player_id,
                COUNT(*)::INTEGER AS player_of_match_awards
            FROM match_results
            JOIN matches ON matches.id = match_results.match_id
            WHERE matches.status = 'completed'
              AND match_results.player_of_match_player_id IS NOT NULL
            GROUP BY match_results.player_of_match_player_id
        )
        UPDATE players
        SET
            matches_played = career.matches_played,
            runs_scored = career.runs_scored,
            batting_average = CASE WHEN career.outs > 0
                THEN ROUND(career.runs_scored::NUMERIC / career.outs, 2)::DOUBLE PRECISION
                ELSE NULL END,
            strike_rate = CASE WHEN career.balls_faced > 0
                THEN ROUND(career.runs_scored::NUMERIC * 100 / career.balls_faced, 2)::DOUBLE PRECISION
                ELSE NULL END,
            highest_score = career.highest_score,
            wickets_taken = career.wickets_taken,
            bowling_average = CASE WHEN career.wickets_taken > 0
                THEN ROUND(career.runs_conceded::NUMERIC / career.wickets_taken, 2)::DOUBLE PRECISION
                ELSE NULL END,
            economy_rate = CASE WHEN career.bowling_balls > 0
                THEN ROUND(career.runs_conceded::NUMERIC * 6 / career.bowling_balls, 2)::DOUBLE PRECISION
                ELSE NULL END,
            best_bowling = best_bowling.value,
            catches = career.catches,
            stumpings = career.stumpings,
            run_outs = career.run_outs,
            player_of_match_awards = COALESCE(awards.player_of_match_awards, 0)
        FROM career
        LEFT JOIN best_bowling ON best_bowling.player_id = career.player_id
        LEFT JOIN awards ON awards.player_id = career.player_id
        WHERE players.id = career.player_id
        """
    )


def downgrade() -> None:
    # These columns are derived from scorecards, so stale values are not restored.
    pass
