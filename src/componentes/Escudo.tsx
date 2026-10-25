/** Escudo del club: forma clásica con los dos colores y la abreviatura. */
export function Escudo({
  principal,
  secundario,
  texto,
  tamano = 64,
  titulo,
}: {
  principal: string;
  secundario: string;
  texto: string;
  tamano?: number;
  titulo?: string;
}) {
  const forma = "M50 4 L92 16 L92 52 C92 78 72 94 50 104 C28 94 8 78 8 52 L8 16 Z";
  return (
    <svg
      viewBox="0 0 100 108"
      width={tamano}
      height={(tamano * 108) / 100}
      role="img"
      aria-label={titulo ?? `Escudo ${texto}`}
      className="shrink-0"
    >
      <path d={forma} fill={principal} />
      {/* Banda central con la abreviatura */}
      <path d="M8 44 H92 V62 C91 64 90 65 89.5 66 H10.5 C10 65 9 64 8 62 Z" fill={secundario} />
      <text
        x="50"
        y="60.5"
        textAnchor="middle"
        fontSize={texto.length > 3 ? 15 : 18}
        fontWeight="800"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill={principal}
        letterSpacing="1"
      >
        {texto.toUpperCase()}
      </text>
      <path d={forma} fill="none" stroke={secundario} strokeWidth="5" strokeLinejoin="round" />
      <path d={forma} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}
