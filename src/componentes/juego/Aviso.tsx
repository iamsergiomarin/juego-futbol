/** Aviso tras una acción (llega por la dirección: ?ok=… o ?error=…). */
export function Aviso({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`mb-5 rounded-xl px-4 py-3 text-sm font-medium ${error ? "bg-rival-suave text-rival" : "bg-cesped-suave text-cesped"}`}
    >
      {error ?? ok}
    </p>
  );
}
