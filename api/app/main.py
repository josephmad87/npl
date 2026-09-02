from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError, SQLAlchemyError
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.observability import configure_error_monitoring
from app.db.session import engine
from app.services.rate_limit import check_rate_limit

settings = get_settings()
configure_error_monitoring(settings)

app = FastAPI(
    title=settings.app_name,
    description="Zimbabwe Cricket NPL CMS API (from SRS).",
    version="0.1.0",
    openapi_url=None if settings.app_environment == "production" else f"{settings.api_v1_prefix}/openapi.json",
    docs_url=None if settings.app_environment == "production" else f"{settings.api_v1_prefix}/docs",
    redoc_url=None if settings.app_environment == "production" else f"{settings.api_v1_prefix}/redoc",
)

_cors = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]

@app.middleware("http")
async def security_headers(request: Request, call_next):
    try:
        if request.method == "POST":
            path = request.url.path
            prefix = settings.api_v1_prefix
            if path == f"{prefix}/auth/login":
                check_rate_limit(request, scope="auth-login", limit=20, window_seconds=15 * 60)
            elif path == f"{prefix}/auth/refresh":
                check_rate_limit(request, scope="auth-refresh", limit=120, window_seconds=15 * 60)
            elif path == f"{prefix}/public/contact":
                check_rate_limit(request, scope="contact-form", limit=5, window_seconds=60 * 60)
            elif path == f"{prefix}/public/merchandise/orders":
                check_rate_limit(request, scope="merchandise-order", limit=10, window_seconds=60 * 60)
            elif path.startswith(f"{prefix}/public/matches/") and path.endswith("/fan-player-vote"):
                check_rate_limit(request, scope="fan-player-vote", limit=30, window_seconds=60)
            elif path == f"{prefix}/supporters/auth/register":
                check_rate_limit(request, scope="supporter-register", limit=5, window_seconds=60 * 60)
            elif path == f"{prefix}/supporters/auth/login":
                check_rate_limit(request, scope="supporter-login", limit=20, window_seconds=15 * 60)
            elif path == f"{prefix}/supporters/engagement":
                check_rate_limit(request, scope="fan-engagement", limit=120, window_seconds=60)
        response = await call_next(request)
    except HTTPException as exc:
        response = JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=exc.headers,
        )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), geolocation=(), microphone=()"
    if request.url.path.startswith(f"{settings.api_v1_prefix}/media/"):
        response.headers["Content-Security-Policy"] = "default-src 'none'; sandbox"
        response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    if request.url.path.startswith(f"{settings.api_v1_prefix}/auth") or request.url.path.startswith(
        f"{settings.api_v1_prefix}/supporters"
    ):
        response.headers["Cache-Control"] = "no-store"
    public_prefix = f"{settings.api_v1_prefix}/public"
    if request.method == "GET" and response.status_code < 400 and request.url.path.startswith(public_prefix):
        if (
            request.url.path.endswith("/live")
            or request.url.path.endswith("/fan-player-vote")
            or "/merchandise/order-tracking/" in request.url.path
        ):
            response.headers["Cache-Control"] = "no-store"
        elif request.url.path == f"{public_prefix}/homepage":
            response.headers["Cache-Control"] = "public, max-age=30, s-maxage=60, stale-while-revalidate=300"
        elif request.url.path in {
            f"{public_prefix}/navigation",
            f"{public_prefix}/hero-images",
        }:
            response.headers["Cache-Control"] = "public, max-age=300, s-maxage=600, stale-while-revalidate=1800"
        elif request.url.path in {
            f"{public_prefix}/fixtures",
            f"{public_prefix}/results",
        }:
            response.headers["Cache-Control"] = "public, max-age=30, s-maxage=60, stale-while-revalidate=300"
    if settings.app_environment == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# Add CORS last so it remains the outer middleware and includes CORS headers
# on early rate-limit and security responses too.
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(_cors),
    allow_origin_regex=r"^https://[a-z0-9-]+--npl-(website|admin)\.netlify\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Accept", "Authorization", "Content-Type"],
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


@app.get("/health", tags=["health"], include_in_schema=False)
@app.get("/health/live", tags=["health"], include_in_schema=False)
def health_live() -> dict[str, str]:
    """Liveness probe: the API process is running and can answer requests."""
    return {"status": "ok"}


@app.get("/health/ready", tags=["health"], include_in_schema=False)
def health_ready() -> JSONResponse:
    """Readiness probe: the API can make a minimal database query."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "checks": {"database": "failed"}},
        )

    return JSONResponse(
        status_code=200,
        content={"status": "ok", "checks": {"database": "ok"}},
    )
