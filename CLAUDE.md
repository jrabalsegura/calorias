# Calorías

App web personal (un único usuario) para contar calorías y bajar peso. PWA
mobile-first. Next.js 16 (App Router, server actions) + React 19 + Prisma 6 +
SQLite + Tailwind 3. Interfaz y mensajes en español; identificadores de código
en inglés.

El plan por fases está en `docs/ROADMAP.md`: implementa solo la fase pedida,
sin adelantar trabajo de fases posteriores, y actualiza allí la tabla de estado
y los criterios de aceptación al terminar.

## Comandos

```bash
npm run dev          # Next dev (scripts/start.mjs comprueba AUTH_SECRET), http://localhost:3000
npm run typecheck
npm test             # node --test + tsx: src/**/*.test.ts y tests/*.test.ts
make check           # typecheck + test + build: ejecútalo antes de dar algo por terminado
npm run db:migrate   # prisma migrate dev (crea migración nueva)
npm run user:create  # crea el usuario único o le cambia la contraseña
make container-up    # imagen de producción en Docker Desktop -> http://127.0.0.1:3091
make container-check # smoke test del contenedor
make deploy          # despliega origin/main en el servidor (docs/DEPLOY.md)
```

Un test concreto: `node --import tsx --test --test-name-pattern "session" tests/*.test.ts`.

## Arquitectura

- `src/domain/`: funciones puras con sus tests (`*.test.ts` al lado). Sin
  Prisma ni Next. Aquí van todos los cálculos (objetivo, tendencia,
  conversiones…).
- `src/lib/`: Prisma, sesión (`session.ts`, `auth.ts`), contraseñas.
- `app/(app)/`: pantallas con la barra inferior (*Hoy* `/`, *Peso* `/weight`,
  *Resumen* `/summary`, *Ajustes* `/settings`). `app/login/` va sin barra.
- `app/**/actions.ts`: server actions.
- Objetivo calórico: cálculos en `src/domain/target.ts`; `src/lib/profile.ts`
  carga el `Profile` (fila única) con el peso de tendencia.
  `/settings/profile` es el asistente inicial (sin perfil) y el editor desde
  *Ajustes*; *Hoy* muestra consumidas / objetivo / restantes.
- Peso (`/weight`): un `WeightEntry` por día; tendencia, ritmo real y rangos
  de la gráfica (SVG propio) en `src/domain/weight.ts`.
- Diario (*Hoy*): `/` muestra hoy y `/?day=YYYY-MM-DD` otro día.
  `DiaryEntry` guarda copia del nombre y las kcal; las comidas y sus ids están
  en `src/domain/meals.ts` y las fechas de Madrid en `src/domain/day.ts`.
- Biblioteca: `Food` (kcal por 100 g/ml) y `FoodPortion`; conversiones,
  búsqueda sin tildes, recientes y copias en `src/domain/food.ts`, y la carga
  en `src/lib/foods.ts`. *Añadir* (`/add`, con *Repetir* en `/add/repeat`) es
  la entrada a todos los métodos de registro; *Mis alimentos* en `/foods`.
  `QuantityPicker` y `FoodEntrySheet` son el selector de cantidad común.
- Código de barras (`/add/scan`): normalización y flujo biblioteca → Open
  Food Facts en `src/domain/barcode.ts`, mapeo de OFF en `src/domain/off.ts`
  (fixtures en `tests/fixtures/off/`), petición en `src/lib/openFoodFacts.ts`.
  `BarcodeScanner` usa el `BarcodeDetector` nativo o el polyfill, cuyo wasm
  se sirve desde `public/zxing/` (cópialo al actualizar `barcode-detector`).
- IA (`/add/text`): prompt, esquema JSON, validación y líneas en
  `src/domain/textEstimate.ts`; precios y gasto en `src/domain/aiUsage.ts`;
  la llamada (`requestJson`, que registra cada `AiCall`) en `src/lib/claude.ts`.
  `scripts/eval-text.ts` pasa las descripciones de prueba contra la API real.
- Etiqueta (`/add/label`): esquema, prompt y comprobaciones kJ/kcal/macros
  en `src/domain/label.ts` (respuestas reales en `tests/fixtures/label/`),
  la llamada en `src/lib/labelReading.ts`; la foto se reduce en el móvil
  (`LabelScreen`). `scripts/eval-label.ts` lee fotos de etiquetas de OFF con
  la API real.
- `proxy.ts` (el antiguo middleware; runtime Node): valida la cookie firmada y `sessionVersion`
  contra la BD en cada petición y la renueva (sesión deslizante de 180 días).
  Las rutas públicas (login, health, manifest, iconos, `sw.js`) están en
  `PUBLIC_PATH_PREFIXES`.
- PWA: `app/manifest.ts`, `public/icons/`, `public/apple-touch-icon.png` y
  `public/sw.js` (mínimo, sin caché).

## Convenciones

- Toda server action y toda página con datos empieza con
  `await requireCurrentUser()`.
- Usuario único: no hay registro en la web. `scripts/create-user.ts` crea el
  usuario o cambia su contraseña (incrementa `sessionVersion` y cierra las
  sesiones abiertas).
- Mobile-first: diseña a 375 px de ancho, objetivos táctiles de 48 px, inputs
  con texto de 16 px (evita el zoom de iOS) y respeta
  `env(safe-area-inset-*)`.
- Fechas del diario: `YYYY-MM-DD` en `Europe/Madrid` (el contenedor usa
  `TZ=Europe/Madrid`).

## Base de datos y migraciones

- Nunca edites migraciones ya aplicadas; crea una nueva con
  `npx prisma migrate dev --name <nombre>`. El contenedor aplica
  `prisma migrate deploy` al arrancar.
- Nunca subas `.env` ni `*.db`.

## Producción

Servidor Ubuntu accesible como `ssh remote`: Podman + Quadlet
(`calorias.service`), nginx, `https://calorias.joserabalsegura.com`,
`127.0.0.1:3090`, datos en `/var/lib/calorias/data/calorias.db` y secretos en
`/etc/calorias/app.env`. `sudo` pide contraseña: no ejecutes comandos de
producción sin que el usuario lo pida. Guía completa en `docs/DEPLOY.md`.
