CALORIAS_HTTP_PORT ?= 3091
CALORIAS_UID := $(shell id -u)
CALORIAS_GID := $(shell id -g)
CONTAINER_ENV := CALORIAS_HTTP_PORT=$(CALORIAS_HTTP_PORT) CALORIAS_UID=$(CALORIAS_UID) CALORIAS_GID=$(CALORIAS_GID)
DEPLOY_HOST ?= remote
DEPLOY_DIR ?= /var/www/calorias

.PHONY: check container-build container-up container-status container-logs container-check container-down deploy backup-pull backup-schedule backup-unschedule

check:
	npm run typecheck
	npm test
	npm run build

container-build:
	$(CONTAINER_ENV) docker compose build

container-up:
	mkdir -p .container-data
	$(CONTAINER_ENV) docker compose up --build --detach

container-status:
	$(CONTAINER_ENV) docker compose ps

container-logs:
	$(CONTAINER_ENV) docker compose logs --follow app

container-check:
	./deploy/scripts/smoke-test.sh "http://127.0.0.1:$(CALORIAS_HTTP_PORT)"
	$(CONTAINER_ENV) docker compose exec -T app sh -c 'test "$${DATABASE_URL}" = "file:/data/calorias.db" && test "$${SESSION_COOKIE_SECURE}" = "false"'

container-down:
	$(CONTAINER_ENV) docker compose down

# Despliega origin/main en producción. Pide la contraseña de sudo del servidor.
deploy:
	@test "$$(git rev-parse --abbrev-ref HEAD)" = main || (echo "Despliega desde la rama main." && exit 2)
	@test -z "$$(git status --porcelain)" || (echo "Hay cambios sin commitear." && exit 2)
	git fetch origin main
	@test "$$(git rev-parse HEAD)" = "$$(git rev-parse origin/main)" || (echo "main local no coincide con origin/main: haz push o pull primero." && exit 2)
	ssh -t $(DEPLOY_HOST) 'cd $(DEPLOY_DIR) && git pull --ff-only origin main && deploy/scripts/update.sh'

BACKUP_AGENT := $(HOME)/Library/LaunchAgents/com.calorias.backup-pull.plist

# Baja a ~/Backups/calorias las copias exportadas por el servidor y verifica la última.
backup-pull:
	./deploy/scripts/pull-backup.sh

# Programa backup-pull a diario con launchd. launchd no puede leer ~/Desktop ni
# otras carpetas protegidas, así que ejecuta una copia del script en ~/.local/bin.
backup-schedule:
	install -d $(HOME)/.local/bin $(HOME)/Library/LaunchAgents
	install -m 0755 deploy/scripts/pull-backup.sh $(HOME)/.local/bin/calorias-pull-backup
	sed 's|__HOME__|$(HOME)|g' deploy/macos/calorias-backup.plist > $(BACKUP_AGENT)
	-launchctl bootout gui/$$(id -u) $(BACKUP_AGENT) 2>/dev/null
	launchctl bootstrap gui/$$(id -u) $(BACKUP_AGENT)
	@echo "Programado a diario a las 12:05. Log: ~/Library/Logs/calorias-backup.log"

backup-unschedule:
	-launchctl bootout gui/$$(id -u) $(BACKUP_AGENT)
	rm -f $(BACKUP_AGENT) $(HOME)/.local/bin/calorias-pull-backup
