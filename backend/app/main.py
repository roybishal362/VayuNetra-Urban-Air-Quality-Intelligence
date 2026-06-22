"""VayuNetra API entrypoint. Routers are mounted as each subsystem comes online."""
from __future__ import annotations

import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import configure_logging, get_logger

configure_logging()
log = get_logger("vayunetra.api")


def _warm_cache() -> None:
    """Best-effort background warm-up: pre-build intelligence for cities whose model is
    already trained. Never trains at boot (that would block) — only warms when artifacts exist."""
    try:
        from app.domain.cities import list_cities
        from app.ml.forecast import ForecastModel
        from app.services.intelligence_service import get_city_intelligence

        for c in list_cities():
            if ForecastModel.load(c.id) is not None:
                get_city_intelligence(c.id)
                log.info("warmed intelligence cache for %s", c.id)
    except Exception as exc:
        log.warning("cache warm failed: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(
        "Starting %s  (env=%s, live_fetch=%s, llm=%s)",
        settings.app_name,
        settings.environment,
        settings.allow_live_fetch,
        settings.llm_enabled,
    )
    threading.Thread(target=_warm_cache, daemon=True).start()
    yield
    log.info("Shutting down %s", settings.app_name)


app = FastAPI(
    title=f"{settings.app_name} API",
    description="Urban Air Quality Intelligence — Monitor, Predict, Attribute, Act.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """QA gate: a failure in any subsystem returns a clean JSON error, never a crash."""
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "internal_error", "detail": str(exc), "path": request.url.path},
    )


@app.get("/health", tags=["system"])
def health():
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": "0.1.0",
        "llm_enabled": settings.llm_enabled,
    }


from app.api.routes import router as api_router  # noqa: E402

app.include_router(api_router)
