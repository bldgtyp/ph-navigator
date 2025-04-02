# -*- Python Version: 3.11 (Render.com) -*-

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import register_routes

# Configure logging
logging.basicConfig(
    level=logging.INFO,  # Set the logging level
    format="%(levelname)s:     %(asctime)s - %(name)s - %(message)s",  # Log format
    handlers=[
        logging.StreamHandler(),  # Output logs to the console
        logging.FileHandler("app.log", mode="w"),  # Log to a file named "app.log"
    ],
)

# Create a logger for the application
logger = logging.getLogger()

app = FastAPI()

register_routes(app)

origins = [
    "http://localhost:3000",
    "localhost:3000",
    "https://ph-tools.github.io",
    "https://bldgtyp.github.io",
    "https://ph-dash-frontend.onrender.com",
    "https://ph-dash-0cye.onrender.com",
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
