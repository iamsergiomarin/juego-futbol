import { crearRng, uniforme, type Rng } from "./aleatorio";
import { CALIBRACION as C, MENTALIDAD, PRESION, REGLAS_PARTIDO } from "./constantes";
import type {
  Atributo,
  Condicional,
  EquipoPartido,
  EventoPartido,
  JugadorPartido,
  Lado,
  Orden,
  Posicion,
  ResultadoPartido,
  Tactica,
} from "./tipos";

/** Estado de un equipo durante el partido. No modifica el EquipoPartido original. */
class EstadoEquipo {
  readonly id: string;
  readonly nombre: string;
  titulares: JugadorPartido[];
  banquillo: JugadorPartido[];
  tactica: Tactica;
  readonly familiaridad: number;
  readonly segundoEntrenador: boolean;
  readonly condicionales: Condicional[];
  readonly condicionalesUsadas = new Set<string>();
  readonly cansancio = new Map<string, number>();
  readonly participantes = new Set<string>();
  cambios = 0;
  ventanasUsadas = 0;
  adaptacionHasta = -1;
  pendientes: Orden[] = [];

  constructor(e: EquipoPartido) {
    this.id = e.id;
    this.nombre = e.nombre;
    this.titulares = [...e.titulares];
    this.banquillo = [...e.banquillo];
    this.tactica = { ...e.tactica };
    this.familiaridad = e.familiaridad;
    this.segundoEntrenador = e.segundoEntrenador;
    this.condicionales = e.condicionales;
    for (const j of [...e.titulares, ...e.banquillo]) this.cansancio.set(j.id, Math.min(1, Math.max(0, j.cansancioInicial ?? 0)));
    for (const j of e.titulares) this.participantes.add(j.id);
  }

  de(pos: Posicion): JugadorPartido[] {
    return this.titulares.filter((j) => j.posicion === pos);
  }

  rendimiento(j: JugadorPartido): number {
    return 1 - C.perdidaPorCansancio * (this.cansancio.get(j.id) ?? 0);
  }

  mediaAtributos(jugadores: JugadorPartido[], atributos: Atributo[]): number {
    if (jugadores.length === 0) return 30;
    let total = 0;
    for (const j of jugadores) {
      let suma = 0;
      for (const a of atributos) suma += j.atributos[a] ?? 30;
      total += (suma / atributos.length) * this.rendimiento(j);
    }
    return total / jugadores.length;
  }

  /**
   * Peso de una línea según cuántos jugadores tiene respecto al 4-4-2 de referencia:
   * reforzar una zona debilita otra, y así cada sistema tiene su precio.
   */
  presencia(pos: Posicion): number {
    const referencia: Record<Posicion, number> = { POR: 1, DEF: 4, MED: 4, DEL: 2 };
    return 1 + C.pesoPorJugadorDeLinea * (this.de(pos).length - referencia[pos]);
  }

  factorAdaptacion(minuto: number): number {
    return minuto <= this.adaptacionHasta ? C.rendimientoAdaptacion : 1;
  }

  centroCampo(minuto: number): number {
    const v =
      0.7 * this.mediaAtributos(this.de("MED"), ["pase", "control", "vision", "decision"]) +
      0.15 * this.mediaAtributos(this.de("DEF"), ["pase", "colocacion"]) +
      0.15 * this.mediaAtributos(this.de("DEL"), ["control", "pase"]);
    return v * this.presencia("MED") * this.factorAdaptacion(minuto);
  }

  ataque(minuto: number): number {
    const v =
      0.6 * this.mediaAtributos(this.de("DEL"), ["regate", "velocidad", "decision", "control"]) * this.presencia("DEL") +
      0.4 * this.mediaAtributos(this.de("MED"), ["vision", "pase", "centros"]);
    return v * this.factorAdaptacion(minuto);
  }

  defensa(minuto: number): number {
    const v =
      0.75 * this.mediaAtributos(this.de("DEF"), ["entrada", "colocacion", "fuerza", "velocidad", "aereo"]) +
      0.25 * this.mediaAtributos(this.de("MED"), ["entrada", "colocacion"]);
    return v * this.presencia("DEF") * this.factorAdaptacion(minuto);
  }

