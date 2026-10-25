"use client";

import { useActionState, useState } from "react";
import { Escudo } from "@/componentes/Escudo";
import { crearClub, type EstadoFormulario } from "./acciones";

const INICIAL: EstadoFormulario = {
  datos: {
    nombreManager: "",
    nombreClub: "",
    abreviatura: "",
    ciudad: "",
    colorPrincipal: "#1f6b3a",
    colorSecundario: "#ffffff",
  },
  errores: {},
};

function Campo({
  etiqueta,
  ayuda,
  error,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{etiqueta}</span>
      <div className="mt-1">{children}</div>
      {error ? (
        <span className="mt-1 block text-xs text-rival">{error}</span>
      ) : ayuda ? (
        <span className="mt-1 block text-xs text-suave">{ayuda}</span>
      ) : null}
    </label>
  );
}

const ENTRADA =
  "w-full rounded-xl border border-borde bg-fondo px-3 py-2.5 text-texto outline-none focus:border-cesped focus:ring-2 focus:ring-cesped/30";

export function FormularioClub() {
  const [estado, accion, enviando] = useActionState(crearClub, INICIAL);
  const [vista, setVista] = useState(estado.datos);
  // Campos tocados desde el último envío: su error deja de mostrarse en cuanto se corrigen.
  const [tocados, setTocados] = useState<{ estado: EstadoFormulario; campos: Set<string> }>({ estado, campos: new Set() });
  const campos = tocados.estado === estado ? tocados.campos : new Set<string>();
  const e = Object.fromEntries(Object.entries(estado.errores).filter(([k]) => !campos.has(k))) as EstadoFormulario["errores"];

  const cambiar = (k: keyof typeof vista) => (ev: React.ChangeEvent<HTMLInputElement>) => {
    setVista((v) => ({ ...v, [k]: ev.target.value }));
    setTocados({ estado, campos: new Set(campos).add(k) });
  };
  const tocar = (k: keyof typeof vista) => () => setTocados({ estado, campos: new Set(campos).add(k) });

  const abreviatura = vista.abreviatura.trim() || vista.nombreClub.trim().slice(0, 3) || "TU";

  return (
    <form action={accion} className="grid gap-8 md:grid-cols-[1fr_220px]">
      <div className="space-y-5">
        <Campo etiqueta="Tu nombre como mánager" error={e.nombreManager}>
          <input name="nombreManager" className={ENTRADA} defaultValue={estado.datos.nombreManager} onChange={tocar("nombreManager")} autoComplete="nickname" required />
        </Campo>
        <Campo etiqueta="Nombre del club" ayuda="Inventado: así lo verán tus rivales." error={e.nombreClub}>
          <input name="nombreClub" className={ENTRADA} defaultValue={estado.datos.nombreClub} onChange={cambiar("nombreClub")} required />
        </Campo>
        <div className="grid grid-cols-[110px_1fr] gap-4">
          <Campo etiqueta="Abreviatura" ayuda="2-4 letras" error={e.abreviatura}>
            <input
              name="abreviatura"
              className={`${ENTRADA} uppercase`}
              maxLength={4}
              defaultValue={estado.datos.abreviatura}
              onChange={cambiar("abreviatura")}
              required
            />
          </Campo>
          <Campo etiqueta="Ciudad" error={e.ciudad}>
            <input name="ciudad" className={ENTRADA} defaultValue={estado.datos.ciudad} onChange={tocar("ciudad")} required />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo etiqueta="Color principal" error={e.colorPrincipal}>
            <input
              type="color"
              name="colorPrincipal"
              className="h-11 w-full cursor-pointer rounded-xl border border-borde bg-fondo p-1"
              defaultValue={estado.datos.colorPrincipal}
              onChange={cambiar("colorPrincipal")}
            />
          </Campo>
          <Campo etiqueta="Color secundario" error={e.colorSecundario}>
            <input
              type="color"
              name="colorSecundario"
              className="h-11 w-full cursor-pointer rounded-xl border border-borde bg-fondo p-1"
              defaultValue={estado.datos.colorSecundario}
              onChange={cambiar("colorSecundario")}
            />
          </Campo>
        </div>

        {estado.error ? <p className="rounded-xl bg-rival-suave px-3 py-2 text-sm text-rival">{estado.error}</p> : null}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-full bg-cesped px-5 py-3 font-semibold text-white disabled:opacity-60 dark:text-black"
        >
          {enviando ? "Fundando el club…" : "Fundar el club"}
        </button>
        {enviando ? (
          <p className="text-center text-xs text-suave">Generando plantilla, estadio y rivales. Tarda unos segundos.</p>
        ) : null}
      </div>

      <aside className="order-first flex flex-col items-center gap-3 rounded-2xl bg-fondo p-6 text-center md:order-none">
        <Escudo principal={vista.colorPrincipal} secundario={vista.colorSecundario} texto={abreviatura} tamano={120} />
        <p className="font-semibold leading-tight">{vista.nombreClub.trim() || "Tu club"}</p>
        <p className="text-xs text-suave">Quinta división · Grupo 1</p>
      </aside>
    </form>
  );
}
