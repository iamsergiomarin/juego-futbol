# Mánager de fútbol (nombre provisional)

Juego online de gestión de clubes de fútbol, inspirado en goalunited pero corrigiendo sus fallos: ligas llenas de bots sin vida, partidos sin intervención del mánager y un estadio que era solo una cifra.

El diseño completo está en el documento de diseño del proyecto (Claude Docs). Las reglas acordadas que ya están en código viven en [`src/dominio/reglas.ts`](src/dominio/reglas.ts).

## Estado

Cimientos de la versión 1:

- **Motor de partidos** (`src/motor`): simulación minuto a minuto con semilla reproducible, mentalidad, presión, cansancio, cambios con ventanas, tiempo de adaptación táctica, instrucciones condicionales y segundo entrenador. Calibrado con miles de partidos (ver [`docs/motor.md`](docs/motor.md)).
- **Modelo de datos** (`supabase/migrations`): esquema de PostgreSQL para Supabase.
- **Página de prueba** (`/`): simula un partido de Quinta y lo narra minuto a minuto.

## Tecnología

- Next.js + TypeScript (web adaptada al móvil)
- PostgreSQL en Supabase (datos y registro de usuarios)
- Un proceso aparte, más adelante, para jugar las jornadas a hora fija y ejecutar tareas programadas

## Comandos

```bash
npm install
npm run dev          # servidor de desarrollo en http://localhost:3000
npm test             # pruebas del motor
npm run calibrar     # batería de calibración (4.000 partidos por escenario)
npm run typecheck
npm run lint
npm run build
```

## Modo local (aplicación de escritorio para Windows)

Para probar el juego en un ordenador, sin internet ni cuentas: el mismo código y las mismas migraciones, con PostgreSQL incrustado (PGlite) guardado en la carpeta de datos del usuario (`%APPDATA%\Manager de Futbol\datos`).

- Cada subida a `main` compila el instalador en GitHub Actions (workflow *Instalador de Windows*); se descarga desde la pestaña Actions, en *Artifacts*.
- En desarrollo: `DATOS_LOCALES=./datos-locales npm run dev` activa el modo local en el navegador.
- `npm run dist:windows` crea el instalador en una máquina Windows.

Al no estar firmado, Windows avisa la primera vez: "Más información" → "Ejecutar de todas formas".

## Principios que no se negocian

- Nunca se puede pagar para ganar: con dinero real solo cosméticos, comodidad y una aceleración limitada de obras.
- Todos empiezan en Quinta; los bots igualan el nivel de su grupo y nunca ascienden ni ganan títulos.
- El juego explica lo que pasa: analista, segundo entrenador e informes.
