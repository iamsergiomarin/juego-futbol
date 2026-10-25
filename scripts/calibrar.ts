/**
 * Batería de calibración del motor: simula miles de partidos por escenario.
 * Uso: npm run calibrar            (4.000 partidos por escenario)
 *      npm run calibrar -- 1000    (número personalizado)
 */
import { crearRng, generarEquipo, simularPartido, type Condicional, type EquipoPartido } from "../src/motor";

const N = Number(process.argv[2] ?? 4000);
const NUEVOS_EQUIPOS_CADA = 50;

type Ajuste = (e: EquipoPartido) => void;

interface Serie {
  local: number;
  empate: number;
  visitante: number;
  goles: number;
  golesLocal: number;
  golesVisitante: number;
  tiros: number;
  ceroCero: number;
  goleadas: number;
  rescate: number;
  top: string;
}

function serie(nivelLocal: number, nivelVisit: number, semilla: number, ajusteLocal?: Ajuste): Serie {
  const rng = crearRng(semilla);
  let v = 0, e = 0, d = 0, gl = 0, gv = 0, tiros = 0, ceroCero = 0, goleadas = 0, perdiendo60 = 0, rescatados = 0;
  const marcadores = new Map<string, number>();
  let local!: EquipoPartido;
  let visitante!: EquipoPartido;
  for (let i = 0; i < N; i++) {
    if (i % NUEVOS_EQUIPOS_CADA === 0) {
      local = generarEquipo(rng, "L", "Local", nivelLocal);
      visitante = generarEquipo(rng, "V", "Visitante", nivelVisit);
      ajusteLocal?.(local);
    }
    const r = simularPartido(local, visitante, Math.floor(rng() * 2 ** 32));
    const [a, b] = r.goles;
    gl += a;
    gv += b;
    tiros += r.tiros[0] + r.tiros[1];
    if (a === 0 && b === 0) ceroCero++;
    if (Math.abs(a - b) >= 4) goleadas++;
    if (a > b) v++;
    else if (a === b) e++;
    else d++;
    if (r.marcador60[0] < r.marcador60[1]) {
      perdiendo60++;
      if (a >= b) rescatados++;
    }
    const k = `${a}-${b}`;
    marcadores.set(k, (marcadores.get(k) ?? 0) + 1);
  }
  const top = [...marcadores.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, c]) => `${k} (${c})`).join(", ");
  const pct = (x: number) => (100 * x) / N;
  return {
    local: pct(v), empate: pct(e), visitante: pct(d),
    goles: (gl + gv) / N, golesLocal: gl / N, golesVisitante: gv / N,
    tiros: tiros / N, ceroCero: pct(ceroCero), goleadas: pct(goleadas),
    rescate: perdiendo60 ? (100 * rescatados) / perdiendo60 : 0, top,
  };
}

const f = (x: number) => x.toFixed(1).replace(".", ",");
const f2 = (x: number) => x.toFixed(2).replace(".", ",");

function imprimir(titulo: string, s: Serie) {
  console.log(`\n${titulo}`);
  console.log(`  Local ${f(s.local)} % · Empate ${f(s.empate)} % · Visitante ${f(s.visitante)} %`);
  console.log(`  Goles/partido ${f2(s.goles)} (${f2(s.golesLocal)}-${f2(s.golesVisitante)}) · Tiros/partido ${f(s.tiros)} · 0-0 ${f(s.ceroCero)} % · Diferencia de 4+ goles ${f(s.goleadas)} %`);
  console.log(`  Si el local pierde en el 60', saca algo el ${f(s.rescate)} %`);
  console.log(`  Marcadores más repetidos: ${s.top}`);
}

const condicionalRemontada: Condicional = {
  id: "remontada",
  desdeMinuto: 60,
  marcador: "perdiendo",
  accion: { mentalidad: "ofensiva", cambio: { salePosicion: "DEF", entraPosicion: "DEL" } },
};

console.log(`Calibración del motor · ${N} partidos por escenario`);
imprimir("1. Iguales 5,0 vs 5,0", serie(5, 5, 1));
imprimir("2. Local algo mejor 5,5 vs 5,0", serie(5.5, 5, 2));
imprimir("3. Local mejor 6,0 vs 5,0", serie(6, 5, 3));
imprimir("4. Visitante mejor 5,0 vs 6,0", serie(5, 6, 4));
imprimir("5. Desequilibrio 7,0 vs 4,0", serie(7, 4, 5));
imprimir("6. Iguales en Élite 8,5 vs 8,5", serie(8.5, 8.5, 6));
imprimir("7. Iguales, local ofensivo", serie(5, 5, 7, (e) => (e.tactica.mentalidad = "ofensiva")));
imprimir("8. Iguales, local defensivo", serie(5, 5, 8, (e) => (e.tactica.mentalidad = "defensiva")));
imprimir("9. Iguales, local con presión alta", serie(5, 5, 9, (e) => (e.tactica.presion = "alta")));
imprimir("10. Iguales, local con condicional de remontada", serie(5, 5, 10, (e) => (e.condicionales = [condicionalRemontada])));
