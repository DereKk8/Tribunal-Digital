# Tribunal Digital · Contenido, evidencias y proyección (Agente A)

Paquete del caso **«El pase directo»** para el taller *Tribunal Digital*: 60 minutos, 20 estudiantes en cinco
equipos de cuatro. Los equipos investigan un expediente ficticio que avanza en cuatro rondas y un veredicto final.
En cada fase bloquean **una afirmación, una o dos evidencias y una acción**, y pueden objetar las respuestas de
otros equipos.

> **Repositorio público.** Todo lo que está aquí lo puede leer cualquiera, incluidas las evidencias y las
> diapositivas de rondas futuras. Las respuestas, la clave de puntuación y los fundamentos **no** están en el
> repositorio: son archivos locales que se entregan por un canal seguro (ver §8).

---

## 1. Qué hay en este paquete

| Ruta | Qué es | ¿Público? |
|---|---|---|
| `content/public.json` | Contrato v1.0: equipos, rondas, evidencias, afirmaciones y acciones. Sin indicadores de respuesta. | Sí |
| `content/projection-map.json` | Ronda + fase → diapositiva (`slide_id` e índice desde 0) de `projection/index.html`. | Sí |
| `content/schema.json` | JSON Schema (draft 2020-12) de los tres archivos del contrato, incluido el **formato** de la clave privada. | Sí |
| `content/answer-key.example.json` | Ejemplo **sintético** del formato de la clave (ids inventados: `R1-C9`, `E90`…). No contiene respuestas. | Sí |
| `content/src/case.mjs` | Fuente canónica del caso (textos, evidencias estructuradas, personajes, glosario). | Sí |
| `content/tools/*.mjs` | Generadores y comprobaciones (ver §6). No contienen respuestas. | Sí |
| `projection/index.html` | Proyección **make-slide · tema `gradient-pop`**, autocontenida (fuente e imágenes incrustadas). | Sí |
| `projection/build/` | Fuentes de la proyección: CSS original del tema, extensiones, motor JS y generador. | Sí |
| `assets/evidence/E01.svg` … `E18.svg` | Maquetas de las 18 evidencias (texto accesible en `<title>`/`<desc>`). | Sí |
| `assets/fonts/` | Pretendard Variable 1.3.9 sin modificar (SIL OFL 1.1) y su licencia. | Sí |
| `content/answer-key.private.json` | **Clave real** exhaustiva (contrato v1.0). | **No** · ignorado por Git |
| `content/answer-rules.private.json` | Fuente compacta de la clave (estado de cada opción). | **No** · ignorado por Git |
| `content/rationales.private.md` (+ `.src.md`) | **Fundamentos pedagógicos** de cada regla, guion de resolución y fuentes. | **No** · ignorado por Git |
| `content/private/` | Ensayo adversarial detallado y paquete de entrega. | **No** · ignorado por Git |

---

## 2. Mapa del caso

**Premisa (pública).** Marina Márquez (20) pide ayuda al Tribunal: su hermano Leo (14), jugador de
*Fractal Arena*, recibió de la cuenta **RaiCoach_ATL** una oferta de «pase directo» a la final del
**Semillero Atalaya 2026**, un programa real del Club Atalaya eSports. Todo es ficticio: personas, cuentas,
marcas, sitios, dominios y fechas.

| Ronda | Pregunta investigable | Evidencias nuevas | Opciones |
|---|---|---|---|
| **R1 · La invitación** | ¿Qué respalda la oferta de «pase directo» que recibió Leo? | E01 web del Semillero (7 sep) · E02 chat de Fractal Arena (29 sep) · E03 perfil de RaiCoach_ATL · E04 perfil de LeoNova14 | 5 afirmaciones · 4 acciones |
| **R2 · Secretos y canales** | ¿Qué distingue un secreto inocente de una señal de alerta? | E05 chat (1 oct, paso a Susurro) · E06 chat con DaniZurdo (1 oct) · E07 grupo de Susurro del colegio · E08 preguntas frecuentes del club | 5 · 4 |
| **R3 · ¿Quién está detrás?** | ¿Qué podemos afirmar —y qué no— sobre la identidad de quien escribe? | E09 perfil de Lumen @rai.atalaya · E10 correo del club (9 oct) · E11 publicación del directo (3 oct) · E12 chat de Susurro (3 oct) | 5 · 4 |
| **R4 · La escalada** | ¿Hay ya un riesgo claro que justifique denunciar? | E13 regalo de Cristales (5 oct) · E14 chat de Susurro (7 oct) · E15 chat de Susurro (10 oct) · E16 correo de inscripciones (12 oct) | 5 · 4 |
| **FINAL · Veredicto** | ¿Qué sostiene la evidencia completa y qué hacemos ahora? | E17 aviso de Lumen (13 oct) · E18 correo del club (13 oct) | 5 · 4 |

