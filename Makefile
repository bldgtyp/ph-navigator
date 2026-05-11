# ph-navigator-v2/Makefile
# All recipes are runnable standalone; this file is the discoverability
# layer for new contributors and LLM agents. Every recipe is
# `cd <subdir> && uv run …` or `cd <subdir> && npm …` so it never assumes
# the caller's working directory. See context/environment-setup.md §6.

.PHONY: help setup sync dev backend frontend db db-up db-down db-reset \
        migrate makemigration test test-backend test-frontend \
        lint format smoke e2e clean

help: ## Show available recipes
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / \
	{printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ─────────────── setup ───────────────

setup: ## First-time setup (Python, Node, env files)
	cd backend && uv python install 3.11 && uv sync
	cd frontend && npm install
	test -f backend/.env || cp backend/.env.example backend/.env
	test -f frontend/.env.local || cp frontend/.env.example frontend/.env.local

sync: ## Re-sync Python and Node deps from lockfiles
	cd backend && uv sync
	cd frontend && npm ci

# ─────────────── daily dev ───────────────

dev: db-up ## Start Postgres + remind user how to launch backend + frontend
	@echo ""
	@echo "Postgres is up. In separate terminals, run:"
	@echo "  make backend   # FastAPI dev server on http://localhost:8000"
	@echo "  make frontend  # Vite dev server  on http://localhost:5173"
	@echo ""

backend: ## Run FastAPI dev server
	cd backend && uv run uvicorn main:app --reload --port 8000

frontend: ## Run Vite dev server
	cd frontend && npm run dev

# ─────────────── database ───────────────

db-up: ## Start Postgres container
	docker compose up -d db

db-down: ## Stop Postgres container
	docker compose stop db

db: db-up ## Alias for db-up

db-reset: ## Destroy and recreate the Postgres volume (DANGER — local only)
	docker compose down -v
	docker compose up -d db

migrate: ## Apply Alembic migrations to head
	cd backend && uv run alembic upgrade head

makemigration: ## Generate new empty Alembic migration ('make makemigration name=add_foo')
	cd backend && uv run alembic revision -m "$(name)"

# ─────────────── tests + quality ───────────────

test: test-backend test-frontend ## Run all unit / integration tests

test-backend:
	cd backend && uv run pytest

test-frontend:
	cd frontend && npm test

e2e: ## Run Playwright end-to-end tests (frontend must be running)
	cd frontend && npm run test:e2e

lint: ## Run linters (ruff + eslint)
	cd backend && uvx ruff check .
	cd frontend && npm run lint

format: ## Auto-format code
	cd backend && uvx ruff format .
	cd frontend && npm run format

# ─────────────── misc ───────────────

smoke: ## Verify the box is wired up (run after `make setup`)
	cd backend && uv run python -c "import fastapi, psycopg, pydantic; print('backend ok')"
	cd frontend && node -e "console.log('frontend ok')"
	docker compose ps db

clean: ## Remove caches and build artifacts (does NOT touch .venv or node_modules)
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type d -name .ruff_cache -exec rm -rf {} +
	rm -rf backend/_coverage_html backend/.coverage
	rm -rf frontend/dist frontend/build frontend/.vite
	rm -rf .playwright-mcp playwright-report test-results
