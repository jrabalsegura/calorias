# Despliegue y operación

Mismo esquema que finantialApp: imagen OCI, Podman rootful con Quadlet, nginx
con Certbot y backups diarios de SQLite con copia al Mac.

```text
Mac:
navegador -> 127.0.0.1:3091 -> contenedor Next.js -> ./.container-data/calorias.db

Producción:
Internet -> nginx :443 -> 127.0.0.1:3090 -> contenedor Next.js
                                                   |
                              /var/lib/calorias/data/calorias.db
```

| Dato | Valor |
|---|---|
| Dominio | `calorias.joserabalsegura.com` (ya resuelve a `157.180.32.241`) |
| Puerto local del servidor | `127.0.0.1:3090` (3088, 3089 y 8088 están ocupados) |
| Checkout | `/var/www/calorias` |
| Datos | `/var/lib/calorias/data/calorias.db` (UID/GID `10002`) |
| Secretos | `/etc/calorias/app.env` (`600 root:root`) |
| Servicio | `calorias.service` (Quadlet `/etc/containers/systemd/calorias.container`) |
| Backups | `/var/backups/calorias`, exportados a `~jrabal/calorias-backups` y bajados a `~/Backups/calorias` |

La imagen no contiene `.env` ni ninguna base de datos. Al arrancar valida las
variables, ejecuta `prisma migrate deploy` y solo después inicia Next.js.

## 1. Validación local

Con Docker Desktop iniciado:

```bash
make check
make container-up
make container-check
```

Para entrar en `http://127.0.0.1:3091`, crea un usuario en la copia local:

```bash
docker compose exec app node --import tsx scripts/create-user.ts
```

`make container-down` para el contenedor sin borrar `.container-data/`.

## 2. Instalación inicial en el servidor

Todos los pasos con `sudo` los ejecuta el usuario. Podman, nginx, Certbot y
`sqlite3` ya están instalados por finantialApp.

### Checkout, datos y secreto

```bash
sudo install -d -m 0755 -o "$USER" -g "$USER" /var/www/calorias
git clone https://github.com/jrabalsegura/calorias.git /var/www/calorias

sudo install -d -m 0700 -o 10002 -g 10002 /var/lib/calorias/data
sudo install -d -m 0700 /etc/calorias
sudo install -d -m 0700 /var/backups/calorias

sudo install -m 0600 -o root -g root /dev/null /etc/calorias/app.env
sudoedit /etc/calorias/app.env
```

Contenido de `app.env` (genera el secreto con `openssl rand -hex 32`):

```dotenv
DATABASE_URL=file:/data/calorias.db
AUTH_SECRET=PEGA_AQUI_EL_SECRETO
```

### Imagen, Quadlet y arranque

```bash
cd /var/www/calorias
deploy/scripts/update.sh
```

`update.sh` construye la imagen, la etiqueta como `current`, instala el
Quadlet, arranca `calorias.service` y pasa el smoke test local. El smoke test
público fallará hasta tener nginx y el certificado: es esperado la primera vez.

Comprobar que el generador de Quadlet acepta la unidad y ver el estado:

```bash
sudo env QUADLET_UNIT_DIRS=/etc/containers/systemd \
  /usr/lib/systemd/system-generators/podman-system-generator --dryrun | grep -i unsupported
sudo systemctl status calorias.service
```

### Crear el usuario

```bash
sudo podman exec -it calorias node --import tsx scripts/create-user.ts
```

El mismo comando con el mismo usuario cambia la contraseña y cierra todas las
sesiones abiertas.

### nginx y HTTPS

```bash
cd /var/www/calorias
sudo install -m 0644 deploy/nginx/calorias.conf /etc/nginx/sites-available/calorias
sudo ln -s /etc/nginx/sites-available/calorias /etc/nginx/sites-enabled/calorias
sudo nginx -t
sudo systemctl reload nginx

sudo certbot --nginx --redirect -d calorias.joserabalsegura.com
deploy/scripts/smoke-test.sh https://calorias.joserabalsegura.com
```

Certbot administra desde ahora la copia instalada: las actualizaciones no la
sobrescriben.

### Backups diarios

El backup para la app unos segundos para copiar SQLite de forma coherente,
crea un `tar.gz` con datos y configuración, conserva 14 días y deja una copia
legible por `jrabal` para bajarla al Mac:

```bash
cd /var/www/calorias
sudo install -m 0755 deploy/scripts/calorias-backup /usr/local/sbin/calorias-backup
sudo install -m 0644 deploy/systemd/calorias-backup.service /etc/systemd/system/
sudo install -m 0644 deploy/systemd/calorias-backup.timer /etc/systemd/system/
sudo install -d /etc/systemd/system/calorias-backup.service.d
sudo install -m 0644 deploy/systemd/calorias-backup-export.conf \
  /etc/systemd/system/calorias-backup.service.d/export.conf

sudo systemctl daemon-reload
sudo systemctl enable --now calorias-backup.timer
sudo systemctl start calorias-backup.service
sudo ls -lh /var/backups/calorias ~/calorias-backups
```

El timer se ejecuta a las 04:10 (finantialApp usa las 03:50).

### Copia en el Mac

```bash
make backup-pull       # baja las copias a ~/Backups/calorias y verifica la última
make backup-schedule   # opcional: lo repite a diario a las 12:05 con launchd
```

## 3. Actualizaciones

Desde el Mac, en `main`, limpio y publicado en GitHub:

```bash
make check
make container-up && make container-check
make deploy          # pide la contraseña de sudo del servidor
```

`make deploy` hace `git pull --ff-only` en `/var/www/calorias` y ejecuta
[`deploy/scripts/update.sh`](../deploy/scripts/update.sh), que:

1. construye `localhost/calorias:<commit>` sin parar el servicio;
2. copia SQLite con `.backup` a
   `/var/backups/calorias/pre-deploy-<fecha>-<commit>.db` y verifica su
   integridad;
3. mueve `current` a `rollback` y la imagen nueva a `current`;
4. reinstala el Quadlet, reinicia y pasa el smoke test local y público.

## 4. Rollback y restauración

Si la versión no añadió una migración incompatible, basta con la imagen previa:

```bash
sudo podman tag localhost/calorias:rollback localhost/calorias:current
sudo systemctl restart calorias.service
```

Si hubo migración, restaura también la copia previa al despliegue:

```bash
sudo systemctl stop calorias.service
sudo cp -a /var/lib/calorias/data/calorias.db /var/backups/calorias/failed-$(date -u +%Y%m%dT%H%M%SZ).db
sudo install -m 0600 -o 10002 -g 10002 \
  /var/backups/calorias/pre-deploy-<fecha>-<commit>.db \
  /var/lib/calorias/data/calorias.db
sudo rm -f /var/lib/calorias/data/calorias.db-wal /var/lib/calorias/data/calorias.db-shm
sudo podman tag localhost/calorias:rollback localhost/calorias:current
sudo systemctl start calorias.service
```

Para restaurar desde un backup diario, extrae
`var/lib/calorias/data/calorias.db` del `tar.gz` y sigue los mismos pasos.
