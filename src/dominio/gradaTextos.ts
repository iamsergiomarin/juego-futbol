/**
 * Textos de La Grada. Cada cuenta tiene su carácter: el optimista, el pesimista, el que sabe de
 * pizarra, el bromista, la peña, la crónica, el columnista polémico y la cuenta oficial.
 *
 * Marcas: {club} {rival} {marcador} (siempre con nuestros goles primero) {resultado} (local primero)
 * {destacado} {goleador} {n} {pos} {puntos} {jornada} {etiqueta} {ronda} {lesionado} {tipo} {baja}
 * {asistencia} {jugador} {puesto} {media} {edad} {precio} {comprador} {division} {siguiente} {numero}
 * {hasta} {manager} {ciudad}.
 *
 * Sin artículos delante del rival ("el", "del", "al"): sus nombres no concuerdan todos en género.
 */

export type Clase =
  | "goleada"
  | "victoria"
  | "agonia"
  | "remontada"
  | "empate"
  | "empate_final"
  | "empate0"
  | "derrota"
  | "derrota_dura"
  | "derrota_tarde";

export type Banco = Record<Clase, string[]>;

export const AFICION_OPTIMISTA: Banco = {
  goleada: [
    "¡Qué manera de ganar! {marcador} y a seguir soñando. Esto es otra cosa.",
    "Hoy me he divertido como hace años. {marcador} ante {rival}. ¡Así se hace!",
  ],
  victoria: [
    "Tres puntos más y a seguir. {marcador} ante {rival}: lo que importa es sumar.",
    "Ganar es un hábito, y este equipo lo está cogiendo. {marcador}.",
  ],
  agonia: [
    "¡¡EL GOL EN EL FINAL!! No me quedan uñas. Este equipo no se rinde nunca.",
    "Gol en el último suspiro y {marcador}. Esto se llama tener fe.",
  ],
  remontada: [
    "Nos ponemos por detrás y le damos la vuelta. ¡Ese es el carácter que quiero ver! {marcador}",
    "REMONTADA ante {rival}. Que nadie me diga que este equipo está muerto.",
  ],
  empate: [
    "Reparto de puntos ({marcador}). Sin drama: hay equipo y hay plantilla.",
    "No ganamos, pero tampoco perdimos. Un punto siempre suma.",
  ],
  empate_final: [
    "¡Rescatamos un punto al final! {marcador}. Este equipo compite hasta el último segundo.",
    "Qué alegría ese gol tardío. Un punto que sabe a victoria.",
  ],
  empate0: ["0-0 sin goles, pero atrás estuvimos sólidos. Un punto es un punto.", "Partido trabado ante {rival}. Sin goles, pero sin sustos."],
  derrota: [
    "Hoy no salió. Cabeza arriba, que esto es largo y la plantilla es buena.",
    "Tropezón ante {rival} ({marcador}). Lo importante es levantarse.",
  ],
  derrota_dura: [
    "Mal día, malísimo. Pero esto no define nuestra temporada. A seguir.",
    "Un {marcador} duele, no lo voy a negar. La semana que viene, a por todas.",
  ],
  derrota_tarde: [
    "Perder así, al final, duele el doble. Pero el equipo compitió.",
    "Qué rabia. Compitimos de sobra y nos llevamos un mazazo en el último momento.",
  ],
};

export const AFICION_PESIMISTA: Banco = {
  goleada: [
    "Muy bien, sí. Pero me lo creo cuando lo repitamos tres jornadas seguidas.",
    "Ganar {marcador} no tapa que cada semana hay algo que mejorar. A ver si dura.",
  ],
  victoria: [
    "Ganamos ({marcador}) pero sufriendo más de la cuenta ante {rival}. Así no vamos lejos.",
    "Tres puntos, vale. El juego, otra cosa.",
  ],
  agonia: [
    "Se ganó de milagro. Si no cae ese gol, hoy estaríamos hablando de otra cosa.",
    "¿Era necesario llegar al minuto 90 para esto? Me va a dar algo.",
  ],
  remontada: [
    "La remontada está bien, pero ¿por qué nos ponemos siempre por detrás? Así no es sostenible.",
    "Menudo susto. Por detrás ante {rival}… no me gusta esa costumbre.",
  ],
  empate: ["Otro empate… {marcador}. Los puntos que se escapan hoy se echan de menos en primavera.", "Sabe a poco. {marcador}."],
  empate_final: [
    "Gracias al gol del final nos llevamos un punto. Si no, otra tarde de lamentos.",
    "Un punto de rebote. Hoy hemos tenido más suerte que fútbol.",
  ],
  empate0: ["0-0. Ni un tiro a puerta decente. Aburrimiento total.", "Sin goles otra vez. Así no se asciende."],
  derrota: [
    "Lo de siempre. Ante {rival} había que ganar y no apareció nadie.",
    "{marcador}. Otra vez sin reaccionar a tiempo. Me voy a casa de mal humor.",
  ],
  derrota_dura: [
    "Esto no es una derrota, es un correctivo. {marcador} ante {rival}. Alguien tiene que dar explicaciones.",
    "Vergüenza ajena. Que alguien me explique qué se entrenó esta semana.",
  ],
  derrota_tarde: [
    "Otra vez se nos escapa al final. Esto ya no es mala suerte, es falta de oficio.",
    "Perder así es de equipo pequeño. Lo siento, pero lo digo.",
  ],
};

