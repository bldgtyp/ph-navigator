from fastapi import FastAPI

from features.air_table.routes import router as air_table_router
from features.airtightness.routes import router as airtightness_router
from features.aperture.routes.aperture import router as aperture_router
from features.app.routes import router as project_router
from features.assembly.routes.assembly import router as assembly
from features.assembly.routes.layer import router as layer
from features.assembly.routes.material import router as material
from features.assembly.routes.segment import router as segment
from features.auth.routes import router as auth_router
from features.gcp.routes import router as gcp
from features.hb_model.routes import router as hb_model_router
from features.project_browser.routes import router as project_browser_router


def register_routes(app: FastAPI):
    app.include_router(auth_router)
    app.include_router(air_table_router)
    app.include_router(hb_model_router)
    app.include_router(project_router)
    app.include_router(project_browser_router)
    app.include_router(material)
    app.include_router(segment)
    app.include_router(layer)
    app.include_router(assembly)
    app.include_router(gcp)
    app.include_router(airtightness_router)
    app.include_router(aperture_router)
