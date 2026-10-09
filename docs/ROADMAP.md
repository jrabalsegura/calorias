# Calorías — Roadmap por fases

App web personal (un único usuario) para contar calorías y bajar peso. Lo que la
hace distinta es la flexibilidad para apuntar lo que comes: código de barras,
foto de la etiqueta, descripción en texto libre (“100 g de arroz y un filete de
pollo”) o a mano. El objetivo diario se calcula según el ritmo al que quieras
bajar y, con unas semanas de datos, se reajusta a tu gasto real.

> Cada fase se implementa en su propia rama, se valida (`make check` y prueba
> real en el móvil) y se integra antes de empezar la siguiente. No se adelanta
> trabajo de fases posteriores aunque parezca conveniente.

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Cimientos y despliegue | Hecha |
| 2 | Diario manual | Hecha |
| 3 | Perfil y objetivo calórico | Hecha |
| 4 | Peso y progreso | Hecha |
| 5 | Biblioteca de alimentos y cantidades | Hecha |
| 6 | Código de barras | Hecha |
| 7 | Descripción en texto (IA) | Hecha |
| 8 | Foto de la etiqueta (IA) | Implementada (falta desplegar) |
| 9 | Resumen semanal y objetivo adaptativo | Pendiente |
| 10 | Calidad de vida | Pendiente |

Hitos:

- Tras la **fase 4** ya sirve para el día a día: apuntar a mano, con objetivo y
  con peso.
- Tras la **fase 6** registrar productos envasados es tan rápido como en
  cualquier app de calorías.
- Tras la **fase 7** también los platos caseros y los alimentos sin envase.
- Tras la **fase 8** están todas las formas de registrar.

## Funcionalidades

**Registrar comida**

- A mano: nombre y kcal, en segundos.
- Desde tu biblioteca: buscador, recientes, favoritos y repetir comidas de otros
  días.
- Código de barras: cámara del móvil → Open Food Facts.
- Descripción en texto (“2 huevos fritos, 60 g de pan y un café con leche”): la
  IA la desglosa y tú ajustas las cantidades antes de guardar.
- Foto de la etiqueta nutricional: la IA lee los valores y tú los confirmas.

**Objetivo y seguimiento**

- Calculadora del objetivo diario según tus datos, tu actividad y el ritmo de
  pérdida elegido, con límites de seguridad y fecha estimada.
- Registro de peso con gráfica de tendencia y progreso hacia el peso objetivo.
- Resumen semanal: media diaria, días dentro del objetivo y evolución.
- Objetivo adaptativo: estima tu gasto real a partir de tu peso y de lo que
  comes, y propone reajustar el objetivo en un check-in semanal.

## Principios de diseño

1. **Registrar tiene que ser rapidísimo.** Lo habitual, en 2-3 toques.
2. **Un único embudo.** Todos los métodos acaban igual: un alimento (guardado o
   puntual) con kcal por 100 g/ml → una cantidad → una entrada del diario. Cada
   fase reutiliza el selector de cantidad y el diario de las anteriores. La
   entrada rápida a mano es el único atajo.
3. **La IA propone, tú confirmas.** Nada que venga de la IA se guarda sin pasar
   por una pantalla de revisión editable que muestre los supuestos (tamaño de
   ración, aceite de cocinado…).
4. **Lo aprendido se guarda.** Un producto escaneado o una etiqueta leída se
   queda en tu biblioteca: la próxima vez es instantáneo y no gasta IA.
5. **El historial no cambia solo.** Cada entrada guarda una copia de su nombre y
   sus kcal; editar un alimento no reescribe los días pasados.
6. **El peso se lee como tendencia**, no como el número del día, para que las
   oscilaciones de agua no desanimen.
7. **Solo calorías en la interfaz.** Si una fuente trae proteína, hidratos y
   grasa (etiqueta, Open Food Facts), se guardan sin mostrarlos: sirven para
   validar lecturas y dejan la puerta abierta a los macros.

## Decisiones técnicas

| Tema | Decisión |
|---|---|
| Tipo de app | PWA mobile-first: funciona en el navegador y se instala en la pantalla de inicio. Un único usuario. |
| Stack | El de finantialApp (`~/Desktop/finantialApp`): Next.js (App Router, server actions) + React + TypeScript + Prisma + SQLite + Tailwind. Interfaz en español; código en inglés. |
| Acceso | Login de usuario único con cookie de sesión firmada, adaptado de `src/lib/session.ts`, `src/lib/password.ts` y `middleware.ts` de finantialApp. Sesión larga para no tener que entrar cada vez desde el móvil. |
| Despliegue | Como finantialApp: Containerfile + Quadlet + nginx en `remote`. Propuesta: `calorias.joserabalsegura.com`, `127.0.0.1:3090` (3088, 3089 y 8088 ya están ocupados), datos en `/var/lib/calorias/data/calorias.db` y secretos en `/etc/calorias/app.env`. |
| Copias | Copia de SQLite antes de cada despliegue, timer diario en el servidor y `make backup-pull` al Mac, con el mismo esquema que finantialApp. |
| Código de barras | API `BarcodeDetector` con el polyfill `barcode-detector` (ZXing en WebAssembly) para Safari. La cámara exige HTTPS. |
| Productos | Open Food Facts: gratis, abierta y con buena cobertura en España. Se consulta desde el servidor con un User-Agent propio (lo piden) y se cachea en la BD. |
| IA | API de Claude desde el servidor con `@anthropic-ai/sdk`: texto para descripciones, visión para etiquetas y siempre salida JSON con esquema. Modelo por defecto `claude-sonnet-5-5` con esfuerzo `low`, configurables por variable de entorno (`ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`). La API key nunca llega al navegador. |
| Fechas | El día del diario se guarda como `YYYY-MM-DD`, en zona `Europe/Madrid`. |
| Dominio | Los cálculos (objetivo, tendencia, gasto adaptativo, conversiones) son funciones puras con tests en `src/domain/`. |

