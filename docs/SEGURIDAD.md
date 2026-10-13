# Seguridad y repositorio público

## Qué es secreto y dónde vive

| Elemento | Dónde | Protección |
|---|---|---|
| Clave real de puntuación | `content/answer-key.private.json` o `ANSWER_KEY_PATH` | Ignorada por Git; el modo real se niega a arrancar si está versionada. Solo la lee el servidor. |
| Justificaciones privadas | `content/rationales.private.md` | Ignoradas por Git; solo se usan para detectar frases filtradas. |
| Contraseña de moderación | `.env` (`MODERATOR_PASSWORD`) o variable del alojamiento | Ignorada por Git; comparación en tiempo constante; límite de intentos. |
| Códigos de equipo, sesiones, respuestas | `data/*.sqlite` | Ignorado por Git; los tokens de sesión se guardan como hash SHA‑256. |
| Exportaciones de auditoría | Descarga del navegador | Contienen referencias de reglas: guárdelas fuera del repositorio. |

La clave sintética `fixtures/demo/content/answer-key.private.json` es **pública a propósito** y no se parece al caso real.

## Controles de la aplicación

- **Roles en el servidor**: el rol sale de la base de datos, no de cookies o del cuerpo. Un token de equipo en la cookie de moderación no sirve. El equipo se deduce de la sesión: un `team_id`/`attacking_team_id` distinto se rechaza (403).
- **El cliente no decide**: se rechazan campos como `points`, `score`, `phase`, `tokens` o `target_snapshot` (400). La instantánea de la respuesta objetada la toma el servidor.
- **Fases y revelado**: cada envío comprueba la fase dentro de la misma transacción que escribe. La evidencia no revelada no se entrega ni se confirma su existencia (mismo 404 que un ID inexistente).
- **Idempotencia y concurrencia**: claves primarias por equipo/ronda; disparadores SQLite que impiden más de tres fichas, modificar o borrar respuestas, objeciones o puntos y retroceder de fase. Probado con envíos simultáneos.
- **Archivos**: solo se sirven listas explícitas (`/static/*` de la app; `/media/<evidencia>` revelada; `/projection/` y `/assets/` solo con moderación). Rutas con `..`, codificadas o con barras invertidas se rechazan; los enlaces simbólicos no salen de su carpeta.
- **Navegador**: CSP estricta en la app (`script-src 'self'`, sin estilos en línea), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`. Los recursos de evidencia llevan CSP `sandbox` (un SVG no puede ejecutar código).
- **CSRF**: cookies `HttpOnly; SameSite=Strict` (y `Secure` tras HTTPS), JSON obligatorio y comprobación de `Origin`/`Sec-Fetch-Site`.
- **Fuerza bruta**: límite de intentos fallidos por IP y tope global (cubre IP falseadas detrás de un proxy). Códigos de 6 caracteres sin ambigüedad (~887 millones de combinaciones) que cambian en cada partida.
- **Registros**: el servidor no escribe la clave, contraseñas ni códigos en consola; la auditoría guarda IDs y referencias de regla (`R1.accepted_arguments[0]`).

## Repositorio público: lo que el servidor NO puede proteger

El control de acceso del servidor **no protege lo que está en GitHub**. Si el HTML *make-slide*, `assets/` o `content/public.json` se publican en el repositorio antes del taller, cualquier estudiante puede leer la evidencia futura en GitHub.

Recomendaciones (sin crear un segundo repositorio):

1. Mantener el paquete real en una **rama o PR sin fusionar hasta el día del taller**, o fusionarlo justo después.
2. Distribuir el paquete al portátil del taller por un canal privado (memoria USB o descarga privada) y no enlazar el repositorio a los estudiantes.
3. Mantener **siempre** la clave real fuera de Git; si alguna vez se versiona por error, considérela comprometida y cámbiela (reescribir el historial no basta si ya se publicó).
4. No incluir respuestas correctas en las diapositivas de resolución.

## Riesgos residuales

- En la Wi‑Fi local se usa **HTTP sin cifrar**: alguien en la misma red podría observar cookies. Mitigación: red del aula o punto de acceso propio; para HTTPS use el despliegue de [DESPLIEGUE.md](DESPLIEGUE.md).
- `GET /api/public-state` es público por diseño (lo mismo que se proyecta).
- La proyección real (HTML de Agente A) se sirve sin CSP propia para no alterarla; depende de que Agente A no incluya scripts externos no confiables.
