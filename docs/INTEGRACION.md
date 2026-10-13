# Integración con el paquete de Agente A (contrato v1.0)

La aplicación implementa el contrato compartido `schema_version: "1.0"` y se probó con el paquete sintético `fixtures/demo/`. Importar el paquete real **no requiere cambios de código**: el motor solo consume IDs y listas de reglas.

## Archivos y rutas

| Archivo | Dueño | Modo real | Modo demo |
|---|---|---|---|
| `content/public.json` | Agente A | obligatorio | `fixtures/demo/content/public.json` |
| `content/answer-key.private.json` | Agente A, **no versionado** | obligatorio (o `ANSWER_KEY_PATH`) | `fixtures/demo/content/answer-key.private.json` (sintético) |
| `content/schema.json` | Agente A | obligatorio | `fixtures/demo/content/schema.json` (provisional) |
| `content/projection-map.json` | Agente A | obligatorio | `fixtures/demo/content/projection-map.json` |
| `projection/index.html` | Agente A (*make-slide*, `gradient-pop`) | obligatorio, se sirve **sin cambios** | página de prueba `fixtures/demo/projection/index.html` |
| `assets/` | Agente A | rutas `asset_path` relativas a la raíz | `fixtures/demo/assets/` |
| `content/rationales.private.md` | Agente A, **no versionado** | opcional: solo se usa para detectar fugas literales | — |

## Comprobaciones de la puerta (`npm run validar:real`)

- `schema_version` = `"1.0"` y `game_id` = `"tribunal-digital"` en público, clave y mapa.
- Equipos exactos `azul, rojo, verde, amarillo, morado`; rondas exactas `R1, R2, R3, R4, FINAL` en ese orden.
- Listas no vacías (evidencias, afirmaciones, acciones, argumentos y acciones aceptadas). Una ronda sin objeciones aceptadas da un **aviso**.
- IDs con formato `^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$`, **únicos en todo el paquete** (evidencias, afirmaciones y acciones comparten espacio) y distintos de equipos y rondas.
- `revealed_in` válido e **igual a la ronda que contiene la evidencia**.
- Clave: afirmaciones y acciones de la propia ronda; conjuntos de 1–2 evidencias distintas, existentes y **ya reveladas** en esa ronda (se permiten evidencias de rondas anteriores); sin combinaciones duplicadas (el orden no importa); categorías válidas.
- `asset_path` seguro dentro de `assets/` y el archivo existe (sin salir por enlaces simbólicos).
- Mapa de proyección completo y diapositivas existentes en `projection/index.html`.
- Ningún dato privado en `public.json`, en el mapa ni en el HTML (`accepted_*`, `target_*`, nombres de archivos privados o frases literales de `rationales.private.md`).
- La clave real **no está versionada** en Git y no es la clave DEMO; `public.json` tampoco es el DEMO.
- Recorrido HTTP de las 31 etapas como equipo y anónimo: sin evidencia futura, sin respuestas u objeciones antes de su bloqueo, sin rutas privadas, proyección denegada a equipos y servida byte a byte a la moderación.

Códigos de salida: **0** aprobado, **1** errores, **2 PENDIENTE** (falta algún archivo). Pendiente nunca cuenta como aprobado.

## Mapa de proyección

```json
{
  "schema_version": "1.0",
  "game_id": "tribunal-digital",
  "tutorial": "id-o-indice",
  "closing": "id-o-indice",
  "rounds": {
    "R1": { "reveal": "...", "deliberation": "...", "defense": "...", "objection": "...", "confrontation": "...", "resolution": "..." },
    "R2": { "...": "igual que R1" },
    "R3": { "...": "igual que R1" },
    "R4": { "...": "igual que R1" },
    "FINAL": { "deliberation": "...", "defense": "...", "objection": "...", "resolution": "..." }
  }
}
```