### Coste de la IA (orientativo, precios de septiembre de 2026)

Claude Sonnet 5.5 cuesta 2 $ por millón de tokens de entrada y 10 $ por millón
de salida (Opus 5.5, el doble).

| Uso | Coste aproximado |
|---|---|
| Desglosar una descripción (medido en la fase 7: ~1.700 tokens de entrada y 100-300 de salida) | ~0,5 céntimos de dólar |
| Leer una etiqueta (medido en la fase 8: foto de 1.500 px, ~3.000-3.700 tokens de entrada y ~100 de salida) | ~0,8 céntimos de dólar |
| Uso diario personal (unas 3 descripciones al día y alguna etiqueta) | **menos de 1 $ al mes** |

Cada etiqueta se lee una sola vez, porque el producto queda guardado. Se puede
probar Opus 5.5 o Haiku 5.5 cambiando `ANTHROPIC_MODEL`; *Ajustes* muestra el
gasto del mes. Conviene fijar un límite de gasto mensual en la consola de
Anthropic.

## Modelo de datos (orientativo)

Cada tabla se crea en la fase que la necesita:

| Tabla | Contenido | Fase |
|---|---|---|
| `AppUser` | Usuario único y versión de sesión | 1 |
| `DiaryEntry` | Día, comida, nombre, cantidad y unidad (opcionales), kcal (copia), `foodId` opcional, origen (`manual`, `library`, `barcode`, `text`, `label`) y nota | 2 |
| `Profile` | Sexo, fecha de nacimiento, altura, actividad, peso objetivo, ritmo y objetivo manual opcional | 3 |
| `WeightEntry` | Día (único) y kg | 3-4 |
| `Food` | Nombre, marca, código de barras (único, opcional), unidad base (`g`/`ml`), kcal por 100, macros opcionales sin interfaz, origen, favorito y último uso | 5 |
| `FoodPortion` | Porciones con nombre (“1 rebanada = 30 g”) | 5 |
| `WeeklyCheckIn` | Gasto estimado, objetivo anterior y propuesto, y si se aceptó | 9 |

---

## Fase 1 — Cimientos y despliegue

### Objetivo

Tener el esqueleto desplegado en el servidor, con HTTPS y login, siguiendo el
mismo proceso que finantialApp, antes de escribir ninguna funcionalidad. Así,
desde la fase 2 se puede usar en el móvil, y la cámara (que exige HTTPS) se
prueba en real.

### Alcance

- `git init`, repositorio remoto (el servidor despliega con `git pull`),
  `.gitignore`, `.env.example`, `README.md`, `CLAUDE.md` y `Makefile` (`check`,
  `container-up`, `container-check`, `deploy`, `backup-pull`).
- Next.js + TypeScript + Tailwind + Prisma con SQLite y migración inicial.
- Login de usuario único adaptado de finantialApp (hash de contraseña, cookie
  firmada, middleware y sesión larga) y script para crear el usuario.
- Navegación mobile-first con barra inferior: *Hoy*, *Peso*, *Resumen* y
  *Ajustes* (pantallas vacías).
- PWA: manifest, iconos provisionales, `theme-color` y service worker mínimo.
- `/api/health`, tests de ejemplo (`node --test` + `tsx`) y `make check`.
- Containerfile, `compose.yaml` local, Quadlet, plantilla de nginx,
  `update.sh`, smoke test, backup diario y `make backup-pull`, adaptados de
  finantialApp.
- DNS y certificado del subdominio, y `/etc/calorias/app.env` en el servidor.
  Los pasos con `sudo` en el servidor los ejecuta el usuario, o se hacen solo
  cuando él lo pida.

### Fuera de alcance

- Cualquier funcionalidad de calorías.

### Criterios de aceptación

- [x] `make check` pasa en un checkout limpio.
- [x] `make deploy` publica la app en el subdominio con HTTPS; sin sesión solo
      se ve el login.
- [x] La app se instala en la pantalla de inicio del móvil, abre a pantalla
      completa y mantiene la sesión.
- [x] El backup diario se genera en el servidor y `make backup-pull` lo baja al
      Mac.

Verificado en local (30-09-2026): `make check` en un clon limpio; en vista
móvil, login (error y redirección a `next`), navegación inferior, cierre de
sesión y registro del service worker; la imagen de producción con
`make container-check`, el script de usuario dentro del contenedor, la cookie
de 180 días renovada en cada petición, la revocación de sesiones al cambiar la
contraseña y el script de backup sobre un árbol simulado.

Instalada en `remote` el 30-09-2026 (`docs/DEPLOY.md`, §2): HTTPS con Certbot,
HTTP redirige a HTTPS y, sin sesión, cualquier ruta lleva al login. El timer
de backup está activo, el primer backup se exportó y `make backup-pull` lo
bajó a `~/Backups/calorias` y pasó `integrity_check`; `make backup-schedule`
lo repite a diario. Probada en el móvil: se instala, abre a pantalla completa y
mantiene la sesión.

---

## Fase 2 — Diario manual

### Objetivo

Apuntar lo que comes a mano y ver el total del día. Es la base a la que se
enganchan los demás métodos.

### Alcance

