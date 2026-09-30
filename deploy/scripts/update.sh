#!/bin/sh
# Actualiza producción con el commit actual del checkout.
# Se ejecuta EN EL SERVIDOR (lo lanza `make deploy` desde el Mac) y pide sudo.
set -eu

cd "$(dirname "$0")/../.."

release=$(git rev-parse --short=12 HEAD)
database=/var/lib/calorias/data/calorias.db
backup_dir=/var/backups/calorias
public_url=${CALORIAS_PUBLIC_URL:-https://calorias.joserabalsegura.com}

if [ -n "$(git status --porcelain)" ]; then
  echo "El checkout del servidor tiene cambios locales; revísalos antes de desplegar." >&2
  exit 1
fi

echo "==> Construyendo imagen $release (el servicio sigue activo)"
sudo podman build --pull=always \
  --file deploy/containers/app.Containerfile \
  --tag "localhost/calorias:$release" \
  .

backup="$backup_dir/pre-deploy-$(date -u +%Y%m%dT%H%M%SZ)-$release.db"
sudo install -d -m 0700 "$backup_dir"
# En el primer despliegue aún no hay base: sqlite3 crearía una vacía de root.
if sudo test -f "$database"; then
  echo "==> Copia previa de SQLite: $backup"
  sudo sqlite3 "$database" ".timeout 5000" ".backup '$backup'"
  test "$(sudo sqlite3 "$backup" 'PRAGMA integrity_check;')" = "ok"
else
  echo "==> Sin base de datos todavía: no hay copia previa"
  backup="(ninguna)"
fi

echo "==> Moviendo current -> rollback y $release -> current"
if sudo podman image exists localhost/calorias:current; then
  sudo podman tag localhost/calorias:current localhost/calorias:rollback
fi
sudo podman tag "localhost/calorias:$release" localhost/calorias:current

echo "==> Instalando Quadlet y reiniciando"
sudo install -m 0644 \
  deploy/quadlet/calorias.container \
  /etc/containers/systemd/calorias.container
sudo systemctl daemon-reload
sudo systemctl restart calorias.service

deploy/scripts/smoke-test.sh http://127.0.0.1:3090
deploy/scripts/smoke-test.sh "$public_url"

cat <<EOF

Desplegado $release. Copia previa: $backup

Rollback de imagen (si no hubo migración incompatible):
  sudo podman tag localhost/calorias:rollback localhost/calorias:current
  sudo systemctl restart calorias.service
EOF
