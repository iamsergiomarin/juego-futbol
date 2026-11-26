"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { formatoEuros, formatoFechaHora, NOMBRE_INSTALACION } from "@/componentes/formato";
import { mejorarEdificio } from "@/app/(juego)/acciones";

const Escena3D = dynamic(() => import("./Escena3D").then((m) => m.Escena3D), {
  ssr: false,
  loading: () => <div className="aspect-[4/3] w-full sm:aspect-[2.3/1]" />,
});

export interface EdificioCiudad {
  tipo: string;
  nivel: number;
  destino: number | null;
  coste: number | null;
  horas: number | null;
  obra: { destino: number; fin: string } | null;
}

interface Props {
  edificios: EdificioCiudad[];
  principal: string;
  secundario: string;
  aforo: number;
  dinero: number;
  nombreClub: string;
}

const TEXTO: Record<string, { descripcion: string; efecto: string }> = {
  estadio: { descripcion: "El campo donde se decide todo. Cada tribuna nueva trae más gente y más taquilla.", efecto: "Más aforo en cada nivel." },
  sede: { descripcion: "Despachos, sala de vídeo y oficina de ojeadores: de aquí salen los fichajes.", efecto: "Sube la dirección deportiva y la oficina de ojeadores." },
  ciudad_deportiva: { descripcion: "Campos de entrenamiento, gimnasio y zona de porteros.", efecto: "Los entrenamientos rinden más." },
  centro_medico: { descripcion: "Médico, fisioterapia y área de bienestar.", efecto: "Recorta jornadas de baja a los lesionados." },
  escuela_cantera: { descripcion: "Residencia, aulas y campo propio para los chavales de la casa.", efecto: "Hornadas con más nivel, más juveniles y más opciones de joya." },
};

/** Posiciones de cada edificio en la escena (ancho 1200, línea de suelo en y = base). */
const COLOCACION: Record<string, { x: number; base: number; escala: number }> = {
  ciudad_deportiva: { x: 20, base: 372, escala: 0.9 },
  sede: { x: 270, base: 408, escala: 1 },
  estadio: { x: 440, base: 416, escala: 1 },
  centro_medico: { x: 865, base: 408, escala: 1 },
  escuela_cantera: { x: 1010, base: 372, escala: 0.9 },
};