  definicion(): number {
    return this.mediaAtributos([...this.de("DEL"), ...this.de("MED").slice(0, 1)], ["tiro", "temple", "decision"]);
  }

  portero(): number {
    return this.mediaAtributos(this.de("POR"), ["reflejos", "blocaje", "salidas"]);
  }

  cansar(): void {
    const coste = PRESION[this.tactica.presion][1];
    for (const j of this.titulares) {
      let ritmo = 0.0075 * (1.4 - (j.atributos.resistencia ?? 50) / 100) * coste;
      if (j.posicion === "POR") ritmo *= 0.3;
      this.cansancio.set(j.id, Math.min(1, (this.cansancio.get(j.id) ?? 0) + ritmo));
    }
  }

  /** Elige al goleador: delanteros primero, ponderado por su tiro. */
  goleador(rng: Rng): JugadorPartido {
    const peso: Record<Posicion, number> = { POR: 0, DEF: 0.4, MED: 1.3, DEL: 3 };
    const candidatos = this.titulares.map((j) => ({ j, p: peso[j.posicion] * (j.atributos.tiro ?? 30) }));
    let r = rng() * candidatos.reduce((a, c) => a + c.p, 0);
    for (const c of candidatos) {
      r -= c.p;
      if (r <= 0) return c.j;
    }
    return candidatos[candidatos.length - 1].j;
  }

  masCansado(posicion?: Posicion): JugadorPartido | undefined {
    const candidatos = this.titulares.filter((j) => j.posicion !== "POR" && (!posicion || j.posicion === posicion));
    return candidatos.sort((a, b) => (this.cansancio.get(b.id) ?? 0) - (this.cansancio.get(a.id) ?? 0))[0];
  }
}

const LADOS: Lado[] = ["local", "visitante"];

/**
 * Simulador minuto a minuto.
 *
 * - En directo: el servidor llama a `avanzarMinuto()` cada ~20 segundos reales y
 *   `darOrden()` cuando el mánager toca algo. Las órdenes se aplican en la siguiente interrupción.
 * - Sin directo (filial, pruebas): `simularCompleto()`.
 */
export class SimuladorPartido {
  readonly semilla: number;
  minuto = 0;
  private readonly rng: Rng;
  private readonly equipos: Record<Lado, EstadoEquipo>;
  private readonly goles: [number, number] = [0, 0];
  private readonly tiros: [number, number] = [0, 0];
  private readonly xg: [number, number] = [0, 0];
  private readonly posesion: [number, number] = [0, 0];
  private marcador60: [number, number] = [0, 0];
  readonly eventos: EventoPartido[] = [];

  constructor(local: EquipoPartido, visitante: EquipoPartido, semilla: number) {
    this.semilla = semilla;
    this.rng = crearRng(semilla);
    this.equipos = { local: new EstadoEquipo(local), visitante: new EstadoEquipo(visitante) };
  }

  get terminado(): boolean {
    return this.minuto >= REGLAS_PARTIDO.minutos;
  }

  marcador(): [number, number] {
    return [...this.goles];
  }

  /** Orden del mánager: queda pendiente hasta la siguiente interrupción del juego. */
  darOrden(lado: Lado, orden: Orden): void {
    this.equipos[lado].pendientes.push(orden);
  }

