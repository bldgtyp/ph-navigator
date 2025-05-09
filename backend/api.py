from fastapi import FastAPI

from features.air_table.routes import router as air_table_router
from features.auth.routes import router as auth_router
from features.hb_model.routes import router as hb_model_router
from features.project.routes import router as project_router
from features.project_browser.routes import router as project_browser_router
from features.assembly.routes import router as assembly


def register_routes(app: FastAPI):
    app.include_router(auth_router)
    app.include_router(air_table_router)
    app.include_router(hb_model_router)
    app.include_router(project_router)
    app.include_router(project_browser_router)
    app.include_router(assembly)
