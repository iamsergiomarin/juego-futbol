import type { Pestana } from "@/componentes/juego/Pestanas";

export const PESTANAS_COMPETICION: Pestana[] = [
  { href: "/competicion", etiqueta: "Clasificación" },
  { href: "/competicion/calendario", etiqueta: "Calendario y resultados" },
  { href: "/competicion/historial", etiqueta: "Historial" },
  { href: "/competicion/copa", etiqueta: "Copa", proximamente: true },
  { href: "/competicion/estadisticas", etiqueta: "Estadísticas", proximamente: true },
];
