# Paquete DEMO — DATOS FICTICIOS DE PRUEBA

Paquete **sintético** para desarrollar y probar la aplicación sin el contenido real de Agente A. El caso de ensayo (la reunión de un club de ajedrez y un horario falso) es deliberadamente distinto de la narrativa real del taller.

| Archivo | Uso |
|---|---|
| `content/public.json` | Cinco rondas, cinco equipos, evidencias, afirmaciones y acciones DEMO. |
| `content/answer-key.private.json` | Clave **sintética**, pública a propósito. Incluye conjuntos de dos evidencias, evidencias de rondas anteriores, acciones inseguras y reglas `unsafe_action`. |
| `content/projection-map.json` | Mapa de cada fase a los IDs `demo-…` de la página de prueba. `FINAL` no tiene `confrontation` para probar la reutilización de la diapositiva de objeciones. |
| `content/schema.json` | Esquema provisional v1.0 (JSON Schema 2020‑12): la raíz valida `public.json`; `$defs.answer_key` y `$defs.projection_map` validan los otros dos. |
| `projection/index.html` | Página de **prueba de integración** de `/api/public-state` (no es una presentación). Solo se sirve en modo demo. |
| `assets/*.svg` | Imágenes de marcador de posición (`node scripts/generate-demo-assets.js`). |
| `simulation.json` | Partida determinista completa usada por `npm run simular` y las pruebas. |

## Resultado esperado de la simulación

Ver el detalle ronda por ronda en [SIMULACION.md](SIMULACION.md).

| Equipo | Puntos | Fichas restantes | Objeciones válidas | Afirmaciones sostenidas | Puesto |
|---|---|---|---|---|---|
| Azul | 34 | 0 | 3 | 5 | 1 (victoria conjunta) |
| Rojo | 34 | 0 | 3 | 5 | 1 (victoria conjunta) |
| Verde | 13 | 0 | 1 | 2 | 3 (gana el desempate por objeciones) |
| Amarillo | 13 | 1 | 0 | 3 | 4 |
| Morado | 12 | 0 | 2 | 0 | 5 |
