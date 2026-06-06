# ph-navigator-v2/Makefile
# All recipes are runnable standalone; this file is the discoverability
# layer for new contributors and LLM agents. Every recipe is
# `cd <subdir> && uv run …` or `cd <subdir> && pnpm …` so it never assumes
# the caller's working directory. See context/environment-setup.md §6.

.PHONY: help setup sync dev backend frontend db db-up db-down db-wait db-reset db-reset-dev \
        object-store-up object-store-init object-store-down \
        db-create-test db-migrate-test \
        migrate makemigration test test-backend test-frontend typecheck \
        lint check ci ci-backend ci-frontend check-backend check-frontend frontend-dev-check build-frontend format format-check \
        smoke seed-dev-user seed-dev-data seed-materials seed-glazing seed-frames db-seed e2e e2e-report clean

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

LOCAL_R2_ENDPOINT_URL ?= http://localhost:9000
LOCAL_R2_ACCESS_KEY_ID ?= phn_minio
LOCAL_R2_SECRET_ACCESS_KEY ?= phn_minio_local_only
LOCAL_R2_BUCKET ?= ph-navigator-v2-dev

dev: db-up object-store-up object-store-init ## Start local services + remind user how to launch backend + frontend
	@echo ""
	@echo "Postgres and local object storage are up. In separate terminals, run:"
	@echo "  make backend   # FastAPI dev server on http://localhost:8000"
	@echo "  make frontend  # Vite dev server  on http://localhost:5173"
	@echo ""

backend: ## Run FastAPI dev server
	cd backend && \
	R2_ENDPOINT_URL="$${R2_ENDPOINT_URL:-$(LOCAL_R2_ENDPOINT_URL)}" \
	R2_ACCESS_KEY_ID="$${R2_ACCESS_KEY_ID:-$(LOCAL_R2_ACCESS_KEY_ID)}" \
	R2_SECRET_ACCESS_KEY="$${R2_SECRET_ACCESS_KEY:-$(LOCAL_R2_SECRET_ACCESS_KEY)}" \
	R2_BUCKET="$${R2_BUCKET:-$(LOCAL_R2_BUCKET)}" \
	uv run uvicorn main:app --reload --port 8000; \
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

db-wait: db-up ## Wait until local Postgres is accepting connections
	@until docker exec phn-v2-postgres pg_isready -U phn -d ph_navigator_v2 >/dev/null 2>&1; do \
		sleep 1; \
	done

object-store-up: ## Start local S3-compatible object storage for attachments
	docker compose up -d object-store

object-store-init: object-store-up ## Create the local attachment bucket + browser CORS policy
	cd backend && \
	R2_ENDPOINT_URL="$(LOCAL_R2_ENDPOINT_URL)" \
	R2_ACCESS_KEY_ID="$(LOCAL_R2_ACCESS_KEY_ID)" \
	R2_SECRET_ACCESS_KEY="$(LOCAL_R2_SECRET_ACCESS_KEY)" \
	R2_BUCKET="$(LOCAL_R2_BUCKET)" \
	uv run python -m scripts.init_object_store

object-store-down: ## Stop local object storage
	docker compose stop object-store

db-reset: ## Destroy and recreate the Postgres volume (DANGER — wipes BOTH dev and test DBs)
	docker compose stop db
	docker compose rm -f db
	docker volume rm ph-navigator-v2_phn_v2_postgres_data 2>/dev/null || true
	docker compose up -d db

db-reset-dev: db-reset db-wait migrate db-seed ## Recreate local Postgres, migrate, and seed starter dev data

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

check: ci ## Alias for the full local CI parity gate

ci: ci-backend ci-frontend ## Run the GitHub Actions CI jobs locally

ci-backend: db-wait db-create-test ## Run the backend GitHub Actions job locally
	cd backend && uv python install 3.11
	cd backend && uv sync --locked
	cd backend && uv run ruff format --check .
	cd backend && uv run ruff check .
	cd backend && uv run ty check
	cd backend && DATABASE_URL="$(TEST_DATABASE_URL)" uv run alembic upgrade head
	cd backend && DATABASE_URL="$(TEST_DATABASE_URL)" uv run pytest

ci-frontend: ## Run the frontend GitHub Actions job locally
	cd frontend && pnpm install --frozen-lockfile
	cd frontend && pnpm run format:check
	cd frontend && pnpm run lint
	cd frontend && pnpm run check:all
	cd frontend && pnpm test
	cd frontend && pnpm run build

check-backend: ci-backend ## Alias for backend CI parity checks

e2e: ## Run Playwright end-to-end tests (frontend must be running)
	cd frontend && pnpm run test:e2e

e2e-report: ## Open the last Playwright HTML report
	cd frontend && pnpm exec playwright show-report

lint: ## Run linters (ruff + eslint)
	cd backend && uv run ruff check .
	cd frontend && pnpm run lint

check-frontend: ci-frontend ## Alias for frontend CI parity checks

frontend-dev-check: ## Fast frontend-only dev gate: format, lint, guards, build; no DB or Vitest
	cd frontend && pnpm run format:check
	cd frontend && pnpm run lint
	cd frontend && pnpm run check:all
	cd frontend && pnpm run build

build-frontend: ## Build the frontend production bundle
	cd frontend && pnpm run build

format: ## Auto-format code
	cd backend && uv run ruff format .
	cd frontend && pnpm run format

format-check: ## Check backend and frontend formatting without writing files
	cd backend && uv run ruff format --check .
	cd frontend && pnpm run format:check

# ─────────────── misc ───────────────

smoke: db-up ## Verify the box is wired up (run after `make setup`)
	cd backend && uv run python -c "import fastapi, psycopg, pydantic; print('backend ok')"
	cd backend && uv run python -m scripts.check_db
	cd frontend && node -e "console.log('frontend ok')"
	docker compose ps db

seed-dev-user: migrate ## Create/reset the default local editor login
	cd backend && uv run python -m scripts.seed_user --email ed@example.com --display-name "Ed May" --password "password"

seed-dev-data: migrate ## Reset app rows and seed the default user + starter project
	cd backend && uv run python -m scripts.seed_dev_db --reset

seed-materials: migrate ## Load the canonical Materials catalog seed (10 rows)
	cd backend && uv run python -m scripts.seed_materials_catalog

seed-glazing: migrate ## Load the canonical Window-Glazing catalog seed (~42 rows)
	cd backend && uv run python -m scripts.seed_glazing_catalog

seed-frames: migrate ## Load the canonical Window-Frame Elements catalog seed (~190 rows)
	cd backend && uv run python -m scripts.seed_frame_catalog

db-seed: seed-dev-data seed-materials seed-glazing seed-frames ## Wipe app tables + seed user, starter project, and all three catalogs from backend/seeds/
	@echo ""
	@echo "Local dev DB seeded from backend/seeds/."

clean: ## Remove caches and build artifacts (does NOT touch .venv or node_modules)
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type d -name .ruff_cache -exec rm -rf {} +
	rm -rf backend/_coverage_html backend/.coverage
	rm -rf frontend/dist frontend/build frontend/.vite
	rm -rf .playwright-mcp playwright-report test-results
