from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import ProgrammingError
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import get_settings

settings = get_settings()

# When CORS_ORIGINS is unset or empty (common in .env templates), still allow local Vite admin.
_DEFAULT_BROWSER_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)

app = FastAPI(
    title=settings.app_name,
    description="Zimbabwe Cricket NPL CMS API (from SRS).",
    version="0.1.0",
    openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    docs_url=f"{settings.api_v1_prefix}/docs",
    redoc_url=f"{settings.api_v1_prefix}/redoc",
)

_cors = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
_allow_origins = list(_cors) if _cors else list(_DEFAULT_BROWSER_ORIGINS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)

_media_root = Path(settings.media_root)
if not _media_root.is_absolute():
    _media_root = Path.cwd() / _media_root
_media_root.mkdir(parents=True, exist_ok=True)
app.mount(
    f"{settings.api_v1_prefix}/media",
    StaticFiles(directory=str(_media_root)),
    name="media",
)


@app.exception_handler(ProgrammingError)
async def programming_error_handler(_request: Request, _exc: ProgrammingError) -> JSONResponse:
    """Return JSON (not uvicorn's plain 500) so CORS headers are applied and the admin UI can read the body."""
    return JSONResponse(
        status_code=503,
        content={
            "code": "database_schema_error",
            "message": "Database tables are missing or out of date. Run: alembic upgrade head",
        },
    )


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
