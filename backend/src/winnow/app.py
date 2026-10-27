from fastapi import FastAPI

from winnow.core.routes import router as core_router


def create_app() -> FastAPI:
    app = FastAPI(title="Winnow")
    app.include_router(core_router, prefix="/api")
    return app


app = create_app()