- Pantalla *Hoy* con el total del día y una sección por comida, cada una con su
  subtotal: desayuno, almuerzo, comida, merienda, cena y picoteo.
- Entrada rápida en una comida: nombre (opcional) y kcal. La comida se
  preselecciona según la hora.
- Editar, borrar y mover una entrada a otra comida.
- Navegar entre días: anterior/siguiente, selector de fecha y botón para volver
  a hoy.
- `DiaryEntry` ya preparado para las fases siguientes (origen, `foodId`
  opcional y copia de valores).

### Fuera de alcance

- Objetivo calórico, alimentos guardados y búsqueda.

### Criterios de aceptación

- [x] Se puede registrar un día real completo desde el móvil sin fricción.
- [x] Los totales por comida y por día son correctos (tests de dominio).
- [x] El cambio de día respeta `Europe/Madrid`, también cerca de medianoche.

Verificado en local (01-10-2026): `make check` en verde. Tests de dominio en
`src/domain/` para totales (por comida, por día y al mover una entrada),
validación de la entrada rápida, comida según la hora y fechas en Madrid
(medianoche en horario de verano y de invierno, noche del cambio de hora,
fechas inválidas y aritmética de días). En vista móvil (375 px): alta desde el
botón flotante con la comida preseleccionada por la hora y desde el «+» de cada
comida, entrada sin nombre, error de validación conservando lo escrito, kcal
con decimales, editar, mover a otra comida, borrar con confirmación, día
anterior, selector de fecha, «Volver a hoy» y fecha no válida en `?day=`. Si
la app instalada sigue abierta al pasar la medianoche, al volver a primer
plano (o en el siguiente minuto) se recarga con el día nuevo.

Desplegada en `remote` el 01-10-2026 (`c68c634`, smoke test local y por
HTTPS correctos) y probada en el móvil.

---

## Fase 3 — Perfil y objetivo calórico

### Objetivo

Saber cuántas calorías te tocan al día según el ritmo al que quieras bajar, y
ver en todo momento cuántas te quedan.

### Alcance

- Asistente inicial (editable luego en *Ajustes*): sexo, fecha de nacimiento,
  altura, peso actual, nivel de actividad, peso objetivo y ritmo. El peso actual
  se guarda como primer `WeightEntry`.
- Cálculo en `src/domain/`:
  - Metabolismo basal (Mifflin-St Jeor): `10·kg + 6,25·cm − 5·edad + 5` en
    hombres; en mujeres, `− 161` en lugar de `+ 5`.
  - Gasto diario: basal × factor de actividad (1,2 / 1,375 / 1,55 / 1,725 /
    1,9).
  - Déficit: kg por semana × 7.700 / 7. Ritmos: suave, 0,25 kg/semana
    (≈ −275 kcal/día); moderado, 0,5 (≈ −550); rápido, 0,75 (≈ −825); y
    *mantener*.
  - Límites de seguridad: nunca por debajo de 1.200 kcal (mujeres) o 1.500
    (hombres), y aviso si el ritmo supera el 1 % del peso corporal por semana.
    Si hay que recortar el déficit, se explica por qué.
  - Fecha estimada para llegar al peso objetivo.
- Opción de fijar el objetivo a mano.
- En *Hoy*: consumidas / objetivo / restantes, con una barra de progreso que
  cambia de color al pasarte.
- Aviso breve de que es una estimación, no consejo médico.

### Fuera de alcance

- Registro de peso continuado y gráficas (fase 4). Ajuste con datos reales
  (fase 9).

### Criterios de aceptación

- [x] Tests de dominio con casos calculados a mano, incluidos los límites de
      seguridad.
- [x] Cambiar el ritmo o la actividad actualiza al momento el objetivo y las
      kcal restantes.

Verificado en local (08-10-2026): `make check` en verde. Tests en
`src/domain/target.test.ts` con casos calculados a mano: edad (cumpleaños y
29 de febrero), Mifflin-St Jeor en hombre y mujer, los cinco factores de
actividad, el déficit de cada ritmo, el mínimo de 1.200 kcal (mujer) y 1.500
(hombre) con su explicación, gasto por debajo del mínimo (sin déficit), aviso
del 1 % semanal, *mantener*, peso objetivo ya alcanzado, objetivo manual (por
encima del gasto y por debajo del mínimo), fecha estimada, kcal restantes y
validación del formulario. En vista móvil (375 px), con una BD de prueba: el
asistente de 3 pasos con validación por paso; la vista previa recalcula al
momento objetivo, desglose, fecha y «hoy te quedarían» al cambiar ritmo,
actividad, peso u objetivo manual; al guardar, el peso actual queda como
`WeightEntry` de hoy; en *Hoy* consumidas / objetivo / restantes con la barra
en rojo al pasarse; en *Ajustes* el desglose y «Editar perfil y objetivo», y
al guardar *Hoy* refleja el nuevo objetivo.

Decisiones: el peso para el cálculo es el último `WeightEntry` (la fase 4
pasará al peso de tendencia); editar el peso en *Ajustes* guarda o corrige el
pesaje de hoy solo si cambia; todos los días se miden contra el objetivo
actual (sin histórico de objetivos); el objetivo manual se respeta aunque
quede bajo el mínimo, con aviso.

Desplegada en `remote` el 08-10-2026 (`4990823`, migración aplicada y smoke
test local y por HTTPS correctos).

---

## Fase 4 — Peso y progreso

### Objetivo

Registrar el peso, ver la tendencia real y cuánto falta, y que el objetivo se
recalcule a medida que bajas.

### Alcance