export const AFICION_TACTICO: Banco = {
  goleada: [
    "Gran partido en la presión alta: robos arriba y {marcador}. Los datos acompañan.",
    "Salida limpia, extremos abiertos y mucha llegada. Mérito de la pizarra.",
  ],
  victoria: [
    "Control del partido más que dominio. Ganar {marcador} sin pasar apuros es señal de equipo bien armado.",
    "Los cambios del segundo tiempo dieron frescura. Partido bien leído.",
  ],
  agonia: [
    "Nos replegamos demasiado en el tramo final y casi lo pagamos. Se ganó, pero ojo con eso.",
    "Ganar en el descuento tiene mérito; dejar que {rival} llegara hasta ahí, menos.",
  ],
  remontada: [
    "El cambio de ritmo tras el descanso lo cambió todo: más posesión y gente por dentro. Gran lectura.",
    "Reajuste táctico perfecto: pasamos de sufrir a mandar. Así se remonta.",
  ],
  empate: ["Partido de ida y vuelta, resultado justo. Faltó pegada; las ocasiones estuvieron.", "Resultado justo ({marcador}). Dos equipos que se anularon."],
  empate_final: [
    "Merecido el gol del final: llevábamos un rato empujando y el cambio ofensivo dio resultado.",
    "El empate llegó tras meter más gente en el área. Apuesta valiente que salió bien.",
  ],
  empate0: ["0-0 trabado. Dos bloques bajos y ni un desmarque que rompiera la línea.", "Cero ocasiones claras. Con el balón no supimos hacer daño."],
  derrota: [
    "Perdimos el centro del campo y {rival} lo notó. Sin posesión es difícil competir.",
    "Defender con la línea tan adelantada ante un rival rápido es jugar con fuego. Pasó factura.",
  ],
  derrota_dura: [
    "Línea defensiva partida, medios sin ayudas… un {marcador} que se explica solo con el vídeo.",
    "Hoy falló todo el sistema: presión desordenada y transiciones lentas.",
  ],
  derrota_tarde: [
    "Ese gol final nace de una pérdida en la salida. Se podía evitar con un cambio más defensivo en el 80'.",
    "Cuando vas por delante o igualado en el tramo final, hay que cerrar el partido. Faltó gestión.",
  ],
};

export const AFICION_BROMISTA: Banco = {
  goleada: [
    "{marcador}. Mi vecino hincha de {rival} ya no me saluda. Mejor así 😂",
    "Hoy se ha ganado con tantos goles que me debo una ronda. ¡Invito yo!",
  ],
  victoria: [
    "Ganamos y mi gato ya no huye cuando suena el himno. Progreso.",
    "Tres puntos. El resto, anécdota. Qué bien sienta esto.",
  ],
  agonia: [
    "Gol en el minuto 90. Mi corazón: dimite. Mi abuela: pide una tila. El equipo: ganó. Todos contentos.",
    "Casi me da algo, pero ha merecido la pena. Que alguien me traiga agua.",
  ],
  remontada: [
    "Perdiendo ya estaba pensando qué cenar. Remontamos y la cena se enfría. Sin quejas.",
    "Por detrás me había ido al bar mentalmente. Por suerte, el equipo no.",
  ],
  empate: ["Empatamos. Es como pedir una pizza y que te traigan media. Mejor que nada.", "Un puntito. Como un café sin azúcar: se bebe, pero sin ganas."],
  empate_final: ["Gol al final y un punto. Mi cardiólogo ha pedido el traslado.", "Empate en el último segundo. Hoy me he comido las uñas y las del vecino."],
  empate0: ["0-0. He visto más acción en un vídeo de mi cuñado cortando el césped.", "Sin goles. Al menos el bocadillo del descanso estaba bueno."],
  derrota: ["Hoy hemos perdido, pero la cerveza de la grada sigue siendo la mejor de la categoría. Consuelo.", "Perdimos. Yo ya he pedido la hoja de reclamaciones… al camarero."],
  derrota_dura: ["{marcador}. Voy a tomármelo como un ejercicio de humildad. Y a cambiar de bar.", "Hoy ni los patos del parque nos habrían ganado así. Bueno, quizá."],
  derrota_tarde: ["Perder en el 90'. Mi cardiólogo ha pedido el traslado, otra vez.", "Tan cerca y tan lejos… Como mi cuñado de acertar una porra."],
};