Las evidencias de rondas anteriores siguen disponibles: en `public.json`, cada ronda lista **solo las que se
revelan en ella** (`revealed_in`), y la aplicación debe acumularlas. Cada evidencia tiene una transcripción
completa en `body`, generada de los mismos datos que dibujan la imagen, de modo que texto e imagen coinciden.

**Cronología canónica (2026):** lun 7 sep anuncio del Semillero · lun 21 sep se crea RaiCoach_ATL ·
mar 29 sep primer mensaje · mié 30 sep cierre de inscripciones · jue 1 oct paso a Susurro y mensaje de Dani ·
sáb 3 oct clasificatorio online 10:00–14:00 con corte de transmisión 12:00–12:15 · lun 5 oct regalo ·
mié 7 oct pedido de videollamada y fotos · jue 8 oct Marina reúne capturas y escribe al club · vie 9 oct responde
el club · sáb 10 oct propuesta de «prueba privada» para el sáb 17 y reporte a Lumen · lun 12 oct correo oficial de
inscripciones · mar 13 oct aviso de Lumen y correo final del club · sáb 24 oct final presencial (fuera del juego).

---

## 3. Orden de la presentación (63 diapositivas)

| Bloque | Tiempo | Diapositivas (`id`) |
|---|---|---|
| Apertura y tutorial | 7:00 | `portada` · `aviso` · `mision` · `puntos` · `objeciones` · `ronda-tipo` · `practica` · `caso` · `personajes` |
| Ronda 1–4 (×4) | 10:00 c/u | `rN-revelacion` (1:00, incluye las 4 evidencias `rN-eXX`) · `rN-deliberacion` (2:00) · `rN-defensa` (2:30, 5 × 30 s) · `rN-objeciones` (0:45) · `rN-confrontacion` (3:00, hasta 5 intercambios de 18 s + 18 s) · `rN-resultados` (0:45) |
| Final | 8:00 | `final-revelacion` + `final-e17` + `final-e18` + `final-deliberacion` (1:30 en total) · `final-alegatos` (2:00, 5 × 24 s) · `final-objeciones` (0:45) · `final-confrontacion` (3:00) · `final-resultados` (0:45) |
| Cierre | 5:00 | `cierre-podio` · `cierre-senales` · `cierre-limites` · `cierre-acciones` · `cierre-recursos` · `cierre-gracias` |

Los índices exactos están en `content/projection-map.json`. Cada diapositiva se puede abrir directamente con su
`id` en la URL: `projection/index.html#r2-deliberacion`.

---

## 4. Glosario de códigos

| Código | Significado |
|---|---|
| `azul`, `rojo`, `verde`, `amarillo`, `morado` | Equipos (nombres visibles: «Equipo Azul»…). En pantalla también se distinguen por forma: ● ■ ▲ ◆ ★. |
| `R1`, `R2`, `R3`, `R4`, `FINAL` | Rondas. |
| `E01`…`E18` | Evidencias, numeradas en orden de aparición. |
| `R1-C1`…`FINAL-C5` | Afirmaciones (en pantalla, «C1»…). El número indica solo la posición en pantalla. |
| `R1-A1`…`FINAL-A4` | Acciones (en pantalla, «A1»…). |
| `reveal`, `deliberation`, `defense`, `objection`, `confrontation`, `resolution` | Fases (ids técnicos). En pantalla: Revelación, Deliberación (Análisis en la final), Defensa (Alegatos en la final), Objeciones, Confrontación, Resultados. La final no tiene `reveal`: sus dos evidencias se muestran dentro del análisis. |
| `contradiction` | Contradicción: un dato de la afirmación es falso según una evidencia. |
| `unjustified_certainty` | Certeza injustificada: da por seguro (identidad, intención, culpa, «imposible», «demostrado») algo que la evidencia no establece. |
| `logical_leap` | Salto lógico: la afirmación no es falsa, pero las evidencias citadas no alcanzan para sostenerla. |
| `unsafe_action` | Acción insegura: expone a alguien, alerta al sospechoso o destruye pruebas. |