- Pantalla *Peso*: registrar el peso del día (uno por día; editar y borrar) e
  historial.
- Gráfica con los pesajes y una línea de tendencia (media móvil exponencial que
  tolera huecos). Rangos: 1 mes, 3 meses y todo.
- Progreso:
  - Lo perdido desde el inicio y lo que falta.
  - Ritmo real (kg/semana según la tendencia de las últimas semanas) frente al
    elegido.
  - Fecha estimada con el ritmo real.
- El objetivo calórico se recalcula con el peso de tendencia actual.

### Fuera de alcance

- Básculas inteligentes y Apple Salud.
- Importar un histórico de pesos: se descartó porque el registro empieza de
  cero (el Excel antiguo no tiene pesos actuales).

### Criterios de aceptación

- [x] Tests de la tendencia con datos sintéticos: pesajes diarios, semanales y
      con huecos.
- [x] Apuntar el peso del día desde el móvil lleva unos segundos.
- ~~El histórico importado aparece en la gráfica y en el progreso.~~
      Descartado: no se importa histórico (ver *Fuera de alcance*).

Verificado en local (08-10-2026): `make check` en verde. Tests en
`src/domain/weight.test.ts` con series sintéticas: la tendencia calculada a
mano, peso estable diario y semanal, un pesaje semanal que mueve la tendencia
lo mismo que siete diarios, un hueco largo que la deja alcanzar el peso nuevo,
ritmo real con pesajes diarios con ruido (0,7 kg/sem), semanales (0,5) y con
huecos, sin ritmo con menos de dos semanas o tras meses sin pesarse, fecha
estimada (bajando, estable, subiendo y objetivo alcanzado), rangos de la
gráfica y validación del formulario. En vista móvil (375 px), con una BD de
prueba de unos 140 pesajes: apuntar el peso de hoy (campo y «Guardar») y de
otro día, error de validación, editar y borrar desde el historial, gráfica en
1 mes, 3 meses y todo, progreso con ritmo real y fecha, y el objetivo de
*Hoy*, *Ajustes* y el editor del perfil calculado con el peso de tendencia.

Decisiones:

- Tendencia: media móvil exponencial del 10 % diario; un pesaje tras n días
  sin datos pesa 1 − 0,9ⁿ, así que tolera huecos y pesajes semanales.
- El objetivo calórico usa la tendencia redondeada a 0,1 kg. Solo el
  asistente inicial pide el peso; después se apunta en *Peso* y el editor del
  perfil lo muestra. No se puede borrar el único pesaje.
- Ritmo real: tendencia de hoy frente a la del primer pesaje de las últimas
  5 semanas, con al menos 2 semanas entre ambos.
- Gráfica en SVG propio, sin librería. La línea de tendencia se corta en los
  huecos de más de 3 semanas.

Desplegada en `remote` el 08-10-2026 (`5ebf9db`, sin migraciones; smoke test
local y por HTTPS correctos).

**Hito: a partir de aquí la app ya sirve para el día a día.**

---

## Fase 5 — Biblioteca de alimentos y cantidades

### Objetivo

No volver a escribir las calorías de lo que comes a menudo: alimentos guardados,
porciones y recientes.

### Alcance

- Alimentos propios: nombre, marca, unidad base (g o ml), kcal por 100 y
  porciones con nombre (“1 rebanada = 30 g”, “1 yogur = 125 g”). Crear, editar,
  archivar y marcar como favorito.
- Selector de cantidad reutilizable: g/ml o porciones, con las kcal calculadas
  al momento. Lo usarán las fases 6 a 8.
- Pantalla *Añadir* con buscador (sin distinguir tildes ni mayúsculas),
  recientes (por frecuencia y cercanía) y favoritos.
- Guardar una entrada manual como alimento.
- Repetir: copiar una comida de otro día (“lo mismo que ayer”) o entradas
  sueltas.
- Las entradas guardan copia de nombre y kcal, así que editar un alimento no
  altera los días pasados.

### Fuera de alcance

- Fuentes externas de alimentos. Comidas guardadas y recetas (fase 10).

### Criterios de aceptación

- [x] Añadir un alimento habitual cuesta 2-3 toques desde *Hoy*.
- [x] Tests de la conversión de cantidad a kcal (g, ml y porciones) y de la
      copia de valores.

Verificado en local (08-10-2026): `make check` en verde. Tests en
`src/domain/food.test.ts`: kcal de g, ml y porciones (también medias
porciones, 0 kcal y unidades desconocidas), cantidad por defecto, validación
del selector de cantidad y del formulario de alimento (porciones repetidas o
con el nombre de la unidad base), búsqueda sin tildes ni mayúsculas con todas
las palabras, recientes por frecuencia y cercanía, copias que conservan las
kcal guardadas aunque el alimento cambie y una entrada manual convertida en
alimento que vuelve a dar las mismas kcal. En vista móvil (375 px), con una BD
de prueba: desde *Hoy*, «+» de una comida → alimento favorito o reciente →
«Añadir» (3 toques, con la cantidad de la última vez); cambiar de porciones a
gramos conserva la cantidad (2 rebanadas → 60 g) y las kcal se recalculan al
escribir; editar la cantidad y la comida de una entrada de la biblioteca;
*Repetir* con la comida de ayer preseleccionada más una entrada suelta de otra
comida; guardar una entrada manual como alimento (con su peso); buscar
«PLATANO»; crear un alimento desde una búsqueda sin resultados, con porción y
favorito, y volver a *Añadir* con él abierto; entrada rápida desde *Añadir*;
editar las kcal de un alimento sin que cambien los días pasados; y archivarlo
para que deje de salir al añadir.