export function Ciudad({ edificios, principal, secundario, aforo, dinero, nombreClub }: Props) {
  const [elegido, setElegido] = useState<string>("estadio");
  const [sin3d, setSin3d] = useState(false);
  const nivelDe = (t: string) => edificios.find((e) => e.tipo === t)?.nivel ?? 0;
  const obraDe = (t: string) => edificios.find((e) => e.tipo === t)?.obra ?? null;
  const e = edificios.find((x) => x.tipo === elegido)!;
  // La escena crece con el club: el cielo se recorta hasta la silueta más alta.
  const techo = Math.min(
    ...Object.entries(COLOCACION).map(([t, c]) => {
      const n = nivelDe(t) + (obraDe(t) ? 1 : 0);
      return c.base - c.escala * (altoDe(t, Math.max(n, 1)) + (t === "estadio" && n >= 3 ? 110 : 80));
    }),
  );
  const arriba = Math.max(0, Math.min(250, Math.round(techo - 24)));
  const texto = TEXTO[elegido];

  return (
    <section aria-label={`Ciudad de ${nombreClub}`}>
      <div className="overflow-hidden rounded-3xl border border-borde bg-noche">
        {sin3d ? (
        <svg viewBox={`0 ${arriba} 1200 ${540 - arriba}`} role="img" aria-label="Los edificios del club" className="block h-auto w-full">
          <defs>
            <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--cielo-alto)" />
              <stop offset="1" stopColor="var(--cielo-bajo)" />
            </linearGradient>
            <pattern id="cesped" width="96" height="10" patternUnits="userSpaceOnUse">
              <rect width="96" height="10" fill="#1f6b3a" />
              <rect width="48" height="10" fill="#237a42" />
            </pattern>
          </defs>
          <rect y={arriba} width="1200" height="540" fill="url(#cielo)" />
          {/* Colinas al fondo */}
          <path d="M0 330 C140 270 260 300 380 285 C520 262 640 318 780 292 C900 270 1040 300 1200 276 V420 H0 Z" fill="var(--colina)" />
          <path d="M0 360 C180 330 320 352 500 340 C700 326 900 352 1200 330 V420 H0 Z" fill="var(--colina)" opacity="0.7" />
          {/* Suelo: césped segado en franjas y calle */}
          <rect y="372" width="1200" height="168" fill="url(#cesped)" />
          <rect y="430" width="1200" height="52" fill="#2d3a33" />
          <path d="M0 456 H1200" stroke="var(--tiza)" strokeWidth="3" strokeDasharray="34 26" opacity="0.8" />
          <rect y="482" width="1200" height="58" fill="#12351f" />

          {/* Fila trasera primero para que los de delante la tapen */}
          {["ciudad_deportiva", "escuela_cantera", "sede", "centro_medico", "estadio"].map((tipo) => {
            const c = COLOCACION[tipo];
            const nivel = nivelDe(tipo);
            const obra = obraDe(tipo);
            const activo = elegido === tipo;
            return (
              <g
                key={tipo}
                transform={`translate(${c.x} ${c.base}) scale(${c.escala})`}
                role="button"
                tabIndex={0}
                aria-label={`${NOMBRE_INSTALACION[tipo]}, nivel ${nivel}`}
                aria-pressed={activo}
                onClick={() => setElegido(tipo)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    setElegido(tipo);
                  }
                }}
                className="cursor-pointer outline-none [&:focus-visible>rect.foco]:stroke-[#f4f1e8] [&:focus-visible>rect.foco]:opacity-100"
              >
                <rect className="foco" x="-12" y={-(altoDe(tipo, Math.max(nivel, 1)) + 84)} width={anchoDe(tipo) + 24} height={altoDe(tipo, Math.max(nivel, 1)) + 96} rx="14" fill="transparent" strokeWidth="3" strokeDasharray="8 6" stroke="#f4f1e8" opacity={activo ? 0.95 : 0} />
                {nivel === 0 ? <Solar ancho={anchoDe(tipo)} sinCartel={!!obra} /> : null}
                {tipo === "estadio" && nivel > 0 ? <Estadio nivel={nivel} principal={principal} secundario={secundario} /> : null}
                {tipo === "sede" && nivel > 0 ? <Sede nivel={nivel} principal={principal} /> : null}
                {tipo === "ciudad_deportiva" && nivel > 0 ? <CiudadDeportiva nivel={nivel} /> : null}
                {tipo === "centro_medico" && nivel > 0 ? <CentroMedico nivel={nivel} /> : null}
                {tipo === "escuela_cantera" && nivel > 0 ? <Escuela nivel={nivel} principal={principal} /> : null}
                {obra ? <Grua ancho={anchoDe(tipo)} alto={altoDe(tipo, nivel)} /> : null}
              </g>
            );
          })}

          {/* Rótulos sobre la calle */}
          {Object.entries(COLOCACION).map(([tipo, c]) => (
            <g key={`r-${tipo}`} pointerEvents="none">
              <rect
                x={c.x + (anchoDe(tipo) * c.escala) / 2 - 75}
                y="437"
                width="150"
                height="28"
                rx="5"
                fill="#12351f"
                opacity={elegido === tipo ? 0.95 : 0.8}
              />
              <text
                x={c.x + (anchoDe(tipo) * c.escala) / 2}
                y="458"
                textAnchor="middle"
                fontFamily="var(--font-titulo)"
                fontWeight="700"
                fontSize="18"
                fill="var(--tiza)"
                opacity={elegido === tipo ? 1 : 0.75}
              >
                {NOMBRE_INSTALACION[tipo].toUpperCase()}
              </text>
            </g>
          ))}
          <text x="24" y="518" fontFamily="var(--font-titulo)" fontWeight="600" fontSize="22" fill="var(--tiza)" opacity="0.9">
            {nombreClub}
          </text>
          <text x="1176" y="518" textAnchor="end" fontFamily="var(--font-titulo)" fontWeight="600" fontSize="22" fill="var(--tiza)" opacity="0.9">
            {aforo.toLocaleString("es-ES")} localidades
          </text>
        </svg>
        ) : (
          <div className="relative">
            <Escena3D
              edificios={edificios.map((x) => ({ tipo: x.tipo, nivel: x.nivel, enObra: !!x.obra }))}
              elegido={elegido}
              onElegir={setElegido}
              onFallo={() => setSin3d(true)}
              principal={principal}
              secundario={secundario}
            />
            <p className="titulo pointer-events-none absolute bottom-2 left-4 text-lg font-semibold text-tiza/90 sm:text-xl">{nombreClub}</p>
            <p className="titulo pointer-events-none absolute right-4 bottom-2 text-lg font-semibold text-tiza/90 sm:text-xl">
              {aforo.toLocaleString("es-ES")} localidades
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="titulo text-4xl font-bold">{NOMBRE_INSTALACION[elegido]}</h2>
            <p className="titulo text-2xl font-semibold text-cesped">{e.nivel === 0 ? (e.obra ? "En obras" : "Solar vacío") : `Nivel ${e.nivel} de 5`}</p>
          </div>
          <p className="mt-2 max-w-xl text-suave">{texto.descripcion}</p>
          <p className="mt-1 max-w-xl text-sm text-suave">{texto.efecto}</p>
        </div>
        <div className="rounded-2xl border border-borde bg-superficie p-5">
          {e.obra ? (
            <p className="text-sm">
              <span className="titulo text-xl font-semibold">Obras en marcha.</span> Se inaugura el nivel {e.obra.destino} el{" "}
              {formatoFechaHora(e.obra.fin)}, al jugarse la jornada siguiente.
            </p>
          ) : e.destino ? (
            <form action={mejorarEdificio} className="flex flex-wrap items-center justify-between gap-4">
              <input type="hidden" name="edificio" value={e.tipo} />
              <input type="hidden" name="volver" value="/club/ciudad" />
              <div>
                <p className="titulo text-xl font-semibold">{e.nivel === 0 ? "Construir" : `Mejorar al nivel ${e.destino}`}</p>
                <p className="text-sm text-suave">
                  {formatoEuros(e.coste!)} por adelantado · {e.horas} h de obra
                </p>
              </div>
              <button
                disabled={dinero < e.coste!}
                className="rounded-full bg-cesped px-5 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:text-black"
              >
                {e.nivel === 0 ? "Construir" : "Mejorar"}
              </button>
            </form>
          ) : (
            <p className="text-sm">
              <span className="titulo text-xl font-semibold">Nivel máximo.</span> Este edificio ya no admite más mejoras.
            </p>
          )}
          <p className="mt-3 border-t border-borde pt-3 text-xs text-suave">
            En caja: {formatoEuros(dinero)}.{" "}
            <Link href="/club/instalaciones" className="font-semibold text-cesped underline-offset-2 hover:underline">
              Ver todas las áreas
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

function anchoDe(tipo: string): number {
  return { estadio: 390, sede: 150, ciudad_deportiva: 230, centro_medico: 125, escuela_cantera: 170 }[tipo] ?? 150;
}

function altoDe(tipo: string, nivel: number): number {
  switch (tipo) {
    case "estadio":
      return 80 + nivel * 24;
    case "sede":
      return 50 + nivel * 36;
    case "centro_medico":
      return 40 + nivel * 28;
    case "escuela_cantera":
      return 60 + nivel * 10;
    default:
      return 60;
  }
}

/* ------------------------------ edificios ------------------------------ */

function Solar({ ancho, sinCartel = false }: { ancho: number; sinCartel?: boolean }) {
  return (
    <g>
      <rect x="0" y="-26" width={ancho} height="26" fill="var(--albero)" opacity="0.85" />
      <path d={`M0 -26 H${ancho}`} stroke="#6b4e1c" strokeWidth="2" strokeDasharray="6 5" />
      {sinCartel ? null : (
        <>
          <rect x={ancho / 2 - 46} y="-66" width="92" height="30" rx="3" fill="var(--tiza)" />
          <text x={ancho / 2} y="-45" textAnchor="middle" fontFamily="var(--font-titulo)" fontWeight="700" fontSize="18" fill="#12351f">
            SE VENDE
          </text>
          <path d={`M${ancho / 2 - 30} -36 V-26 M${ancho / 2 + 30} -36 V-26`} stroke="#6b4e1c" strokeWidth="3" />
        </>
      )}
    </g>
  );
}

function Estadio({ nivel, principal, secundario }: { nivel: number; principal: string; secundario: string }) {
  const w = 390;
  const alto = 70 + nivel * 24;
  const pisos = Math.min(nivel, 4);
  return (
    <g>
      {/* Torres de focos */}
      {nivel >= 3 ? <Foco x={-6} alto={alto + 62} /> : null}
      {nivel >= 3 ? <Foco x={w + 6} alto={alto + 62} /> : null}
      {nivel >= 5 ? <Foco x={w * 0.3} alto={alto + 42} /> : null}
      {nivel >= 5 ? <Foco x={w * 0.7} alto={alto + 42} /> : null}
      {/* Cuerpo */}
      <rect x="0" y={-alto} width={w} height={alto} fill="#d8d4c8" />
      <rect x="0" y={-alto} width={w} height="8" fill="#b9b4a5" />
      {/* Pisos de gradas con ventanales y arcadas */}
      {Array.from({ length: pisos }).map((_, i) => {
        const y = -alto + 14 + i * ((alto - 40) / pisos);
        return (
          <g key={i}>
            <rect x="14" y={y} width={w - 28} height={(alto - 40) / pisos - 6} fill="#8f9a96" opacity="0.55" />
            {Array.from({ length: 17 }).map((_, k) => (
              <rect key={k} x={22 + k * 21.5} y={y + 4} width="12" height={(alto - 40) / pisos - 14} rx="2" fill="#2f3b45" opacity="0.8" />
            ))}
          </g>
        );
      })}
      {/* Puertas */}
      {Array.from({ length: 6 }).map((_, k) => (
        <path key={k} d={`M${30 + k * 62} 0 V-14 a10 10 0 0 1 20 0 V0 Z`} fill="#222c33" />
      ))}
      {/* Banda del club */}
      <rect x="0" y="-24" width={w} height="6" fill={principal} />
      <rect x="0" y="-18" width={w} height="3" fill={secundario} />
      {/* Cubierta */}
      {nivel >= 2 ? (
        <path
          d={`M-10 ${-alto + 2} L${w + 10} ${-alto + 2} L${w - 8} ${-alto - 18 - nivel * 3} L8 ${-alto - 18 - nivel * 3} Z`}
          fill={nivel >= 4 ? principal : "#7e8a8f"}
          stroke="#2b3438"
          strokeWidth="2"
        />
      ) : (
        <rect x="-6" y={-alto - 6} width={w + 12} height="8" fill="#7e8a8f" />
      )}
      {/* Rótulo */}
      <rect x={w / 2 - 70} y={-alto - 4} width="140" height="0" fill="none" />
    </g>
  );
}

function Foco({ x, alto }: { x: number; alto: number }) {
  return (
    <g>
      <rect x={x - 3} y={-alto} width="6" height={alto} fill="#59636a" />
      <rect x={x - 17} y={-alto - 12} width="34" height="14" rx="2" fill="#2b3438" />
      {[-10, -3, 4, 11].map((d) => (
        <circle key={d} cx={x + d} cy={-alto - 5} r="2.6" fill="#fff6c9" />
      ))}
    </g>
  );
}

function Sede({ nivel, principal }: { nivel: number; principal: string }) {
  const w = 150;
  const plantas = 1 + nivel;
  const alto = 50 + nivel * 36;
  return (
    <g>
      <rect x="0" y={-alto} width={w} height={alto} fill="#e9e6dc" />
      <rect x="0" y={-alto} width={w} height="10" fill={principal} />
      {Array.from({ length: plantas }).map((_, p) =>
        Array.from({ length: 5 }).map((_, k) => (
          <rect
            key={`${p}-${k}`}
            x={14 + k * 25}
            y={-alto + 22 + p * ((alto - 50) / plantas)}
            width="16"
            height={Math.min(18, (alto - 50) / plantas - 8)}
            fill={(p * 5 + k) % 4 === 0 ? "#f6d77a" : "#34495a"}
          />
        ))
      )}
      <rect x={w / 2 - 14} y="-34" width="28" height="34" fill="#222c33" />
      {nivel >= 4 ? <path d={`M${w / 2} ${-alto - 34} V${-alto}`} stroke="#59636a" strokeWidth="3" /> : null}
      {nivel >= 4 ? <path d={`M${w / 2} ${-alto - 32} h30 v12 h-30 Z`} fill={principal} /> : null}
    </g>
  );
}

function CiudadDeportiva({ nivel }: { nivel: number }) {
  const campos = Math.min(3, 1 + Math.floor((nivel - 1) / 2) + (nivel >= 2 ? 0 : 0));
  return (
    <g>
      {Array.from({ length: campos }).map((_, i) => {
        const x = i * 70;
        return (
          <g key={i} transform={`translate(${x} 0)`}>
            <path d="M0 0 H150 L128 -42 H22 Z" fill="#2d8a4e" stroke="var(--tiza)" strokeWidth="2" opacity="0.98" />
            <path d="M75 0 V-42" stroke="var(--tiza)" strokeWidth="1.5" />
            <ellipse cx="75" cy="-21" rx="12" ry="6" fill="none" stroke="var(--tiza)" strokeWidth="1.5" />
          </g>
        );
      })}
      {nivel >= 3 ? (
        <g transform="translate(150 -2)">
          <rect x="0" y="-62" width="80" height="62" fill="#e9e6dc" />
          <rect x="0" y="-62" width="80" height="8" fill="#59636a" />
          {[8, 30, 52].map((x) => (
            <rect key={x} x={x} y="-42" width="16" height="22" fill="#34495a" />
          ))}
        </g>
      ) : null}
      {nivel >= 5 ? (
        <g>
          <path d="M-4 0 V-80" stroke="#59636a" strokeWidth="4" />
          <rect x="-18" y="-92" width="28" height="12" rx="2" fill="#2b3438" />
        </g>
      ) : null}
    </g>
  );
}

function CentroMedico({ nivel }: { nivel: number }) {
  const w = 125;
  const alto = 40 + nivel * 28;
  return (
    <g>
      <rect x="0" y={-alto} width={w} height={alto} fill="#f2f4f2" />
      <rect x="0" y={-alto} width={w} height="8" fill="#c9d3cf" />
      {Array.from({ length: nivel }).map((_, p) =>
        [16, 48, 80].map((x) => <rect key={`${p}-${x}`} x={x} y={-alto + 16 + p * 26} width="22" height="14" fill="#7fb4c7" />)
      )}
      {/* Cruz */}
      <g transform={`translate(${w / 2} ${-alto - 22})`}>
        <circle r="18" fill="#fff" stroke="#c0392b" strokeWidth="3" />
        <path d="M-8 -3 H-3 V-8 H3 V-3 H8 V3 H3 V8 H-3 V3 H-8 Z" fill="#c0392b" />
      </g>
      <rect x={w / 2 - 12} y="-30" width="24" height="30" fill="#34495a" />
    </g>
  );
}

function Escuela({ nivel, principal }: { nivel: number; principal: string }) {
  return (
    <g>
      <rect x="0" y="-60" width="110" height="60" fill="#ead9b9" />
      <path d="M-8 -60 L55 -96 L118 -60 Z" fill={principal} />
      {[12, 42, 72].map((x) => (
        <rect key={x} x={x} y="-42" width="20" height="20" fill="#34495a" />
      ))}
      <rect x="46" y="-24" width="18" height="24" fill="#222c33" />
      <path d="M55 -96 V-120" stroke="#59636a" strokeWidth="3" />
      <path d="M55 -120 h22 v12 h-22 Z" fill="#fff" stroke={principal} strokeWidth="2" />
      {nivel >= 2 ? (
        <g>
          <path d="M96 0 H170 L156 -26 H110 Z" fill="#2d8a4e" stroke="var(--tiza)" strokeWidth="1.5" />
        </g>
      ) : null}
      {nivel >= 3 ? (
        <g transform="translate(108 -60)">
          <rect x="0" y="0" width="52" height="60" fill="#dcc79f" />
          <rect x="0" y="0" width="52" height="7" fill="#59636a" />
          {[6, 28].map((x) => (
            <rect key={x} x={x} y="18" width="16" height="14" fill="#34495a" />
          ))}
        </g>
      ) : null}
      {nivel >= 5 ? <Foco x={-4} alto={96} /> : null}
    </g>
  );
}

function Grua({ ancho, alto }: { ancho: number; alto: number }) {
  const h = Math.max(alto, 40) + 70;
  const t = ancho - 64;
  return (
    <g pointerEvents="none">
      {/* Andamio sobre la obra */}
      <rect x="-6" y={-alto} width={ancho + 12} height={alto} fill="none" stroke="#e0a82e" strokeWidth="2" strokeDasharray="5 5" />
      {/* Grúa */}
      <path d={`M${t} 0 V${-h}`} stroke="#e0a82e" strokeWidth="6" />
      <path d={`M${t - 18} ${-h} H${t + 62}`} stroke="#e0a82e" strokeWidth="5" />
      <path d={`M${t} ${-h - 24} L${t - 18} ${-h} M${t} ${-h - 24} L${t + 40} ${-h}`} stroke="#e0a82e" strokeWidth="2.5" fill="none" />
      <path d={`M${t + 40} ${-h} V${-h + 34}`} stroke="#2b3438" strokeWidth="2" />
      <rect x={t + 32} y={-h + 34} width="16" height="10" fill="#c0392b" />
      <rect x={t - 40} y={-h - 4} width="14" height="10" fill="#59636a" />
    </g>
  );
}
