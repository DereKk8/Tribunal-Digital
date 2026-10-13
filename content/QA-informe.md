# Informe de QA · Contenido y proyección (Agente A)

Fecha: 13 de octubre de 2026 · Alcance: `content/`, `assets/`, `projection/`.
Este informe es público: resume resultados **sin revelar respuestas**. El detalle con respuestas está en
`content/private/ensayo.private.md`, que no se versiona.

## 1. Pruebas ejecutadas

| Prueba | Comando | Resultado |
|---|---|---|
| Esquema y referencias cruzadas (12 comprobaciones, con clave local) | `node content/tools/validate.mjs` | ✓ 12/12 |
| Lo mismo sin clave (como en CI o para colaboradores) | `node content/tools/validate.mjs --public` | ✓ 8/8 |
| Esquema con Ajv 8 en modo estricto (`ajv-cli@5 --spec=draft2020 --strict=true`) | ver `content/README.md` §6 | ✓ `public.json` y `projection-map.json` válidos |
| Esquema con python-jsonschema (Draft 2020-12) | — | ✓ los tres documentos, incluida la clave privada |
| Paridad del validador sin dependencias con Ajv (15 documentos mutados) | — | ✓ 0 discrepancias |
| Ensayo adversarial: 8 620 respuestas posibles × 4 categorías × cada evidencia citable | `node content/tools/rehearsal.mjs` | ✓ ninguna respuesta correcta es objetable; toda afirmación defectuosa y toda acción insegura tiene al menos una objeción válida |
| Captura de las 63 diapositivas a 1600×900, 1280×720 y 1920×1080 | `node projection/build/qa-render.mjs` | ✓ sin desbordes ni texto fuera del escenario |
| Caso extremo: los cinco equipos eligen la afirmación y la acción más largas | (script de QA) | ✓ sin recortes a 1600×900 ni a 1280×720 |
| Interacción: teclado, clic, `#id`, notas en ventana emergente, reloj y turnos (28 aserciones) | `node projection/build/qa-interaction.mjs` | ✓ 28/28, sin errores de JavaScript |
| Modo en vivo contra un **servidor simulado** (16 aserciones) | `node projection/build/qa-live.mjs` | ✓ datos en vivo, caída del servidor, 404, 401 y `file://` |
| Filtraciones en índice e historial de Git (rutas privadas y firmas exactas de respuestas) | `node content/tools/check-leaks.mjs` | ✓ antes de cada commit de esta rama |

Probabilidades al azar, según el ensayo: +3 por argumento entre 0,4 % y 2 % por ronda; +2 por acción entre 25 % y
50 %. Una objeción con categoría y cita al azar contra una respuesta al azar acierta entre 13 % y 35 %; R1 es la
más alta porque solo hay cuatro evidencias. Contra un equipo que responde bien, cualquier objeción falla.

## 2. Correcciones tras el ensayo adversarial

Un revisor independiente jugó el caso con cinco estilos de equipo e intentó romperlo. Con lo que encontró se
corrigieron el contenido y las reglas. Los cambios se describen sin identificar opciones concretas, para no
revelar respuestas:

- **Coherencia entre la clave y la regla proyectada.** Dos opciones admitían una lectura razonable que la clave
  rechazaba. Se reescribieron para que el dato en disputa sea explícito, y una evidencia se precisó para eliminar
  una ambigüedad horaria.
- **Varias categorías cuando varias aplican.** Si una afirmación con un dato falso además da algo por seguro,
  valen la contradicción y la certeza injustificada. Si una afirmación sólida está mal sostenida, el salto lógico
  puede citar la evidencia que falta.
- **Ambigüedades eliminadas en textos y evidencias:** una referencia que podía apuntar a dos piezas distintas, dos
  nombres de lugar que se confundían, una persona del club que no figuraba en la web, y un dato de la última
  ronda cuyo origen no se explicaba.
- **Calibración ética:**
  - ninguna opción presupone que hubo delito;
  - ninguna enseña que denunciar sea arriesgado: lo inseguro son las acusaciones públicas, las confrontaciones y
    destruir pruebas;
  - se revisaron los conjuntos de evidencias aceptados para que cada uno cubra todos los datos de su afirmación.
- **Pistas de forma.** La versión inicial dejaba adivinar respuestas por tono, longitud y matices. Se reescribieron
  textos hasta que ninguna heurística de forma supera el azar:

| Heurística | Aciertos en 5 fases |
|---|---|
| Afirmación más larga | 0/5 |
| Afirmación más corta | 2/5 |
| Primera afirmación con matiz | 0/5 |
| Afirmación con más matices | 0/5 |
| Evitar palabras de certeza | 1/5 |
| Acción más larga | 0/5 |
| Acción que menciona club, madre o policía | 2/5 |
| Acción con «para…» | 2/5 |

- **Proyección:**
  - el reloj ya no tapa el botón de pantalla completa ni las evidencias;
  - más contraste en etiquetas y píldoras;
  - la revelación final ya no se desborda;
  - las columnas de respuestas son más anchas, con hasta cuatro líneas.

## 3. Riesgos pendientes

- **Prueba con la API real del Agente B: pendiente.** Se probó solo contra un servidor simulado que sigue el
  contrato. Falta verificar el nombre real de los campos (hay alias tolerados) y la autorización de la ruta de
  presentador.
- **Repositorio público.** Evidencias, diapositivas y lecciones del cierre son legibles antes del taller. No hay que
  difundir el repositorio a participantes.
- **Fuentes y teléfonos.** Se verificaron a través de su indexación en buscadores porque el entorno bloqueaba la
  descarga directa. Hay que abrirlos antes del taller y añadir el recurso local si falta.
- **Tamaño de la clave privada.** Unos 11 MB y unas 72 000 objeciones enumeradas, porque el contrato exige casar la
  instantánea completa. Si la aplicación prefiere reglas compactas, se puede proponer como cambio versionado (v1.1).
- **Fuente tipográfica.** Sin conexión se usa la copia incrustada. Con conexión, el CDN del tema intenta cargar
  primero sin efecto visible.
- **Calibración humana.** Los cinco estilos simulados no sustituyen un ensayo con estudiantes reales; se recomienda
  uno corto con R1 y R2.

## 4. Decisiones justificadas

- **Planificar el final primero, sin certezas falsas.** La identidad y el delito quedan para la investigación; el
  juego premia distinguir «riesgo claro, se denuncia» de «X es culpable».
- **Clave exhaustiva generada.** Las reglas compactas se expanden de forma determinista para que la auditoría sea
  posible: la regla más su fundamento. La exhaustividad se comprueba automáticamente.
- **Las afirmaciones falsas solo admiten contradicción** (más certeza si además dan algo por seguro). Así
  «contradicción» exige identificar el dato que la refuta y no la sustituye el salto lógico.
- **CSS de gradient-pop literal.** Las adaptaciones son mínimas y documentadas: escenario 16:9 y vidrio oscuro para
  leer a distancia. Las notas van en ventana emergente, como exige el skill.
- **SVG con texto real e incrustado.** La lectura es nítida en cualquier proyector y la transcripción es accesible.
  Imagen y JSON se generan de la misma fuente, así que no pueden contradecirse.
