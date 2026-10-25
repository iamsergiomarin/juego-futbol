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
- `src/servidor/mundo.ts`: creación de la partida (club del jugador, grupo de Quinta con bots, plantillas, instalaciones). `src/servidor/consultas.ts`: lecturas para las pantallas.
- `src/dominio/nombres.ts`: nombres ficticios. Las localidades son inventadas para no coincidir con clubes reales.
- `desktop/`: aplicación de escritorio (Electron) que arranca el servidor autónomo de Next en local. Instalador de Windows en `.github/workflows/escritorio-windows.yml`.

## Reglas de trabajo

- Tras tocar el motor: `npm test` y `npm run calibrar`. Referencias entre iguales: ~2,7-2,8 goles por partido, ~45 % victorias locales, ~6 % de 0-0. Si cambian, documentarlo en `docs/motor.md`.
- Antes de subir: `npm run typecheck`, `npm run lint`, `npm test` y `npm run build`.
- Nada que influya en el resultado deportivo puede depender de pagos reales.
