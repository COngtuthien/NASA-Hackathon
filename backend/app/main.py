"""SpaceFire AI API. Run: uvicorn app.main:app --port 8000 (from backend/)."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1.routes import router
from .core import errors
from .core.config import get_settings


def create_app() -> FastAPI:
    s = get_settings()
    logging.basicConfig(level=s.log_level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    app = FastAPI(
        title="SpaceFire AI API",
        version="1.0.0",
        description="Evidence-grounded microgravity combustion intelligence over NASA PSI datasets "
                    "FLEX (PSI-69), BASS-II (PSI-25) and SAFFIRE-I (PSI-98).",
    )
    app.add_middleware(CORSMiddleware, allow_origins=s.cors_origin_list, allow_methods=["GET", "POST"],
                       allow_headers=["Content-Type", "X-Request-ID"], expose_headers=["X-Request-ID"])
    errors.install(app)
    app.include_router(router)
    return app


app = create_app()
