# Terra Domini — Dev Commands
# Usage: make <target>

.PHONY: up down logs shell migrate seed test lint build

# Start all services
up:
	docker compose -f docker-compose.dev.yml up -d

# Stop all services
down:
	docker compose -f docker-compose.dev.yml down

# Follow logs
logs:
	docker compose -f docker-compose.dev.yml logs -f web

# Django shell
shell:
	docker compose -f docker-compose.dev.yml exec web python manage.py shell

# Run migrations
migrate:
	docker compose -f docker-compose.dev.yml exec web python manage.py migrate

# Generate migrations
makemigrations:
	docker compose -f docker-compose.dev.yml exec web python manage.py makemigrations

# Seed dev data
seed:
	docker compose -f docker-compose.dev.yml exec web python scripts/seed_dev.py

# Run tests
test:
	docker compose -f docker-compose.dev.yml exec web python manage.py test

# Frontend dev server
frontend:
	cd frontend && npm install && npm run dev

# Full dev setup from scratch
setup: up
	@echo "Waiting for postgres..."
	@sleep 15
	@$(MAKE) migrate
	@$(MAKE) seed
	@echo "✅ Dev environment ready!"
	@echo "   Backend: http://localhost:8000"
	@echo "   API docs: http://localhost:8000/api/docs/"
	@echo "   Run 'make frontend' in another terminal for the UI"

# Smoke test
smoke:
	@echo "Testing API health..."
	@curl -sf http://localhost:8000/health/ && echo "✅ Backend OK" || echo "❌ Backend DOWN"
