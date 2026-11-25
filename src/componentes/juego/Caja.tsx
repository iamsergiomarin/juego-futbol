import Link from "next/link";

/** Caja del panel: título, enlace opcional a la sección completa y contenido. */
export function Caja({
  titulo,
  enlace,
  extra,
  children,
  className = "",
  sinRelleno = false,
}: {
  titulo: string;
  enlace?: { href: string; texto: string };
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  sinRelleno?: boolean;
}) {
  return (
    <section className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-borde bg-superficie ${className}`}>
      <div className="flex items-baseline justify-between gap-3 border-t-4 border-cesped px-5 pt-3 pb-3">
        <h2 className="titulo text-xl font-semibold">{titulo}</h2>
        {enlace ? (
          <Link href={enlace.href} className="text-sm font-semibold text-cesped hover:underline">
            {enlace.texto}
          </Link>
        ) : (
          extra
        )}
      </div>
      <div className={sinRelleno ? "flex-1" : "flex-1 px-5 pb-5"}>{children}</div>
    </section>
  );
}

export function Dato({ etiqueta, valor, nota, tono }: { etiqueta: string; valor: string; nota?: string; tono?: "positivo" | "negativo" }) {
  const color = tono === "positivo" ? "text-cesped" : tono === "negativo" ? "text-rival" : "";
  return (
    <div className="rounded-2xl border border-borde bg-superficie p-4">
      <p className="text-xs text-suave">{etiqueta}</p>
      <p className={`titulo mt-1 text-3xl font-bold tabular-nums ${color}`}>{valor}</p>
      {nota ? <p className="mt-0.5 text-xs text-suave">{nota}</p> : null}
    </div>
  );
}