Objetos que envía cada equipo (contrato): `response = {round_id, team_id, claim_id, evidence_ids, action_id}` y
`objection = {round_id, attacking_team_id, target_team_id, objection_kind, cited_evidence_id}`. La objeción se
evalúa contra la **instantánea bloqueada** del equipo objetado; nunca viaja `target_*` desde el cliente.

---

## 5. Decisiones de diseño

- **Final planificado primero.** La verdad del caso y la matriz de respuestas se fijaron antes de escribir las
  evidencias, y cada ronda se diseñó hacia atrás para que su respuesta exija cruzar al menos dos piezas.
- **Calibración, no alarma.** El caso premia afirmar solo lo que la evidencia sostiene en cada momento y elegir la
  acción proporcionada a ese momento. Se penaliza tanto minimizar como exagerar, y no se confunde sospecha con
  culpa probada.
- **Pistas falsas legítimas.** El expediente incluye personas, mensajes y datos que parecen sospechosos sin
  serlo, y otros que parecen inocentes sin serlo. Hay varias hipótesis plausibles en cada ronda.
- **Sin pistas de forma.** Las opciones correctas varían de posición, longitud, tono y grado de certeza. El ensayo
  adversarial comprueba que ninguna heurística de forma supera el azar: longitud, matices, palabras de certeza o
  menciones a adultos (ver `content/QA-informe.md`).
- **Objeciones deterministas.** Cada categoría tiene una prueba objetiva (§4). Si varias aplican, cualquiera vale.
  La clave privada enumera **todas** las combinaciones que puntúan; todo lo demás vale 0.
