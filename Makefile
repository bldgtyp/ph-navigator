# ph-navigator-v2/Makefile
# All recipes are runnable standalone; this file is the discoverability
# layer for new contributors and LLM agents. Every recipe is
# `cd <subdir> && uv run …` or `cd <subdir> && pnpm …` so it never assumes
# the caller's working directory. See context/environment-setup.md §6.

.PHONY: help setup sync dev backend frontend db db-up db-down db-reset \
        db-create-test db-migrate-test \
        migrate makemigration test test-backend test-frontend typecheck \
        lint format smoke seed-dev-user e2e e2e-report clean

# Local Postgres URL for the dedicated pytest database. Mirrors the dev
# URL in backend/.env.example with the database name swapped to *_test.
TEST_DATABASE_URL ?= postgresql://phn:phn_local_only@localhost:5433/ph_navigator_v2_test

help: ## Show available recipes
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / \
	{printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ─────────────── setup ───────────────

setup: ## First-time setup (Python, Node, env files)
	cd backend && uv python install 3.11 && uv sync
	cd frontend && pnpm install
	test -f backend/.env || cp backend/.env.example backend/.env
	test -f frontend/.env.local || cp frontend/.env.example frontend/.env.local

sync: ## Re-sync Python and Node deps from lockfiles
	cd backend && uv sync
	cd frontend && pnpm install --frozen-lockfile

# ─────────────── daily dev ───────────────

dev: db-up ## Start Postgres + remind user how to launch backend + frontend
	@echo ""
	@echo "Postgres is up. In separate terminals, run:"
	@echo "  make backend   # FastAPI dev server on http://localhost:8000"
	@echo "  make frontend  # Vite dev server  on http://localhost:5173"
	@echo ""

backend: ## Run FastAPI dev server
	cd backend && uv run uvicorn main:app --reload --port 8000; \
	exit_code=$$?; \
	if [ $$exit_code -eq 130 ]; then \
		exit 0; \
	fi; \
	exit $$exit_code

frontend: ## Run Vite dev server
	cd frontend && pnpm run dev; \
	exit_code=$$?; \
	if [ $$exit_code -eq 130 ]; then \
		exit 0; \
	fi; \
	exit $$exit_code

# ─────────────── database ───────────────

db-up: ## Start Postgres container
	docker compose up -d db

db-down: ## Stop Postgres container
	docker compose stop db

db: db-up ## Alias for db-up

db-reset: ## Destroy and recreate the Postgres volume (DANGER — wipes BOTH dev and test DBs)
	docker compose down -v
	docker compose up -d db

db-create-test: db-up ## Create the ph_navigator_v2_test database if missing (idempotent)
	@docker exec phn-v2-postgres sh -c '\
		psql -U phn -d ph_navigator_v2 -tAc \
		  "SELECT 1 FROM pg_database WHERE datname = '"'"'ph_navigator_v2_test'"'"'" \
		| grep -q 1 \
		|| psql -U phn -d ph_navigator_v2 -v ON_ERROR_STOP=1 -c \
		     "CREATE DATABASE ph_navigator_v2_test OWNER phn"'

db-migrate-test: db-create-test ## Apply Alembic migrations to the test database
	cd backend && DATABASE_URL="$(TEST_DATABASE_URL)" uv run alembic upgrade head

migrate: ## Apply Alembic migrations to head (dev database)
	cd backend && uv run alembic upgrade head

makemigration: ## Generate new empty Alembic migration ('make makemigration name=add_foo')
	cd backend && uv run alembic revision -m "$(name)"

# ─────────────── tests + quality ───────────────

test: test-backend test-frontend ## Run all unit / integration tests

test-backend: db-migrate-test ## Run backend tests against the dedicated *_test DB
	cd backend && DATABASE_URL="$(TEST_DATABASE_URL)" uv run pytest

test-frontend:
	cd frontend && pnpm test

typecheck: ## Run backend static type checker
	cd backend && uv run ty check

e2e: ## Run Playwright end-to-end tests (frontend must be running)
	cd frontend && pnpm run test:e2e

e2e-report: ## Open the last Playwright HTML report
	cd frontend && pnpm exec playwright show-report

lint: ## Run linters (ruff + eslint)
	cd backend && uvx ruff check .
	cd frontend && pnpm run lint

format: ## Auto-format code
	cd backend && uvx ruff format .
	cd frontend && pnpm run format

# ─────────────── misc ───────────────

smoke: db-up ## Verify the box is wired up (run after `make setup`)
	cd backend && uv run python -c "import fastapi, psycopg, pydantic; print('backend ok')"
	cd backend && uv run python -m scripts.check_db
	cd frontend && node -e "console.log('frontend ok')"
	docker compose ps db

seed-dev-user: migrate ## Create/reset the default local editor login
	cd backend && uv run python -m scripts.seed_user --email ed@example.com --display-name "Ed May" --password "password"

clean: ## Remove caches and build artifacts (does NOT touch .venv or node_modules)
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type d -name .ruff_cache -exec rm -rf {} +
	rm -rf backend/_coverage_html backend/.coverage
	rm -rf frontend/dist frontend/build frontend/.vite
	rm -rf .playwright-mcp playwright-report test-results
