# Calorías

App web personal para contar calorías y bajar peso. PWA mobile-first de un
único usuario, con Next.js, TypeScript, Tailwind CSS, Prisma y SQLite.

El plan y el estado de cada fase están en [docs/ROADMAP.md](docs/ROADMAP.md).

## Requisitos

- Node.js 22.13 o superior (el contenedor usa 22.23.2).
- Docker Desktop para probar la imagen de producción en local.

## Puesta en marcha

```bash
npm install
cp .env.example .env         # y cambia AUTH_SECRET: openssl rand -hex 32
npm run db:migrate           # crea prisma/dev.db con las migraciones
npm run user:create          # crea tu usuario (pide la contraseña)
npm run dev                  # http://localhost:3000
```

Para probar en el móvil dentro de la misma red, abre la dirección *Network*
que muestra `npm run dev`. Instalar la app en la pantalla de inicio y usar la
cámara requieren HTTPS, así que eso se prueba en el servidor.

## Scripts

- `npm run dev`: Next.js en desarrollo.
- `npm test`: tests de dominio y de sesión (`node --test` + `tsx`).
- `npm run typecheck`: TypeScript.
- `npm run db:migrate`: aplica o crea migraciones en desarrollo.
- `npm run user:create [-- usuario]`: crea el usuario o cambia su contraseña.
- `make check`: typecheck, tests y build.

## Contenedor y producción

- `make container-up` / `make container-check` / `make container-down`: la
  imagen de producción en local (`http://127.0.0.1:3091`, datos en
  `.container-data/`).
- `make deploy`: publica `origin/main` en el servidor.
- `make backup-pull`: baja al Mac (`~/Backups/calorias`) las copias diarias
  del servidor y verifica la última; `make backup-schedule` lo programa a
  diario con launchd.

Instalación inicial, actualizaciones, backups y restauración:
[docs/DEPLOY.md](docs/DEPLOY.md). Pautas para Claude Code:
[CLAUDE.md](CLAUDE.md).