Decisiones:

- *Añadir* (`/add?day=&meal=`) sustituye a la hoja de entrada rápida en el
  botón flotante y en el «+» de cada comida: buscador, *Entrada rápida*,
  *Repetir*, *Nuevo alimento*, favoritos y recientes. Al añadir vuelve a *Hoy*.
- Toda la biblioteca (sin archivados) se carga en la página y se busca en el
  cliente: con un único usuario son unos cientos de alimentos como mucho.
- Recientes: los últimos 60 días; cada uso suma 0,5^(días / 14), así que pesa
  más lo que comes a menudo y lo de hace meses desaparece. Los favoritos no se
  repiten en recientes.
- Al elegir un alimento se propone la última cantidad usada; si no, una
  porción; si no, 100 g/ml.
- `DiaryEntry` guarda la cantidad y la unidad (g, ml o el nombre de la
  porción); editar una entrada de la biblioteca recalcula sus kcal con el
  alimento actual, porque es un cambio explícito.
- Guardar una entrada manual como alimento crea una porción «ración» con su
  peso (si se da, calcula las kcal por 100) o de 100 g/ml con las kcal de la
  entrada, y enlaza la entrada.
- *Repetir* copia al día y la comida elegidos con los valores guardados (no
  recalcula). Los alimentos no se borran: se archivan.
- `Food` ya incluye código de barras, macros y origen para las fases 6-8, sin
  interfaz.

Desplegada en `remote` el 08-10-2026 (`01eb284`, migración `food_library`
aplicada, copia previa de SQLite y smoke test local y por HTTPS correctos).

---

## Fase 6 — Código de barras

### Objetivo

Escanear un producto del súper y añadirlo con sus calorías en segundos.

### Alcance

- Escáner con la cámara trasera (EAN-13, EAN-8 y UPC), linterna si el móvil lo
  permite y entrada manual del número como alternativa.
- Búsqueda en tu biblioteca y, si no está, en Open Food Facts desde el servidor.
- Conversión de los datos de OFF: kcal por 100 g/ml (desde kJ si es lo único que
  hay), ración, nombre, marca e imagen. Aviso si faltan las kcal o los datos no
  cuadran.
- Ficha del producto con el selector de cantidad → diario. El producto se guarda
  en la biblioteca con su código.
- Si no se encuentra, se crea a mano asociado a ese código (la foto de la
  etiqueta llega en la fase 8).

### Fuera de alcance

- Enviar datos a Open Food Facts. Escanear sin conexión productos que no estén
  en la biblioteca.

### Notas

- La cámara exige HTTPS. Para probar en el móvil antes de desplegar:
  `next dev --experimental-https` con el certificado local instalado en el
  móvil, o probar directamente en el servidor.

### Criterios de aceptación

- [ ] Probado en el móvil, en el navegador y con la app instalada, con productos
      reales: encontrado, no encontrado y con datos incompletos.
- [x] El segundo escaneo del mismo producto no consulta Open Food Facts.
- [x] Tests del mapeo de OFF con respuestas guardadas como fixtures.

Verificado en local (08-10-2026): `make check` en verde. Fixtures reales de
OFF en `tests/fixtures/off/` (Nutella, Coca-Cola, un producto sin envase ni
marca, canela de Mercadona sin energía y un código que OFF no conoce), con
variantes derivadas en `src/domain/off.test.ts` para solo kJ, kJ escritos
como kcal, kcal que no cuadran con los macros o los kJ, ración y envase,
unidad deducida del texto e imágenes de otros dominios. En
`src/domain/barcode.test.ts`: dígito de control, UPC-A y GTIN-14 → EAN-13,
UPC-E expandido, y que el segundo escaneo sale de la biblioteca sin llamar a
OFF. `tests/zxing-wasm.test.ts` comprueba que el WebAssembly servido coincide
con el instalado. En vista móvil (375 px) con una BD de prueba y OFF real,
escribiendo el código (el navegador de pruebas no tiene cámara; se muestra el
aviso y queda la entrada manual): Nutella encontrada con foto y 539 kcal →
15 g → *Hoy*; el segundo escaneo la abre con los 15 g de la última vez y sin
nueva petición a OFF en el log; un código con el dígito de control mal da
aviso sin consultar; uno que OFF no conoce abre el alimento nuevo con el
código y, al crearlo, vuelve con la ficha abierta; la canela (sin kcal en
OFF) llega con nombre, marca, foto y porción rellenos y solo pide las kcal;
corregir un producto desde la ficha vuelve al escáner con él abierto. El
polyfill ZXing (el camino de Safari) leyó un EAN-13 dibujado en un canvas
cargando el wasm desde `/zxing/`. **Pendiente: la prueba en el móvil real con
la cámara**, que según «Cómo trabajar cada fase» se hará al final.

Decisiones:

- *Escanear* (`/add/scan?day=&meal=`) se abre desde un botón de *Añadir*:
  «+» → *Escanear código de barras* → leer → *Añadir* (3 toques). Tras
  añadir vuelve a *Hoy*; cerrar la ficha vuelve a escanear.
- Lector: `BarcodeDetector` nativo si lee EAN (Chrome en Android) y si no el
  polyfill `barcode-detector` (Safari). Su WebAssembly se sirve desde
  `public/zxing/` en vez de jsDelivr; al actualizar el paquete hay que copiar
  el nuevo (`tests/zxing-wasm.test.ts` avisa).
