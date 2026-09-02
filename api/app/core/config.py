from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "NPL API"
    app_environment: str = "development"
    app_release: str | None = None
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/npl"
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"
    # Comma-separated browser origins. Set this in .env / environment.
    cors_origins: str = ""
    # Uploaded media (logos, gallery, etc.). Use an absolute path in Docker and mount a volume there.
    media_root: str = "data/media"
    # Optional origin for absolute URLs returned after upload (e.g. https://api.example.com).
    # If unset, the upload handler uses the incoming request Host (fine for local dev).
    public_base_url: str | None = None
    # Supabase Storage (optional). When all required values are set, uploads are stored in Supabase.
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_storage_bucket: str | None = None
    # Optional folder prefix inside the bucket (e.g. "npl"). Leave empty for bucket root.
    supabase_storage_prefix: str = "uploads"
    # Optional error monitoring. No events are sent unless a DSN is configured.
    sentry_dsn: str | None = None
    sentry_traces_sample_rate: float = 0.0
    # Provider-neutral gateway that fans iOS, Android and Web Push deliveries.
    # If unset, rows remain in the in-app notification inbox/outbox.
    fan_push_gateway_url: str | None = None
    fan_push_gateway_token: str | None = None

    @field_validator("app_environment")
    @classmethod
    def validate_environment(cls, value: str) -> str:
        environment = value.strip().lower()
        allowed = {"development", "test", "ci", "preview", "staging", "production"}
        if environment not in allowed:
            raise ValueError(f"APP_ENVIRONMENT must be one of: {', '.join(sorted(allowed))}")
        return environment

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> object:
        """Heroku Postgres sets DATABASE_URL with postgres:// or postgresql:// without a driver."""
        if not isinstance(value, str):
            return value
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg2://", 1)
        if value.startswith("postgresql://") and not value.startswith("postgresql+"):
            return value.replace("postgresql://", "postgresql+psycopg2://", 1)
        return value

    @field_validator("sentry_traces_sample_rate")
    @classmethod
    def validate_sentry_sample_rate(cls, value: float) -> float:
        if not 0.0 <= value <= 1.0:
            raise ValueError("SENTRY_TRACES_SAMPLE_RATE must be between 0 and 1")
        return value

    @model_validator(mode="after")
    def validate_deployed_secrets(self) -> "Settings":
        storage_values = (
            self.supabase_url,
            self.supabase_service_role_key,
            self.supabase_storage_bucket,
        )
        if any(storage_values) and not all(storage_values):
            raise ValueError(
                "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET must be set together",
            )

        if bool(self.fan_push_gateway_url) != bool(self.fan_push_gateway_token):
            raise ValueError("FAN_PUSH_GATEWAY_URL and FAN_PUSH_GATEWAY_TOKEN must be set together")

        if self.app_environment not in {"staging", "production"}:
            return self

        errors: list[str] = []
        secret = self.secret_key.strip()
        if len(secret) < 32 or "change-me" in secret.lower() or "replace-with" in secret.lower():
            errors.append("SECRET_KEY must be a unique random value of at least 32 characters")

        database_url = self.database_url.lower()
        if "localhost" in database_url or "127.0.0.1" in database_url or "postgres:postgres@" in database_url:
            errors.append("DATABASE_URL must point to a dedicated deployed database")

        origins = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        if not origins or "*" in origins:
            errors.append("CORS_ORIGINS must explicitly list the deployed browser origins")
        if self.app_environment == "production" and any(not origin.startswith("https://") for origin in origins):
            errors.append("Production CORS_ORIGINS must use HTTPS")
        if (
            self.app_environment == "production"
            and self.public_base_url
            and not self.public_base_url.startswith("https://")
        ):
            errors.append("PUBLIC_BASE_URL must use HTTPS in production")
        if (
            self.app_environment == "production"
            and self.fan_push_gateway_url
            and not self.fan_push_gateway_url.startswith("https://")
        ):
            errors.append("FAN_PUSH_GATEWAY_URL must use HTTPS in production")

        if errors:
            raise ValueError("; ".join(errors))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