export const PENA: Banco = {
  goleada: [
    "¡Fiesta en el fondo! {marcador}. Gracias por no dejarnos solos, jugadores.",
    "Hoy la grada cantó hasta quedarse sin voz. {marcador}. ¡Así da gusto!",
  ],
  victoria: [
    "Otra vez sacando adelante el partido. Gracias a todos los que cantaron los 90 minutos. {marcador}.",
    "Los tres puntos se quedan en casa. Gracias, fondo, por empujar.",
  ],
  agonia: [
    "Se nos quedó la garganta en ese gol. {marcador}. ¡Este equipo merece que lo animemos siempre!",
    "¡Locura en la grada! Lo gritamos hasta el final. {marcador}.",
  ],
  remontada: [
    "Cuando el equipo flaquea, la grada empuja. Hoy empujó. {marcador}.",
    "Ni perdiendo dejamos de cantar. La peña lo sabía: esto se daba la vuelta.",
  ],
  empate: ["Punto y a seguir. La grada vuelve a estar ahí, como siempre.", "Un punto no es lo que queríamos, pero aquí nadie se va."],
  empate_final: ["¡Salvamos un punto al final! La peña lo cantó hasta el último minuto.", "Gol al final y desatado el fondo. Nunca se da un partido por perdido."],
  empate0: ["Sin goles hoy, pero con la voz entera. La peña no se calla nunca.", "0-0. Nosotros animamos igual."],
  derrota: ["Se pierde, se sigue. Nosotros no nos vamos. Cabeza alta, equipo.", "Hoy no se pudo. La peña seguirá en el fondo de pie."],
  derrota_dura: ["Hoy duele, y mucho. Pero la camiseta no se negocia. La peña seguirá en el fondo.", "Un golpe duro. Mañana toca levantar la cabeza juntos."],
  derrota_tarde: ["Nos quitan el punto en el último suspiro. Ni un reproche: aplausos para los once.", "Un golpe en el minuto final. La grada sigue de pie."],
};

export const PRENSA_CRONICA: Banco = {
  goleada: ["#{etiqueta} | {club} arrolla a {rival} ({resultado}). {destacado}", "#{etiqueta} | Exhibición de {club}: {resultado} ante {rival}. {destacado}"],
  victoria: ["#{etiqueta} | {club} se impone a {rival} ({resultado}) y suma tres puntos más. {destacado}", "#{etiqueta} | Victoria de {club} sobre {rival}: {resultado}. {destacado}"],
  agonia: ["#{etiqueta} | Final de infarto: {club} gana a {rival} en los minutos finales ({resultado}). {destacado}", "#{etiqueta} | {club} lo gana en el tramo final ante {rival}: {resultado}. {destacado}"],
  remontada: ["#{etiqueta} | Remontada de {club} ante {rival}: de ir por detrás al {resultado}. {destacado}", "#{etiqueta} | {club} le da la vuelta al partido y vence a {rival} ({resultado}). {destacado}"],
  empate: ["#{etiqueta} | {club} y {rival} reparten puntos ({resultado}). {destacado}", "#{etiqueta} | Tablas en el marcador: {resultado} entre {club} y {rival}. {destacado}"],
  empate_final: ["#{etiqueta} | {club} rescata un punto en el tramo final ante {rival} ({resultado}). {destacado}", "#{etiqueta} | Gol tardío y tablas: {resultado} entre {club} y {rival}. {destacado}"],
  empate0: ["#{etiqueta} | Ni goles ni ocasiones claras: {club} y {rival} firman tablas sin goles.", "#{etiqueta} | Empate sin goles entre {club} y {rival} ({resultado})."],
  derrota: ["#{etiqueta} | {club} cae ante {rival} ({resultado}) y se complica la jornada. {destacado}", "#{etiqueta} | Tropiezo de {club}: {rival} gana {resultado}. {destacado}"],
  derrota_dura: ["#{etiqueta} | Correctivo para {club}: {rival} golea ({resultado}) y deja muchas dudas.", "#{etiqueta} | Goleada en contra: {club} naufraga ante {rival} ({resultado})."],
  derrota_tarde: ["#{etiqueta} | Mazazo al final: {rival} le arrebata el partido a {club} ({resultado}).", "#{etiqueta} | {club} se queda sin nada en el tramo final ante {rival} ({resultado})."],
};

