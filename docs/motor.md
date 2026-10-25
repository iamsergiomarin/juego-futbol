# Motor de partidos

## Cómo funciona

Cada minuto:

1. **Posesión:** la decide el centro del campo de ambos equipos, la ventaja local y la presión.
2. **Ocasión:** el equipo con el balón tira según su ataque contra la defensa rival, la mentalidad de ambos y la ventaja local.
3. **Calidad del tiro (xG):** definición contra portero, con variación aleatoria.
4. **Cansancio:** según resistencia y presión. Resta hasta un 28 % de rendimiento.
5. **Interrupción:** tras un tiro o con un 55 % de probabilidad. Ahí se aplican las órdenes pendientes (cambios y táctica).

Cada ventaja está **acotada** con `tanh`: la primera versión, sin freno, daba 13-0 en desequilibrios grandes.

Otras reglas: 5 cambios en 3 ventanas más el descanso; tras un cambio táctico, 3-5 minutos de adaptación (8 % menos de rendimiento) según la familiaridad; el segundo entrenador revisa el cansancio en los minutos 65, 72 y 80.

## Calibración (4.000 partidos por escenario)

| Escenario (medias) | Local | Empate | Visitante | Goles/partido | 0-0 | Dif. 4+ goles |
| --- | --- | --- | --- | --- | --- | --- |
| Iguales 5,0 vs 5,0 | 46,5 % | 24,9 % | 28,6 % | 2,78 | 5,8 % | 4,0 % |
| Local mejor 6,0 vs 5,0 | 74,0 % | 16,6 % | 9,5 % | 3,17 | 4,4 % | 15,4 % |
| Desequilibrio 7,0 vs 4,0 | 95,5 % | 3,5 % | 0,9 % | 4,59 | 0,8 % | 52,9 % |
| Iguales, local ofensivo | 47,9 % | 21,3 % | 30,8 % | 3,33 | 3,7 % | 6,1 % |
| Iguales, local defensivo | 40,8 % | 30,7 % | 28,6 % | 2,06 | 13,3 % | 2,5 % |

Se reproduce con `npm run calibrar`.

## Sistemas de juego (desde la 0.4.0)

Cada línea pesa según cuántos jugadores tiene respecto al 4-4-2 de referencia (1 portero, 4 defensas, 4 medios, 2 delanteros): un 7 % más o menos por jugador de diferencia (`pesoPorJugadorDeLinea`). Los medios cuentan para la posesión, los delanteros para el ataque y los defensas para la defensa. El 4-4-2 sigue siendo la referencia, así que la calibración de arriba no cambia.

Con plantillas iguales, promediando local y visitante (un 4-4-2 contra otro gana el 37,5 %):

| Sistema contra un 4-4-2 | Victorias |
| --- | --- |
| 4-5-1 | 38,9 % |
| 3-5-2 | 38,9 % |
| 3-4-3 | 37,6 % |
| 5-3-2 | 36,6 % |
| 4-3-3 | 36,5 % |

Ningún sistema es mejor por sí solo; la diferencia la marcan los jugadores que encajan en cada puesto (un jugador fuera de su posición rinde menos) y la energía con la que llegan.

## Pendiente

- Dar más peso a tácticas y condicionales según el rival (ahora mueven 2-4 puntos).
- Lesiones, tarjetas, balón parado, familiaridad táctica entrenada y moral.
- Charla del descanso.
