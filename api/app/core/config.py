from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "NPL API"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/npl"
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"
    # Comma-separated browser origins. Production must set real admin/public origins.
    # If empty (e.g. CORS_ORIGINS= in .env), main.py still falls back to localhost:5173 for local dev.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Uploaded media (logos, gallery, etc.). Use an absolute path in Docker and mount a volume there.
    media_root: str = "data/media"
    # Optional origin for absolute URLs returned after upload (e.g. https://api.example.com).
    # If unset, the upload handler uses the incoming request Host (fine for local dev).
    public_base_url: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
