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
| 3 | Perfil y objetivo calórico | Pendiente |
| 4 | Peso y progreso | Pendiente |
| 5 | Biblioteca de alimentos y cantidades | Pendiente |
| 6 | Código de barras | Pendiente |
| 7 | Descripción en texto (IA) | Pendiente |
| 8 | Foto de la etiqueta (IA) | Pendiente |
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
| IA | API de Claude desde el servidor con `@anthropic-ai/sdk`: texto para descripciones, visión para etiquetas y siempre salida JSON con esquema. Modelo por defecto `claude-opus-5-5` con esfuerzo `low` de partida, configurable por variable de entorno. La API key nunca llega al navegador. |
| Fechas | El día del diario se guarda como `YYYY-MM-DD`, en zona `Europe/Madrid`. |
| Dominio | Los cálculos (objetivo, tendencia, gasto adaptativo, conversiones) son funciones puras con tests en `src/domain/`. |

### Coste de la IA (orientativo, precios de septiembre de 2026)

Claude Opus 5.5 cuesta 4 $ por millón de tokens de entrada y 20 $ por millón de
salida.

| Uso | Coste aproximado |
|---|---|
| Desglosar una descripción | 2-4 céntimos de dólar |
| Leer una etiqueta (foto reducida a unos 1.500 px) | 2-3 céntimos |
| Uso diario personal (unas 3 descripciones al día y alguna etiqueta) | **2-5 $ al mes** |

Cada etiqueta se lee una sola vez, porque el producto queda guardado. Sonnet 5.5
cuesta la mitad: se puede probar cambiando la variable de entorno si su calidad
es suficiente. Conviene fijar un límite de gasto mensual en la consola de
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

- [ ] Tests de dominio con casos calculados a mano, incluidos los límites de
      seguridad.
- [ ] Cambiar el ritmo o la actividad actualiza al momento el objetivo y las
      kcal restantes.

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
- Importar el histórico desde CSV (por ejemplo, exportando
  `~/Peso semanal.xlsx`) para empezar con datos.

### Fuera de alcance

- Básculas inteligentes y Apple Salud.

### Criterios de aceptación

- [ ] Tests de la tendencia con datos sintéticos: pesajes diarios, semanales y
      con huecos.
- [ ] Apuntar el peso del día desde el móvil lleva unos segundos.
- [ ] El histórico importado aparece en la gráfica y en el progreso.

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

- [ ] Añadir un alimento habitual cuesta 2-3 toques desde *Hoy*.
- [ ] Tests de la conversión de cantidad a kcal (g, ml y porciones) y de la
      copia de valores.

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
- [ ] El segundo escaneo del mismo producto no consulta Open Food Facts.
- [ ] Tests del mapeo de OFF con respuestas guardadas como fixtures.

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

- [ ] Un conjunto de 15-20 descripciones de prueba da resultados razonables,
      revisados a mano. Incluye cantidades explícitas, raciones vagas y platos
      caseros.
- [ ] Registrar una comida casera por texto lleva menos de 30 segundos.
- [ ] Si mencionas un alimento de tu biblioteca, se usan sus datos.
- [ ] La API key no aparece en el navegador ni en los logs.

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

- [ ] Probado con 5-10 etiquetas reales (incluidas una que solo trae kJ y una
      foto mal iluminada): valores correctos o aviso.
- [ ] Tras guardar un producto por foto, su código de barras se reconoce al
      instante.
- [ ] Tests del validador y del procesado de respuestas guardadas.

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
| Librería de gráficas (Recharts o SVG propio) | Fase 4 |
| Formato del histórico de peso a importar | Fase 4 |
| Modelo de IA definitivo, según calidad y coste medidos | Fases 7-8 |

## Cómo trabajar cada fase

Una rama por fase (`fase-N-nombre`), `make check` en verde, prueba en el móvil,
merge a `main` y `make deploy`. Prompt de arranque:

```text
Lee docs/ROADMAP.md (y CLAUDE.md desde la fase 2). Implementa solo la fase N.
No adelantes trabajo de fases posteriores. Al terminar, ejecuta make check,
prueba la app en el navegador en vista móvil, marca los criterios de
aceptación cumplidos y actualiza la tabla de estado.
```