- Cada valor es un **id de elemento** del HTML (texto) o un **índice entero desde 0** de los elementos con clase `slide` (estructura de *make-slide*, que navega con `window.slideGo(indice)`).
- `confrontation` es opcional: si falta, se reutiliza la diapositiva de `objection` (documentado).
- `FINAL` no tiene `reveal`: su evidencia se revela al abrir la decisión.
- `tutorial` y `closing` son opcionales.

## API para la proyección: `GET /api/public-state`

Mismo origen que la proyección (sin CORS), `Cache-Control: no-store`, sin autenticación porque solo contiene información pública. Forma estable:

```json
{
  "api_version": "1.0",
  "content_mode": "real",
  "demo": false,
  "game_active": true,
  "stage_index": 3,
  "stage_count": 31,
  "round_id": "R1",
  "round_title": "…",
  "phase": "defense",
  "phase_label": "Argumentos públicos",
  "slide": "id-o-indice-del-mapa",
  "timer": { "duration_seconds": 150, "started_at": "…", "ends_at": "…", "server_time": "…", "hint_only": true },
  "scoreboard": [
    { "team_id": "azul", "team_name": "Azul", "score": 8, "objection_tokens_remaining": 2, "rank": 1, "valid_objections": 1, "supported_arguments": 1 }
  ],
  "responses": [
    { "team_id": "azul", "status": "submitted", "claim_id": "…", "claim_text": "…", "evidence_ids": ["…"], "action_id": "…", "action_text": "…" },
    { "team_id": "morado", "status": "absent" }
  ],
  "objections": [
    { "attacking_team_id": "azul", "target_team_id": "verde", "objection_kind": "unjustified_certainty", "objection_kind_label": "Certeza injustificada", "cited_evidence_id": "…", "valid": true, "points": 3 }
  ],
  "round_results": [ { "team_id": "azul", "argument_points": 3, "action_points": 2, "objection_points": 3, "total": 8 } ],
  "winners": []
}
```

- `phase` ∈ `tutorial, reveal, deliberation, defense, objection, confrontation, resolution, closing`.
- `scoreboard` siempre trae los cinco equipos, ordenados por puesto (empates comparten puesto).
- `responses` está **vacío** hasta cerrar la decisión de la ronda en curso; los ausentes figuran como `"status": "absent"` sin campos inventados.
- `objections` está vacío hasta cerrar la ventana de objeciones; `valid`/`points` aparecen solo en *Resultados*. Las fichas públicas no descuentan objeciones de una ventana aún abierta.
- `winners` solo se llena en `closing`.
- Nunca incluye la clave, evidencia futura, respuestas de rondas futuras, códigos, credenciales ni explicaciones de moderación.

Ejemplo mínimo dentro de *make-slide* (sin cambiar el diseño): consultar cada 2 s y llamar `window.slideGo(indice)` con `slide` si es un número, o buscar el índice del elemento con ese id entre `document.querySelectorAll('.slide')`.

## Lista de comprobación de la integración (PR)

- [ ] Agente A fusiona su paquete público (`content/public.json`, `schema.json`, `projection-map.json`, `projection/index.html`, `assets/`).
- [ ] La clave real se entrega por canal seguro y se copia a `content/answer-key.private.json` (ignorado) o a la ruta de `ANSWER_KEY_PATH`. **No** se versiona.
- [ ] `npm run validar:real` → **APROBADO** (registrar la salida en el informe de QA sin volcar la clave).
- [ ] `npm test` y `npm run simular` siguen en verde (no dependen del contenido real).
- [ ] `npm run real`: revisar en el navegador que `/projection/` muestra el HTML *make-slide* con `gradient-pop` **sin cambios de diseño** y que las diapositivas del mapa existen.
- [ ] Ensayo con **cinco teléfonos reales** en la Wi‑Fi del aula: entrar, sellar, objetar, reconectar.
- [ ] Revisar que ninguna diapositiva o recurso de `assets/` revela respuestas correctas.
- [ ] Actualizar [INFORME_QA.md](INFORME_QA.md): separar lo validado con DEMO de lo validado con el contenido real.
