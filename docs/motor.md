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

## Pendiente

- Dar más peso a tácticas y condicionales según el rival (ahora mueven 2-4 puntos).
- Lesiones, tarjetas, balón parado, familiaridad táctica entrenada y moral.
- Charla del descanso.
