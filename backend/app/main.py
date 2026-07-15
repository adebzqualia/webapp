from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from . import __version__
from .api import api_router
from .config import get_settings
from .database import SessionLocal, create_schema
from .errors import DomainError, domain_error_handler

logger = logging.getLogger("pops.api")
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.environment.casefold() in {"development", "dev", "test"}:
        create_schema()
    yield


app = FastAPI(
    title=settings.app_name,
    version=__version__,
    description=(
        "Versioned POPS workbook mapping, structural control and consolidation API. "
        "Excel formulas are inspected as text and never evaluated."
    ),
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_exception_handler(DomainError, domain_error_handler)


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled API error on %s", request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={
            "code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred while processing the request",
        },
    )


def _health_payload() -> dict[str, str]:
    database_status = "ok"
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:
        database_status = "unavailable"
    return {"status": "ok" if database_status == "ok" else "degraded", "version": __version__, "database": database_status}


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return _health_payload()


@app.get(f"{settings.api_prefix}/health", tags=["health"])
def api_health() -> dict[str, str]:
    return _health_payload()


app.include_router(api_router, prefix=settings.api_prefix)