- Los códigos se guardan normalizados: EAN-13 o EAN-8 con dígito de control
  válido; UPC-A pasa a EAN-13 (con un 0 delante) y UPC-E se expande, así el
  mismo producto coincide lo lea como lo lea.
- Orden de búsqueda: biblioteca (también archivados, que se recuperan al
  escanearlos) → OFF (`/api/v2/product`, solo los campos necesarios,
  User-Agent propio, 8 s de límite). Si OFF trae nombre y kcal válidas, el
  producto se guarda al momento (`source: barcode`) con macros e imagen; si
  no, o si no está, se crea a mano con el código asociado y lo que se sepa
  ya relleno. Los «no encontrados» no se cachean (pueden añadirse a OFF).
- Avisos: solo kJ (kcal calculadas), kcal y kJ que no cuadran (>10 %), kcal
  que no cuadran con 4·P + 4·H + 9·G (>20 %) y más de 900 kcal/100 (se
  descartan). Se muestran en la ficha la primera vez, con enlace a corregir.
- Porciones de OFF: «ración» (si no es el envase entero) y «envase» solo si
  es de hasta 350 g/ml, para no proponer un bote de 400 g por defecto.
- `Food.imageUrl` (migración `food_image`) guarda la foto de OFF; solo se
  aceptan URLs `https` de `openfoodfacts.org`.
- Las entradas del escáner se guardan con `source: barcode`. El nombre de la
  entrada ya no repite la marca si está en el nombre («Nutella», no
  «Nutella (Nutella)»).

Desplegada en `remote` el 08-10-2026 (`7d35e41`, migración `food_image`
aplicada, copia previa de SQLite y smoke test local y por HTTPS correctos).

**Hito: registrar productos envasados es tan rápido como en cualquier app de
calorías.**

---

## Fase 7 — Descripción en texto (IA)

### Objetivo

Escribir (o dictar con el teclado del móvil) lo que has comido en lenguaje
normal y obtener un desglose de calorías que puedes ajustar antes de guardarlo.
Es la primera integración con la IA.

### Alcance

- Integración con la API de Claude en el servidor:
  - API key y modelo por variable de entorno.
  - Salida JSON con esquema, tiempo máximo, y errores comprensibles con
    alternativa manual.
  - Tokens registrados por llamada y gasto estimado del mes visible en
    *Ajustes*.
- Campo de texto libre: “50 g de avena con 200 ml de leche semidesnatada y un
  plátano”, “un plato de lentejas con chorizo”, “2 huevos fritos”.
- La IA devuelve cada elemento con descripción, gramos estimados, kcal por 100 y
  totales, los supuestos (“plátano mediano ≈ 120 g sin piel”) y un nivel de
  confianza.
- Reglas del prompt:
  - Respetar las cantidades que indiques.
  - Usar raciones típicas españolas cuando no las indiques (“plato de lentejas
    ≈ 350 g”).
  - Poner el aceite de cocinado en una línea aparte, para que se vea y se pueda
    quitar.
- La petición incluye tus alimentos habituales, para que “mi pan de molde” use
  tus datos y no una estimación.
- Revisión:
  - Gramos editables con recálculo al momento, y tamaño pequeño/normal/grande.
  - Quitar o añadir líneas y elegir la comida.
  - Al confirmar se crean entradas con origen `text`.
- Opción de guardar un elemento como alimento de la biblioteca.

### Fuera de alcance

- Base de datos de alimentos genéricos (BEDCA/USDA) para anclar las
  estimaciones: se valorará tras un tiempo de uso (fase 10).

### Criterios de aceptación

- [x] Un conjunto de 15-20 descripciones de prueba da resultados razonables,
      revisados a mano. Incluye cantidades explícitas, raciones vagas y platos
      caseros.
- [x] Registrar una comida casera por texto lleva menos de 30 segundos.
- [x] Si mencionas un alimento de tu biblioteca, se usan sus datos.
- [x] La API key no aparece en el navegador ni en los logs.

Verificado en local (08-10-2026) con `claude-sonnet-5-5` y esfuerzo `low`:
`make check` en verde. `scripts/eval-text.ts` pasa 19 descripciones (avena con
leche y plátano, lentejas con chorizo, huevos fritos, bocadillo, tortilla,
ensalada, caña con bravas, paella, cantidades explícitas y raciones vagas, y
tres con «mi …») con una biblioteca de prueba; revisadas a mano, todas
razonables, con las cantidades dadas respetadas, raciones típicas («plato de
lentejas ≈ 350 g», «puñado ≈ 30 g»), el aceite de cocinado en su línea y los
alimentos propios con sus kcal y porciones («2 rebanadas × 28 g»). Respuestas
de 2-4 s (una de 8 s). Tras la revisión se ajustó el prompt para que «pan» a
secas no se tome por tu pan de molde y el aceite vaya siempre en gramos. En
vista móvil (375 px) con una BD de prueba: *Añadir* → *Describir lo que has
comido* → «un plato de lentejas con chorizo y una rebanada de mi pan de
molde» → lentejas, aceite y el pan de la biblioteca en unos 3 s; *Grande*
(350 → 438 g), quitar el aceite, «¿Algo más?» con un café con leche, cambiar
sus ml a mano, guardar las lentejas como alimento (ración de 438 g) y
*Añadir al diario* → *Hoy* con las tres entradas (origen `text`, las dos de
la biblioteca enlazadas). Un texto que no es comida da aviso con *Apuntarlo
a mano*. *Ajustes* muestra 3 consultas y 0,01 $. Ni los logs (solo modelo,
tokens y duración) ni el HTML y los JS del navegador contienen la clave.
**Pendiente: la prueba en el móvil real**, que se hará al final.