  avanzarMinuto(): EventoPartido[] {
    if (this.terminado) return [];
    const inicio = this.eventos.length;
    this.minuto += 1;
    const m = this.minuto;
    const local = this.equipos.local;
    const visitante = this.equipos.visitante;

    this.evaluarCondicionales();
    this.revisarCansancio();

    // Posesión del minuto
    const difMedio = (local.centroCampo(m) - visitante.centroCampo(m)) / C.escala;
    const difPresion = PRESION[local.tactica.presion][0] - PRESION[visitante.tactica.presion][0];
    let pLocal = 0.5 + C.pesoPosesion * Math.tanh(difMedio) + C.ventajaLocal + difPresion;
    pLocal = Math.min(0.85, Math.max(0.15, pLocal));
    const ladoAtaca: Lado = this.rng() < pLocal ? "local" : "visitante";
    const ladoDefiende: Lado = ladoAtaca === "local" ? "visitante" : "local";
    const at = this.equipos[ladoAtaca];
    const df = this.equipos[ladoDefiende];
    const ia = ladoAtaca === "local" ? 0 : 1;
    this.posesion[ia] += 1;

    // ¿Llega una ocasión?
    let huboTiro = false;
    const mult = MENTALIDAD[at.tactica.mentalidad][0] * MENTALIDAD[df.tactica.mentalidad][1];
    const bonusLocal = ladoAtaca === "local" ? C.peligroLocal : 1;
    const difAtaque = (at.ataque(m) - df.defensa(m)) / C.escala;
    const pTiro = C.baseTirosMinuto * Math.exp(C.pesoAtaque * Math.tanh(difAtaque)) * mult * bonusLocal;
    if (this.rng() < Math.min(0.6, pTiro)) {
      huboTiro = true;
      this.tiros[ia] += 1;
      const difTiro = (at.definicion() - df.portero()) / C.escala;
      let xg = C.baseXg * Math.exp(C.pesoTiro * Math.tanh(difTiro));
      xg = Math.min(C.xgMaximo, xg * uniforme(this.rng, 0.4, 1.6));
      this.xg[ia] += xg;
      if (this.rng() < xg) {
        this.goles[ia] += 1;
        const goleador = at.goleador(this.rng);
        this.registrar({
          minuto: m,
          tipo: "gol",
          lado: ladoAtaca,
          xg,
          jugadorId: goleador.id,
          texto: `¡Gol de ${goleador.nombre} (${at.nombre})! ${this.goles[0]}-${this.goles[1]}`,
        });
      } else if (xg > 0.25) {
        this.registrar({ minuto: m, tipo: "ocasion", lado: ladoAtaca, xg, texto: `Ocasión clarísima de ${at.nombre}` });
      }
    }

    local.cansar();
    visitante.cansar();

    // Interrupción del juego: se aplican las órdenes pendientes
    const descanso = m === 45;
    if (descanso || huboTiro || this.rng() < C.probabilidadInterrupcion) {
      for (const lado of LADOS) this.aplicarPendientes(lado, descanso);
    }

    if (m === 59) this.marcador60 = [...this.goles];
    if (descanso) {
      this.registrar({ minuto: m, tipo: "descanso", texto: `Descanso: ${this.goles[0]}-${this.goles[1]}` });
    }
    if (this.terminado) {
      this.registrar({ minuto: m, tipo: "final", texto: `Final: ${this.goles[0]}-${this.goles[1]}` });
    }
    return this.eventos.slice(inicio);
  }

  simularCompleto(): ResultadoPartido {
    while (!this.terminado) this.avanzarMinuto();
    return this.resultado();
  }

  resultado(): ResultadoPartido {
    const totalPosesion = this.posesion[0] + this.posesion[1] || 1;
    const pl = Math.round((100 * this.posesion[0]) / totalPosesion);
    return {
      goles: [...this.goles],
      tiros: [...this.tiros],
      xg: [Math.round(this.xg[0] * 100) / 100, Math.round(this.xg[1] * 100) / 100],
      posesion: [pl, 100 - pl],
      eventos: [...this.eventos],
      marcador60: [...this.marcador60],
      semilla: this.semilla,
      cansancioFinal: Object.fromEntries(
        LADOS.flatMap((l) => [...this.equipos[l].participantes].map((id) => [id, Math.round((this.equipos[l].cansancio.get(id) ?? 0) * 100) / 100])),
      ),
      participantes: LADOS.flatMap((l) => [...this.equipos[l].participantes]),
    };
  }

  // -------------------------------------------------------------------------

  private registrar(e: EventoPartido): void {
    this.eventos.push(e);
  }

