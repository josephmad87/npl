import pytest

from app.services.staging_data import (
    UnsafeStagingTarget,
    assert_safe_staging_target,
    database_name,
)


def test_database_name_is_extracted_without_exposing_credentials() -> None:
    assert database_name("postgresql://person:secret@db.example/npl_staging") == "npl_staging"


def test_confirmation_must_match_exact_database_name() -> None:
    with pytest.raises(UnsafeStagingTarget, match="must exactly match"):
        assert_safe_staging_target(
            "postgresql://person:secret@db.example/npl_staging",
            confirmation="staging",
        )


def test_production_database_cannot_be_used_as_staging() -> None:
    database_url = "postgresql://person:secret@db.example/npl"

    with pytest.raises(UnsafeStagingTarget, match="identical"):
        assert_safe_staging_target(
            database_url,
            confirmation="npl",
            production_database_url=database_url,
        )
