"""Open the configured database and run a minimal connectivity query."""

from __future__ import annotations

from database import check_connection, close_pool


def main() -> None:
    try:
        if not check_connection():
            raise RuntimeError("Database connectivity check returned a bad row.")
        print("database ok")
    finally:
        close_pool()


if __name__ == "__main__":
    main()
