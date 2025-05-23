import logging


def configure_logging():
    logging.basicConfig(
        level=logging.INFO,  # Set the logging level
        format="%(levelname)s:     %(asctime)s - %(name)s - %(message)s",  # Log format
        handlers=[
            logging.StreamHandler(),  # Output logs to the console
            logging.FileHandler("logs/app.log", mode="w"),  # Log to a file named "app.log"
        ],
    )
