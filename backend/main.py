# -*- Python Version: 3.11 -*-

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import register_routes
from config import settings
from logs._logging_config import configure_logging

configure_logging()
logger = logging.getLogger()

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Welcome to PH-Navigator."}


register_routes(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
