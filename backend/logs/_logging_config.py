import logging
import os
import sys
from logging.handlers import RotatingFileHandler


def handle_uncaught_exception(exc_type, exc_value, exc_traceback):
    """
    Handle uncaught exceptions by logging them with critical level.
    This helps capture any unexpected errors that would otherwise go unlogged.
    """
    # Don't log KeyboardInterrupt (Ctrl+C) as it's expected behavior
    if issubclass(exc_type, KeyboardInterrupt):
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
        return
    
    try:
        logger = logging.getLogger("uncaught_exception_handler")
        logger.critical(
            "Uncaught exception, application may terminate.",
            exc_info=(exc_type, exc_value, exc_traceback),
        )
        # Force flush all handlers to ensure the log gets written
        for handler in logging.getLogger().handlers:
            handler.flush()
    except Exception as e:
        # Fallback to default exception hook if logging fails
        print(f"Error in exception handler: {e}", file=sys.stderr)
        sys.__excepthook__(exc_type, exc_value, exc_traceback)


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
                backupCount=5,  # Keep 5 backup files
                encoding="utf-8",
            ),
        ],
    )
    
    # Test that logging is working after basic config
    test_logger = logging.getLogger("logging_config_test")
    test_logger.info("Logging configuration completed successfully")
    
    # Set up uncaught exception handler
    sys.excepthook = handle_uncaught_exception
    test_logger.info("Uncaught exception handler installed")
