import logging
from logging.handlers import RotatingFileHandler
import os

def configure_logging():
    # Ensure logs directory exists
    os.makedirs("logs", exist_ok=True)
    
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s:     %(asctime)s - %(name)s - %(message)s",
        handlers=[
            logging.StreamHandler(),  # Output logs to the console
            RotatingFileHandler(
                "logs/app.log",
                maxBytes=10485760,  # 10MB per file
                backupCount=5,      # Keep 5 backup files
                encoding="utf-8"
            ),
        ],
    )