  private evaluarCondicionales(): void {
    for (const lado of LADOS) {
      const eq = this.equipos[lado];
      const propio = this.goles[lado === "local" ? 0 : 1];
      const rival = this.goles[lado === "local" ? 1 : 0];
      const situacion = propio < rival ? "perdiendo" : propio === rival ? "empatando" : "ganando";
      for (const c of eq.condicionales) {
        if (eq.condicionalesUsadas.has(c.id)) continue;
        if (this.minuto < c.desdeMinuto || c.marcador !== situacion) continue;
        eq.condicionalesUsadas.add(c.id);
        if (c.accion.mentalidad || c.accion.presion) {
          eq.pendientes.push({ tipo: "tactica", mentalidad: c.accion.mentalidad, presion: c.accion.presion });
        }
        if (c.accion.cambio) {
          const sale = eq.masCansado(c.accion.cambio.salePosicion);
          const entra = eq.banquillo.find((j) => j.posicion === c.accion.cambio!.entraPosicion);
          if (sale && entra) eq.pendientes.push({ tipo: "cambio", saleId: sale.id, entraId: entra.id });
        }
        this.registrar({ minuto: this.minuto, tipo: "condicional", lado, texto: `Se activa una instrucción de ${eq.nombre}` });
      }
    }
  }

  private revisarCansancio(): void {
    if (!(REGLAS_PARTIDO.revisionCansancio as readonly number[]).includes(this.minuto)) return;
    for (const lado of LADOS) {
      const eq = this.equipos[lado];
      if (!eq.segundoEntrenador || eq.cambios >= REGLAS_PARTIDO.maximoCambios) continue;
      const cansado = eq.masCansado();
      if (!cansado || (eq.cansancio.get(cansado.id) ?? 0) <= REGLAS_PARTIDO.umbralCansancio) continue;
      const entra = eq.banquillo.find((j) => j.posicion === cansado.posicion);
      if (entra) eq.pendientes.push({ tipo: "cambio", saleId: cansado.id, entraId: entra.id });
    }
  }

  private aplicarPendientes(lado: Lado, descanso: boolean): void {
    const eq = this.equipos[lado];
    if (eq.pendientes.length === 0) return;
    const ordenes = eq.pendientes;
    eq.pendientes = [];
    let huboCambio = false;

    for (const o of ordenes) {
      if (o.tipo === "tactica") {
        if (o.mentalidad) eq.tactica.mentalidad = o.mentalidad;
        if (o.presion) eq.tactica.presion = o.presion;
        eq.adaptacionHasta = this.minuto + Math.round(5 - 2 * eq.familiaridad);
        this.registrar({
          minuto: this.minuto,
          tipo: "tactica",
          lado,
          texto: `${eq.nombre} cambia el planteamiento: ${eq.tactica.mentalidad}, presión ${eq.tactica.presion}`,
        });
        continue;
      }
      // Cambio de jugador
      const ventanaDisponible = descanso || huboCambio || eq.ventanasUsadas < REGLAS_PARTIDO.ventanasCambio;
      if (eq.cambios >= REGLAS_PARTIDO.maximoCambios || !ventanaDisponible) continue;
      const sale = eq.titulares.find((j) => j.id === o.saleId);
      const entra = eq.banquillo.find((j) => j.id === o.entraId);
      if (!sale || !entra) continue;
      eq.titulares = eq.titulares.map((j) => (j.id === sale.id ? entra : j));
      eq.participantes.add(entra.id);
      eq.banquillo = eq.banquillo.filter((j) => j.id !== entra.id);
      eq.cambios += 1;
      if (!huboCambio && !descanso) eq.ventanasUsadas += 1;
      huboCambio = true;
      this.registrar({ minuto: this.minuto, tipo: "cambio", lado, texto: `Cambio en ${eq.nombre}: entra ${entra.nombre} por ${sale.nombre}` });
    }
  }
}

/** Atajo: simula un partido completo sin directo. */
export function simularPartido(local: EquipoPartido, visitante: EquipoPartido, semilla: number): ResultadoPartido {
  return new SimuladorPartido(local, visitante, semilla).simularCompleto();
}
