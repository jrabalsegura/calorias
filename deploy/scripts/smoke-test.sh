#!/bin/sh
set -eu

base_url=${1:-http://127.0.0.1:3091}
temporary_dir=$(mktemp -d "${TMPDIR:-/tmp}/calorias-smoke.XXXXXX")
trap 'rm -rf "$temporary_dir"' EXIT HUP INT TERM

attempt=1
while ! curl --fail --silent --show-error \
  --connect-timeout 2 \
  --max-time 5 \
  "$base_url/api/health" >"$temporary_dir/health.json" \
  2>"$temporary_dir/curl-error"; do
  if [ "$attempt" -ge 30 ]; then
    cat "$temporary_dir/curl-error" >&2
    echo "La aplicación no respondió al healthcheck en 30 intentos." >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 1
done

grep -q '"database":"ok","status":"ok"' "$temporary_dir/health.json" || {
  echo "El healthcheck no está OK: $(cat "$temporary_dir/health.json")" >&2
  exit 1
}

# Sin sesión, la app solo muestra el login.
curl --fail --silent --show-error \
  "$base_url/login" >"$temporary_dir/login.html"
grep -q '<html lang="es">' "$temporary_dir/login.html"
grep -q 'Iniciar sesión' "$temporary_dir/login.html"

redirect=$(curl --silent --output /dev/null --write-out '%{http_code} %{redirect_url}' "$base_url/")
case "$redirect" in
  "307 "*/login) ;;
  *)
    echo "Sin sesión, / debería redirigir al login y responde: $redirect" >&2
    exit 1
    ;;
esac

# El manifest y el service worker deben ser públicos para instalar la PWA.
curl --fail --silent --show-error "$base_url/manifest.webmanifest" \
  | grep -q '"display":"standalone"'
curl --fail --silent --show-error --output /dev/null "$base_url/sw.js"

printf 'Smoke test correcto: %s\n' "$base_url"
