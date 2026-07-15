from fastapi import APIRouter

from .routes import anomalies, consolidations, countries, templates

api_router = APIRouter()
api_router.include_router(templates.router)
api_router.include_router(countries.router)
api_router.include_router(anomalies.router)
api_router.include_router(consolidations.router)
