from fastapi import APIRouter

from app.api.v1 import admin_routes, auth, public_routes

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(public_routes.router)
api_router.include_router(admin_routes.router)
