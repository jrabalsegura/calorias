# Artefactos de despliegue

- `containers/`: imagen OCI, entrada con migraciones Prisma y healthcheck.
- `quadlet/`: unidad Podman administrada por systemd.
- `nginx/`: plantilla HTTP inicial del proxy inverso (Certbot añade HTTPS).
- `scripts/`: actualización (`update.sh`), smoke test, backup del servidor y
  descarga de backups al Mac.
- `systemd/`: servicio y timer del backup diario, y drop-in de exportación.
- `macos/`: agente launchd para `make backup-schedule`.

Guía completa en [`docs/DEPLOY.md`](../docs/DEPLOY.md).