- **Fidelidad a make-slide.** La proyección sigue el flujo del skill oficial
  ([`SKILL.md`](https://github.com/Kuneosu/make-slide/blob/main/.claude/skills/make-slide/SKILL.md), versión 2.3.2,
  commit `3b58beb`): HTML de un solo archivo, CSS y JS en línea, notas en `data-notes` abiertas en **ventana
  emergente** (tecla S), navegación por teclado/clic/gesto, pantalla completa (F), barra de progreso, contador e
  impresión a PDF. El CSS de
  [`themes/gradient-pop/reference.html`](https://github.com/Kuneosu/make-slide/blob/main/themes/gradient-pop/reference.html)
  se incluye **literalmente** (`projection/build/vendor/`), con sus colores (#6366f1, #ec4899, #f97316, acento
  #fbbf24), degradados `slide-grad-1…11`, tarjetas de vidrio, píldoras y tipografía Pretendard. Diseño: *centered*
  para portadas y *wide* para diapositivas densas.
  Adaptaciones documentadas: escenario fijo 16:9 escalado (requisito del `html-spec`, sustituye el bloque
  responsive del tema), variante de vidrio con tinte índigo para leer a distancia sobre los tramos claros del
  degradado, reloj de fase, marcador en vivo y fuente incrustada para funcionar sin conexión.
- **Accesibilidad.** Texto mínimo de ~18 px en un escenario de 1600×900 (≈ 22 px en 1920×1080), contraste reforzado,
  equipos identificables por forma y color, imágenes con transcripción completa (`<title>`/`<desc>` y `body`).

---

## 6. Cómo ejecutar, ensayar y validar

Requisitos: **Node.js 18+**. No hay dependencias para generar ni validar. La captura visual usa Playwright, que es
opcional.

```bash
# Proyección: abrir directamente (funciona sin servidor y sin conexión, en modo demostración)
xdg-open projection/index.html        # macOS: open · Windows: start

# Validación pública (esquema, referencias, mapa↔HTML, tema, ausencia de respuestas)
node content/tools/validate.mjs --public

# Validación completa (además, integridad y exhaustividad de la clave privada si está en local)
node content/tools/validate.mjs

# Validación cruzada opcional con Ajv (requiere red la primera vez)
npx -y ajv-cli@5 validate --spec=draft2020 --strict=true -s content/schema.json -d content/public.json

# Ensayo adversarial (requiere la clave local; el detalle queda en content/private/, ignorado por Git)
node content/tools/rehearsal.mjs

# Antes de cada push: buscar filtraciones en índice e historial
node content/tools/check-leaks.mjs

# QA visual: captura las 63 diapositivas y detecta desbordes (requiere Playwright)
node projection/build/qa-render.mjs --width 1600 --height 900
node projection/build/qa-render.mjs --width 1280 --height 720 --out projection/qa-output/720p

# Regenerar todo tras editar content/src/case.mjs
node content/tools/build-public.mjs        # → content/public.json
node content/tools/render-evidence.mjs     # → assets/evidence/*.svg
node projection/build/build-deck.mjs       # → projection/index.html + content/projection-map.json
node content/tools/build-answer-key.mjs    # (privado) → content/answer-key.private.json
node content/tools/build-rationales.mjs    # (privado) → content/rationales.private.md
```

**Controles de la proyección:** ← → / Espacio (navegar) · F (pantalla completa) · S (notas en ventana aparte, con
la siguiente diapositiva) · T (iniciar/pausar el reloj de la fase) · N (siguiente turno: portavoces o
ataque/defensa) · R (reiniciar reloj) · G (en vivo: saltar a la fase que indica el servidor) · Inicio/Fin.

**Ensayo recomendado (30 min):** recorrer la apertura con las notas abiertas (S); jugar R1 completa con cinco
personas usando `?demo=1`; comprobar el reloj (T/N/R); practicar el guion de 30 s de cada ronda con
`rationales.private.md`; proyectar en la sala para comprobar la legibilidad desde la última fila.

---

## 7. Integración con la aplicación (Agente B)

- **Ruta de presentador.** Servir `projection/index.html` **solo** en una ruta autorizada para presentación (no
  accesible con códigos de equipo), y en el mismo origen que `GET /api/public-state`. El HTML no contiene ni pide
  ningún secreto; usa `fetch('/api/public-state', { credentials: 'same-origin' })` cada 3 s.
- **Sin servidor** (archivo local, `?demo=1`, 404, error de red): modo demostración con datos de ejemplo
  claramente rotulados. Con 401/403 lo indica en el aviso inferior. Si la conexión se pierde, conserva los últimos
  datos y avisa: «Sin conexión con el servidor · últimos datos de las hh:mm:ss».
- **Formato esperado** (valores ilustrativos al azar, no son respuestas):

```json
{
  "round_id": "R2",
  "phase": "defense",
  "scoreboard": [
    { "team_id": "azul", "score": 5, "objection_tokens": 2, "rank": 1 },
    { "team_id": "rojo", "score": 3, "objection_tokens": 3, "rank": 2 }
  ],
  "responses": [
    { "team_id": "azul", "claim_id": "R2-C4", "evidence_ids": ["E06", "E08"], "action_id": "R2-A1" }
  ]
}
```

  Se toleran alias para no acoplar implementaciones: `scoreboard` como arreglo u objeto indexado por equipo;
  fichas en `objection_tokens` | `tokens_remaining` | `remaining_tokens` | `objection_tokens_remaining` | `tokens`;
  respuestas en `responses` | `locked_responses` | `team_responses`. Si falta `rank`, se calcula por puntos (empate =
  mismo puesto). Las respuestas se muestran solo si `round_id` coincide con la ronda de la diapositiva; el servidor
  debe enviarlas **solo tras el bloqueo**.
- **Parámetros de URL:** `?demo=1` fuerza la demostración · `?follow=1` sigue automáticamente la fase del
  servidor · `?api=/ruta` cambia el endpoint (solo rutas del mismo origen) · `#id` abre una diapositiva.
- **CSP:** la proyección usa `<script>` y `<style>` en línea (formato make-slide). Si el servidor aplica CSP,
  permita esos bloques por hash o sirva esta ruta con una política compatible.
- **Imágenes:** `asset_path` es relativo a la raíz del paquete (`assets/evidence/E01.svg`); los SVG están además
  incrustados en la proyección.

---

## 8. Archivos privados: generar, guardar y entregar sin publicarlos

1. Solo existen en el equipo de quien preparó el contenido, en las rutas fijas del contrato:
   `content/answer-key.private.json` y `content/rationales.private.md` (además de `content/answer-rules.private.json`,
   su fuente compacta). `.gitignore` los excluye; **un nombre con `.private` no los vuelve privados en GitHub**.
2. **Entrega:** solo por un canal con control de acceso (mensaje directo a la persona organizadora, unidad
   compartida restringida o memoria USB). Nunca por issues, PR, commits, artefactos públicos de CI ni capturas de
   pantalla.
3. **Instalación en el servidor:** copiar `answer-key.private.json` a la ruta que use la aplicación (por defecto,
   `content/answer-key.private.json`) y ejecutar `node content/tools/validate.mjs` para comprobar que corresponde a
   este `public.json` (mismo `game_id`, `schema_version` e ids).
4. **Antes de cada push:** `git status`, `node content/tools/check-leaks.mjs` (busca rutas privadas y firmas de
   las respuestas reales en el índice y en todo el historial).
5. **Si algo se filtra:** borrarlo del historial (por ejemplo, `git filter-repo`), forzar la actualización
   coordinándolo con el otro agente, invalidar la clave (cambiar opciones o evidencias y regenerar) y avisar a la
   organización. Si fuera una credencial, rotarla.
6. Los fixtures de `fixtures/demo/` del Agente B son **sintéticos** y pueden versionarse; las reglas de
   `.gitignore` los dejan fuera de la exclusión a propósito.

---

## 9. Limitación conocida del repositorio público

Las evidencias y diapositivas de todas las rondas, incluido el cierre con las lecciones generales, son visibles
para cualquiera que navegue el repositorio. El bloqueo por fases de la aplicación impide pedirlas por sus rutas,
pero **no** impide leerlas aquí. Por eso: no difundir el repositorio a participantes antes del taller y, si hace
falta secreto previo, coordinar el momento de publicación. Las respuestas no están en el repositorio, pero una
lectura atenta de las evidencias permite razonarlas, igual que en el juego.

---

## 10. Fuentes (documentadas) y ficción

Lo **inventado**: todo el relato (personas, cuentas, marcas, dominios, fechas, mensajes, ilustraciones).
Lo **documentado**: las señales de captación, las acciones protectoras y los recursos de ayuda del cierre.
Consulta: **13 de octubre de 2026**. Por la política de red del entorno de trabajo, las páginas se verificaron a
través de su indexación en buscadores y no se abrieron directamente: **conviene abrirlas antes del taller**,
sobre todo los teléfonos.

- INCIBE · Grooming: https://www.incibe.es/menores/tematicas/grooming
- INCIBE · Preguntas frecuentes (guardar capturas): https://www.incibe.es/menores/ayuda/preguntas-frecuentes
- INCIBE · Línea 017: https://www.incibe.es/linea-de-ayuda-en-ciberseguridad
- Save the Children España: https://www.savethechildren.es/actualidad/grooming-que-es-como-detectarlo-y-prevenirlo
- Childnet · How does online grooming happen?: https://www.childnet.com/help-and-advice/how-does-online-grooming-happen/
- NSPCC · Grooming: https://www.nspcc.org.uk/keeping-children-safe/types-of-abuse/grooming/
- eSafety Commissioner · Unwanted contact: https://www.esafety.gov.au/key-topics/staying-safe/unwanted-contact
- CEOP / Thinkuknow: https://www.thinkuknow.co.uk/14_plus/need-advice/online-grooming/
- NCMEC · Online enticement: https://www.missingkids.org/theissues/onlineenticement
- INHOPE · Stages of grooming: https://www.inhope.org/articles/the-stages-of-grooming · How to report: https://www.inhope.org/what-we-do/how-to-report
- WeProtect Global Alliance: https://www.weprotect.org/thematic/online-grooming/
- Argentina · Guía para madres, padres y docentes: https://www.argentina.gob.ar/justicia/convosenlaweb/situaciones/guia-para-madres-padres-docentes-grooming · ¿Qué puedo hacer ante un caso de grooming?: https://www.argentina.gob.ar/que-puedo-hacer-ante-un-caso-de-grooming
- Stop It Now · Warning signs: https://www.stopitnow.org/ohc-content/tip-sheet-warning-signs-of-possible-sexual-abuse-in-a-childs-behaviors
- Fundación ANAR (España): https://www.anar.org/ · ICBF 141 (Colombia): https://www.icbf.gov.co/linea-de-proteccion-ninos-ninas-y-adolescentes-141 · Te Protejo: https://teprotejo.org/ · 088 (México): https://www.gob.mx/gncertmx/articulos/en-caso-de-ser-victima-de-algun-ciberdelito-llama-al-088-atencion-ciudadana · Fono Niños 147 (Chile): https://www.chileatiende.gob.cl/fichas/385-fono-ninos-147

---

## 11. Créditos y licencias

- **make-slide** © 2026 Kuneosu, licencia MIT (`projection/build/vendor/make-slide-LICENSE.txt`). Se usa el skill,
  la plantilla `themes/gradient-pop/reference.html` y el código de `core-features`.
- **Pretendard** © 2021 Kil Hyung-jin, SIL Open Font License 1.1, nombre reservado «Pretendard». Se incrusta el
  archivo original sin modificar (`assets/fonts/`).
- Maquetas, ilustraciones y textos del caso: creados para este taller. Ninguna captura procede de cuentas reales.
