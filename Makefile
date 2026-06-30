.PHONY: up down backend-test frontend-typecheck load-test

up:
	docker compose up --build

down:
	docker compose down -v

backend-test:
	pip install -r backend/requirements.txt
	pytest backend/tests -q

frontend-typecheck:
	cd frontend && npm install && npx tsc --noEmit

load-test:
	python scripts/load_test.py