/** Columnista polémico: solo opina cuando hay tema. */
export const COLUMNISTA: Partial<Banco> = {
  goleada: ["Está bien ganar así a {rival}, pero la verdadera medida de este equipo llegará contra los de arriba."],
  agonia: ["Ganar en el último minuto tiene su gracia. Sostener una temporada con esa fórmula, no tanto."],
  remontada: ["Remontar tiene mérito, pero ir perdiendo es un hábito peligroso. Alguien debería preguntarse por qué."],
  derrota: ["Se perdió el partido, y además se perdió la idea. {club} necesita algo más que corazón."],
  derrota_dura: ["Hay derrotas que son accidentes y derrotas que son síntomas. Esta pertenece a la segunda categoría."],
  derrota_tarde: ["Un equipo con aspiraciones no concede un gol en el descuento. Falta madurez."],
};

export const CLUB_OFICIAL: Record<"G" | "E" | "P", string[]> = {
  G: [
    "🏁 FINAL | {resultado}. ¡Gracias por el apoyo, afición! 💚",
    "✅ Tres puntos más para {club}. {resultado}. {destacado}",
    "🏁 ¡Victoria! {resultado}. Esto es de todos.",
  ],
  E: ["🏁 FINAL | {resultado}. Un punto que sumamos. A seguir trabajando.", "🤝 Reparto de puntos: {resultado}. Gracias por estar ahí."],
  P: ["🏁 FINAL | {resultado}. Toca levantarse. Gracias a la afición por acompañarnos.", "Hoy no pudo ser ({resultado}). Se trabaja y se vuelve a competir."],
};

export const RIVAL_TROLL: Record<"G" | "E" | "P", string[]> = {
  G: ["No ha sido nuestro día. Enhorabuena, {club}.", "Ganasteis, sí. Pero en la vuelta nos vemos las caras."],
  E: ["Un puntito para cada uno. Hasta la próxima, {club}.", "Reparto justo. Nos vemos en la vuelta."],
  P: ["🍿 Gracias por los tres puntos, {club}.", "Pasad por nuestra casa cuando queráis. Siempre hay sitio. 😏"],
};

export const RESPUESTA_AL_RIVAL: Record<"G" | "E" | "P", string[]> = {
  G: ["Tranquilo, hombre, que habrá revancha 😉", "Tomad nota: así se juega. Y no, no hay devoluciones."],
  E: ["Respeto. Nos vemos en la vuelta.", "Un punto para cada uno, pero ya veréis en la vuelta."],
  P: ["Hoy os toca reír. En la vuelta hablamos.", "Disfrutad mientras podáis."],
};

export const PREVIA = {
  prensa: [
    "PREVIA | Jornada {jornada}: {club} {condicion} {rival}. {contexto}",
    "PREVIA | {club} {condicion} {rival} en la jornada {jornada}. {contexto}",
  ],
  prensaPlayoff: ["PREVIA | {ronda} del playoff: {club} {condicion} {rival}. Todo se decide en 90 minutos."],
  club: ["⏰ {cuando}: {club} {condicion} {rival}. ¡Vamos!", "📅 Se acerca el partido: {cuando}, {club} {condicion} {rival}."],
  optimista: ["Ganamos a {rival} sí o sí. Lo veo clarísimo.", "Esta semana toca ganar. Se nota en los entrenamientos."],
  pesimista: ["{rival} siempre nos complica la vida. Ojo con el partido.", "No me fío de {rival}. Ya veréis."],
  tactico: ["Clave del partido ante {rival}: ganar el centro del campo y salir rápido.", "Ojo a las bandas de {rival}: ahí se decide casi todo."],
  bromista: ["Previa de {rival}: yo, nervioso; mi gato, indiferente.", "Ya tengo preparado el bocadillo. Falta que el equipo ponga su parte."],
  penaLocal: ["Fondo preparado: pancartas, tambores y gargantas. {rival} viene a ver cómo se canta.", "Todo listo en la grada. Que {rival} sepa dónde viene."],
  penaVisitante: ["Autobús de la peña saliendo hacia la ciudad de {rival}. ¡Que se oiga allí también!", "Nos vamos de viaje con {club}. La grada visitante se va a oír."],
};