Decisiones:

- *Describir* (`/add/text?day=&meal=`) se abre desde *Añadir*. Tras añadir
  vuelve a *Hoy*.
- Petición: `client.beta.messages.create` con salida JSON por esquema
  (`output_config.format`), esfuerzo `low` y `fallbacks: "default"` (si un
  filtro de seguridad rechaza la petición, responde otro modelo). 20 s por
  intento, un reintento y 30 s en total. Errores con mensaje en español y
  alternativa a mano.
- La petición lleva la biblioteca (no archivados, favoritos y más usados
  primero) numerada, con kcal y porciones; la IA responde con el número. Una
  línea de la biblioteca toma su unidad y sus kcal por 100 de la BD, no de
  la IA. Las kcal de cada línea se calculan siempre en el servidor.
- Pequeño/normal/grande multiplican la cantidad de la IA por 0,75/1/1,25.
  «¿Algo más?» hace otra consulta y añade sus líneas.
- Guardar una línea como alimento crea un `Food` con `source: text` y una
  porción «ración» con la cantidad de ese momento.
- Cada llamada queda en `AiCall` (migración `ai_call`): día, modelo que
  respondió, tokens, coste estimado con los precios de `src/domain/aiUsage.ts`,
  duración y si fue bien. *Ajustes* suma las del mes.
- Variables: `ANTHROPIC_API_KEY`, y opcionales `ANTHROPIC_MODEL`,
  `ANTHROPIC_EFFORT` y `ANTHROPIC_WORKSPACE_ID` (para una clave sin
  workspace, que las organizaciones Team rechazan sin él).

Desplegada en `remote` el 08-10-2026 (`3293b08`, migración `ai_call`
aplicada, `ANTHROPIC_API_KEY` en `/etc/calorias/app.env`, copia previa de
SQLite y smoke test local y por HTTPS correctos).

**Hito: los platos caseros y los alimentos sin envase también se registran
rápido.**

---

## Fase 8 — Foto de la etiqueta (IA)

### Objetivo

Registrar productos que no están en Open Food Facts con una foto de la tabla
nutricional, reutilizando la integración con la IA de la fase 7.

### Alcance

- Hacer la foto o elegirla de la galería. Se reduce en el propio móvil (unos
  1.500 px) antes de enviarla y no se guarda.
- La IA extrae nombre y marca (si aparecen), kcal por 100 g/ml, unidad base,
  ración si la indica y, sin mostrarlos, proteína, hidratos y grasa.
- Comprobaciones: confusión entre kJ y kcal, y que kcal ≈ 4·proteína +
  4·hidratos + 9·grasa. Si no cuadra, se avisa para revisar.
- Pantalla de revisión con todo editable → se guarda como alimento. Si venías de
  un código no encontrado, queda asociado a él.

### Fuera de alcance

- Foto del plato de comida (descartada por ahora).

### Criterios de aceptación

- [x] Probado con 5-10 etiquetas reales (incluidas una que solo trae kJ y una
      foto mal iluminada): valores correctos o aviso.
- [x] Tras guardar un producto por foto, su código de barras se reconoce al
      instante.
- [x] Tests del validador y del procesado de respuestas guardadas.

Verificado en local (09-10-2026) con `claude-sonnet-5-5` y esfuerzo `low`:
`make check` en verde. `scripts/eval-label.ts` lee con la API real las fotos
de la tabla nutricional que la gente sube a Open Food Facts (en memoria, sin
guardarlas) de 8 productos que se venden en España (galletas Gullón, ketchup
Heinz, Nutella, bebida de almendra Alpro, Lindt 85 %, Corn Flakes, Wasa y una
Coca-Cola cuya «foto de la tabla» es el frontal de la lata): las 7 con tabla
dan las kcal, los macros y la ración de la etiqueta (con fotos curvadas, en
otros idiomas y sin el nombre a la vista, que se pide escribir), y la lata
da «No se lee la tabla nutricional» con la alternativa a mano. Tras la
primera pasada se ajustó el prompt para que `problem` solo hable de números
dudosos (no del idioma ni de que falte el nombre). Sus respuestas están en
`tests/fixtures/label/`. `src/domain/label.test.ts` cubre solo kJ, los kJ
leídos también como kcal, kJ y kcal cambiados, kcal y kJ que no cuadran,
una sola cifra que es kJ (por pasar de 900 o porque lo delatan los macros),
macros que no cuadran, valores solo por ración, la foto y su reducción. En
vista móvil (375 px) con una BD de prueba, con fotos generadas en la página
de 3.000 px (el navegador de pruebas no tiene cámara): un código que OFF no
conoce → *Leer la etiqueta con una foto* → etiqueta que **solo trae kJ**
(1.580 kJ) → 377,6 kcal con aviso, nombre y marca rellenos → *Crear
alimento* → selector de cantidad → 40 g → *Hoy* (151 kcal, origen `label`;
el alimento, con `source: label`, código y macros). Escribir de nuevo el
código en el escáner abre el producto al instante con 40 g y sin consultar
OFF. Una foto **oscura y con ruido** de un yogur griego se lee bien (128
kcal), y una sin tabla da el aviso con *Escribirlo a mano*. Cada lectura
tarda 2-2,5 s y cuesta unos 0,8 céntimos; *Ajustes* las suma al gasto.
**Pendiente: la prueba en el móvil real con la cámara**, que se hará al
final.

Decisiones:

- *Foto de la etiqueta* (`/add/label?day=&meal=`) se abre desde *Añadir* y,
  con `&barcode=`, desde el producto no encontrado o incompleto del escáner
  («Leer la etiqueta con una foto»). Dos botones: *Hacer la foto*
  (`capture="environment"`) y *Elegir de la galería*.
- La foto se reduce en el móvil con un canvas a 1.500 px de lado mayor
  (JPEG al 85 %) y va en base64 a una server action
  (`serverActions.bodySizeLimit: 6mb`; nginx ya admite 10 MB). No se guarda.
- La IA copia lo que pone la etiqueta (kcal y kJ por separado, macros
  totales, base por 100 o por ración, tamaño de ración) y dice si algo no
  se lee; las conversiones y comprobaciones se hacen en
  `src/domain/label.ts`: kcal desde kJ si solo hay kJ, la misma cifra en
  los dos campos (eran kJ), kJ y kcal cambiados, una sola cifra que pasa de
  900 o que con los macros resulta ser kJ, kcal frente a kJ (>10 %) y frente
  a 4·P + 4·H + 9·G (>20 %), y valores por ración pasados a 100. Todo sale
  como aviso en la revisión.
- La revisión es el formulario de alimento con lo leído; al crear el
  alimento (`source: label`, macros guardados, código si venía de uno) se
  abre el selector de cantidad y las entradas se guardan con
  `source: label`. Una lectura fallida ofrece *Escribirlo a mano*.
- `requestJson` acepta bloques de contenido (la foto y el texto) y las
  llamadas quedan en `AiCall` con `kind: label`.

**Hito: todas las formas de registrar disponibles.**

---

## Fase 9 — Resumen semanal y objetivo adaptativo

### Objetivo

Ver cómo va la semana y que el objetivo se ajuste a tu gasto real en vez de a
una fórmula genérica.

### Alcance

- Pantalla *Resumen*: media diaria de la semana y del mes, días dentro del
  objetivo, calendario coloreado por día y evolución del peso de tendencia.
- Días incompletos: los que tienen muy pocas kcal, o los que marques tú, no
  cuentan para los cálculos.
- Gasto real estimado en `src/domain/`:
  - Fórmula: media de ingesta − (cambio de peso de tendencia × 7.700 / días),
    sobre las últimas 3-4 semanas.
  - Se suaviza con la estimación anterior y el cambio semanal está limitado.
  - Exige un mínimo de datos; mientras no lo haya, se usa la fórmula de la
    fase 3.
- Check-in semanal: “tu gasto estimado es X; para seguir a 0,5 kg/semana, tu
  objetivo pasaría a Y”. Lo aceptas o lo mantienes, y queda en el historial.
- Se respetan los límites de seguridad de la fase 3.

### Fuera de alcance

- Notificaciones del check-in (fase 10).

### Criterios de aceptación

- [ ] Tests con escenarios sintéticos (pierde más de lo previsto, se estanca,
      datos insuficientes, días sin registrar): los ajustes son razonables y
      están acotados.
- [ ] Con los datos reales acumulados desde la fase 2, la estimación es
      coherente con tu evolución.

---

## Fase 10 — Calidad de vida

### Objetivo

Pulir lo que más fricción te dé tras unas semanas de uso. Es un menú: los puntos
se eligen al empezar la fase y, si son muchos, se divide en 10a y 10b.

### Candidatos

- **Comidas guardadas**: “mi desayuno de siempre” con un toque.
- **Recetas caseras**: ingredientes y peso final cocinado; luego registras los
  gramos que te sirves (lentejas, tortilla, cocido…).
- **Recordatorios** con Web Push en la app instalada: pesarte por la mañana, o
  apuntar la cena si a cierta hora no hay nada.
- **Exportar** el diario y los pesos a CSV.
- **Modo sin conexión básico**: abrir la app y ver el día sin cobertura.
- **Pulido visual**: modo oscuro, accesibilidad e icono definitivo.
- **Precisión y coste de la IA**: anclar las descripciones a una base de
  alimentos genéricos, y comparar Opus 5.5 con Sonnet 5.5.

---

## Fuera del proyecto (por ahora)

Se descartaron al planificar: macros en la interfaz, foto del plato, Apple
Salud / Health Connect, ejercicio y agua, varios usuarios y publicación en
tiendas. El modelo de datos no les cierra la puerta.

## Decisiones pendientes

| Decisión | Cuándo |
|---|---|
| ~~Subdominio y puerto definitivos~~: `calorias.joserabalsegura.com` (ya resuelve al servidor) y 3090 (libre según `ss -ltn`) | Fase 1 (decidido) |
| Nombre e icono de la app: provisionales «Calorías» y un plato blanco sobre verde | Fase 10 |
| ~~Librería de gráficas~~: SVG propio | Fase 4 (decidido) |
| ~~Formato del histórico de peso a importar~~: no se importa, se empieza de cero | Fase 4 (decidido) |
| Modelo de IA definitivo, según calidad y coste medidos | Fases 7-8 |

## Cómo trabajar cada fase

Una rama por fase (`fase-N-nombre`), `make check` en verde, prueba en vista
móvil en el navegador, merge a `main` y `make deploy`. Desde la fase 3 cada
fase se marca como hecha al desplegarla: la prueba en el móvil se hará una sola
vez, con la configuración inicial, cuando esté todo el desarrollo. Prompt de arranque:

```text
Lee docs/ROADMAP.md (y CLAUDE.md desde la fase 2). Implementa solo la fase N.
No adelantes trabajo de fases posteriores. Al terminar, ejecuta make check,
prueba la app en el navegador en vista móvil, marca los criterios de
aceptación cumplidos y actualiza la tabla de estado.
```
