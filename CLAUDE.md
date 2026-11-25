# Guía para trabajar en este repositorio

## Proyecto

Juego online de mánager de fútbol (proyecto personal de Sergio). El diseño se decide en conversación y se recoge en el documento de diseño; aquí se implementa.

## Convenciones

- **Todo en español**: código de dominio (variables, funciones, tablas), comentarios, textos de interfaz y mensajes de commit.
- Números en la interfaz con formato español: coma decimal y "%" separado por espacio (`2,75`, `44,5 %`).
- Importes en euros del juego como enteros (`bigint` en base de datos).
- Atributos de jugador en escala 1-100; media global 1-10 con un decimal.

## Estructura

- `src/motor/`: motor de partidos puro (sin base de datos ni red). Determinista con semilla.
- `src/dominio/reglas.ts`: reglas acordadas en el diseño. Cualquier cifra económica nueva va aquí, no repartida por el código.
- `supabase/migrations/`: esquema SQL. Nunca editar una migración ya aplicada; crear una nueva.
- `scripts/calibrar.ts`: batería de calibración del motor.
- `src/servidor/bd.ts`: acceso a datos. Modo local (PGlite, si existe `DATOS_LOCALES`) y, más adelante, Supabase. Las migraciones se empaquetan en `src/servidor/migraciones.generadas.ts` (`npm run migraciones`); no editarlo a mano.
- `src/servidor/liga.ts`: calendario (doble vuelta, lunes y sábado a las 21:00), simulación de jornadas con las plantillas reales, clasificación y economía de jornada (provisional, en `ECONOMIA_JORNADA`).
- `src/app/(juego)/`: pantallas del juego con la barra de navegación común (Inicio, Club, Equipo, Competición) y pestañas por sección.
- `src/servidor/mundo.ts`: creación de la partida (club del jugador, grupo de Quinta con bots, plantillas, instalaciones). `src/servidor/consultas.ts`: lecturas para las pantallas.
- `src/dominio/tactica.ts` (sistemas, puestos, planteamiento y alineación automática), `entrenamiento.ts` (sesiones, progreso por edad, cansancio y lesiones), `mercado.ts` (valor, salarios, ventana y margen del ojeador), `atributos.ts` (nombres en pantalla).
- `src/servidor/plantilla.ts` (estado de los jugadores, planteamiento y equipo que salta al campo), `mercado.ts` (fichajes, ventas, renovaciones y actividad de los bots), `temporada.ts` (playoff, ascenso y nueva temporada), `noticias.ts` (novedades del cuerpo técnico), `jugador.ts` (ficha con lo que ve el ojeador).
- `src/dominio/grada.ts` y `gradaTextos.ts` (La Grada: voces, reacciones a partidos y acontecimientos, ánimo; puro y determinista), `src/servidor/grada.ts` (publicaciones, previas y lectura del timeline). Las jornadas se juegan de una en una: no hay botones para simular varias. El mánager puede publicar comunicados como club (máximo dos por jornada); no mueven el ánimo.
- `src/dominio/patrocinio.ts` y `src/servidor/patrocinio.ts` (ofertas de pretemporada, contratos de frontal y marca deportiva, contraoferta única, pagos semanales y liquidación de temporada), `src/dominio/cantera.ts`, `src/servidor/cantera.ts` (hornadas, desarrollo semanal, contrato profesional; tabla `juveniles`, fuera de `jugadores` hasta que suben) y `src/servidor/instalaciones.ts` (obras de edificios: se pagan al iniciar y se inauguran al jugarse la jornada siguiente).
- `src/dominio/nombres.ts`: nombres ficticios. Las localidades son inventadas para no coincidir con clubes reales.
- `desktop/`: aplicación de escritorio (Electron) que arranca el servidor autónomo de Next en local. Instalador de Windows en `.github/workflows/escritorio-windows.yml`.

## Reglas de trabajo

- Tras tocar el motor: `npm test` y `npm run calibrar`. Referencias entre iguales: ~2,7-2,8 goles por partido, ~45 % victorias locales, ~6 % de 0-0. Si cambian, documentarlo en `docs/motor.md`.
- Antes de subir: `npm run typecheck`, `npm run lint`, `npm test` y `npm run build`.
- Nada que influya en el resultado deportivo puede depender de pagos reales.
