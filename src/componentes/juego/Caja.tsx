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
    <section className={`flex min-w-0 flex-col rounded-2xl border border-borde bg-superficie ${className}`}>
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="font-semibold">{titulo}</h2>
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
      <p className={`mt-1 text-xl font-bold tabular-nums ${color}`}>{valor}</p>
      {nota ? <p className="mt-0.5 text-xs text-suave">{nota}</p> : null}
    </div>
  );
}
