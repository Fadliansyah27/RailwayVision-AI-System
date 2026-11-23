.PHONY: help setup up down logs ps migrate test lint fmt build security-check

PY := .venv/Scripts/python.exe
ifeq ($(OS),)
PY := .venv/bin/python
endif

help:
	@echo "RailwayVision AI — local development targets"
	@echo "  setup          Create .env from example and local Python venv"
	@echo "  up             Build and start the full Docker Compose stack"
	@echo "  down           Stop the stack (keeps volumes)"
	@echo "  logs           Follow service logs"
	@echo "  ps             Show service status"
	@echo "  migrate        Run Alembic migrations inside the api container"
	@echo "  test           Run API, worker, web, and Flutter tests"
	@echo "  lint           Run linters for API, worker, and web"
	@echo "  build          Build API, worker, and web containers"
	@echo "  security-check Run dependency audits"

setup:
	@test -f .env || cp .env.example .env
	py -m venv .venv
	$(PY) -m pip install --upgrade pip
	$(PY) -m pip install -r services/api/requirements-dev.txt -r services/ai-worker/requirements-dev.txt

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

ps:
	docker compose ps

migrate:
	docker compose exec api alembic upgrade head

test:
	cd services/api && ../../$(PY) -m pytest
	cd services/ai-worker && ../../$(PY) -m pytest -c pyproject.toml
	cd apps/web && npm run test
	cd apps/mobile && flutter test

lint:
	cd services/api && ../../$(PY) -m ruff check app tests
	cd services/ai-worker && ../../$(PY) -m ruff check worker tests
	cd apps/web && npm run lint
	cd apps/mobile && flutter analyze

build:
	docker compose build

security-check:
	$(PY) -m pip install --quiet pip-audit
	$(PY) -m pip-audit -r services/api/requirements.txt
	$(PY) -m pip-audit -r services/ai-worker/requirements.txt
	cd apps/web && npm audit --audit-level=high
