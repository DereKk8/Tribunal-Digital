# Simulación determinista — DEMO — DATOS FICTICIOS DE PRUEBA

`npm run simular` ejecuta esta partida contra la API HTTP real (base de datos temporal) y falla si un solo valor difiere. Notación: afirmación + [evidencias] + acción → puntos.

## R1 — Verificación de horarios

| Equipo | Respuesta | Puntos | Objeción | Puntos | Ronda | Total | Fichas |
|---|---|---|---|---|---|---|---|
| Azul | C1 + [E1] + A1 | 3 + 2 | a Verde, certeza injustificada, cita E2 → **válida** | 3 | 8 | 8 | 2 |
| Rojo | C4 + [E2, E1] (orden inverso) + A1 | 3 + 2 | a Verde, acción insegura, cita E1 → **válida** (otra regla, mismo objetivo) | 3 | 8 | 8 | 2 |
| Verde | C3 + [E1] + A2 | 0 + 0 | a Azul, contradicción → no válida | 0 | 0 | 0 | 2 |
| Amarillo | C1 + [E2] (evidencia incorrecta) + A1 | 0 + 2 | a Morado, cita E1 (la regla exige E2) → no válida | 0 | 2 | 2 | 2 |
| Morado | C3 + [E1] + A1 | 0 + 2 | no objeta | — | 2 | 2 | 3 |

Rechazos comprobados: evidencia futura, tres evidencias, suplantar a otro equipo, enviar `points`, cambiar la respuesta (antes y después de verla publicada), autoobjeción, objetar en nombre de otro, objeción tardía. Reintento idéntico: 200 sin duplicar.

## R2 — Cuenta recién creada

| Equipo | Respuesta | Puntos | Objeción | Puntos | Ronda | Total | Fichas |
|---|---|---|---|---|---|---|---|
| Azul | C1 + [E1] + A3 | 3 + 2 | a Verde, contradicción, cita E2 → válida | 3 | 8 | 16 | 1 |
| Rojo | C4 + [R2‑E1, R1‑E1] + A1 (evidencia de R1) | 3 + 2 | a Verde, contradicción, cita E2 → válida | 3 | 8 | 16 | 1 |
| Verde | C3 + [E2] + A2 | 0 + 0 | a Amarillo, acción insegura, cita E2 → válida | 3 | 3 | 3 | 1 |
| Amarillo | C2 + [E3] + A2 | 3 + 0 | intenta objetar a Morado (ausente) → **rechazada, no gasta ficha** | — | 3 | 5 | 2 |
| Morado | **sin respuesta** (envío tardío rechazado) | 0 + 0 | no objeta | — | 0 | 2 | 3 |

Además: reintento idéntico de la objeción de Azul (no descuenta otra ficha) y segunda objeción en la misma fase (rechazada).

## R3 — Enlace de inscripción

| Equipo | Respuesta | Puntos | Objeción | Puntos | Ronda | Total | Fichas |
|---|---|---|---|---|---|---|---|
| Azul | C1 + [E1, E2] + A1 | 3 + 2 | a Verde, salto lógico, cita E3 → válida | 3 | 8 | 24 | 0 |
| Rojo | C2 + [E3] + A1 | 3 + 2 | a Amarillo, contradicción, cita E3 → válida | 3 | 8 | 24 | 0 |
| Verde | C3 + [E1] + A2 | 0 + 0 | a Azul → no válida | 0 | 0 | 3 | 0 |
| Amarillo | C3 + [E3] + A2 | 0 + 0 | a Verde, cita E2 (la regla exige E3) → no válida | 0 | 0 | 5 | 1 |
| Morado | C1 + [E3] (evidencia incorrecta) + A1 | 0 + 2 | a Amarillo, contradicción, cita E3 → válida | 3 | 5 | 7 | 2 |

## R4 — Captura editada

| Equipo | Respuesta | Puntos | Objeción | Puntos | Ronda | Total | Fichas |
|---|---|---|---|---|---|---|---|
| Azul | C1 + [E1] + A1 | 3 + 2 | sin fichas → rechazada | — | 5 | 29 | 0 |
| Rojo | C2 + [R4‑E2, R1‑E2] + A1 | 3 + 2 | — | — | 5 | 29 | 0 |
| Verde | C2 + [E2] + A1 | 3 + 2 | sin fichas → rechazada | — | 5 | 8 | 0 |
| Amarillo | C1 + [E1] + A2 (acción insegura) | 3 + 0 | guarda su ficha | — | 3 | 8 | 1 |
| Morado | C2 + [E1] (evidencia incorrecta) + A1 | 0 + 2 | a Amarillo, acción insegura, cita E2 → válida | 3 | 5 | 12 | 1 |

## FINAL — Veredicto

| Equipo | Respuesta | Puntos | Objeción | Puntos | Ronda | Total | Fichas |
|---|---|---|---|---|---|---|---|
| Azul | C1 + [FINAL‑E1, R2‑E1] + A1 | 3 + 2 | — | — | 5 | **34** | 0 |
| Rojo | C1 + [R2‑E1, FINAL‑E1] + A1 | 3 + 2 | sin fichas → rechazada | — | 5 | **34** | 0 |
| Verde | C1 + [FINAL‑E1] + A1 | 3 + 2 | — | — | 5 | **13** | 0 |
| Amarillo | C1 + [FINAL‑E1] + A1 | 3 + 2 | guarda su ficha | — | 5 | **13** | 1 |
| Morado | C3 + [R1‑E1] + A2 | 0 + 0 | a Verde, contradicción → no válida (gasta su última ficha) | 0 | 0 | **12** | 0 |

## Clasificación

1. **Azul y Rojo — victoria conjunta** (34 puntos, 3 objeciones válidas y 5 afirmaciones sostenidas cada uno).
3. **Verde** (13): gana el primer desempate a Amarillo (1 objeción válida contra 0).
4. **Amarillo** (13).
5. **Morado** (12).
