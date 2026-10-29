from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from winnow.boxes.routes import router as boxes_router
from winnow.core.context import build_context
from winnow.core.routes import router as core_router
from winnow.core.settings import Settings, get_settings
from winnow.dataset.routes import router as dataset_router
from winnow.episodes.routes import router as episodes_router
from winnow.jobs.routes import router as jobs_router
from winnow.meta.transport import Transport
from winnow.selection.routes import router as selection_router
from winnow.sets.routes import router as sets_router


def create_app(settings: Settings | None = None, transport: Transport | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
        ctx = build_context(settings or get_settings(), transport)
        ctx.jobs.fail_interrupted()
        app.state.context = ctx
        yield
        await ctx.runner.shutdown()
        ctx.db.close()

    app = FastAPI(title="Winnow", lifespan=lifespan)
    for router in (
        core_router,
        dataset_router,
        episodes_router,
        boxes_router,
        selection_router,
        sets_router,
        jobs_router,
    ):
        app.include_router(router, prefix="/api")
    return app


app = create_app()
