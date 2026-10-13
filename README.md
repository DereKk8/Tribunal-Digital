# Tribunal Digital — aplicación del taller

Aplicación web para dirigir el taller **«Tribunal Digital»** (60 minutos, 20 estudiantes, cinco equipos de cuatro) sobre riesgos en redes sociales y *grooming*. Cada equipo usa **un teléfono** para sellar **una respuesta colectiva por ronda** (una afirmación, una o dos evidencias y una acción de protección), puede **objetar** las respuestas de otros equipos con sus **tres fichas** y el servidor **calcula los puntos automáticamente** con la clave privada. El debate oral es libre y no puntúa.

> Esta aplicación es la parte de **Agente B**: servidor, interfaz móvil de equipos, panel de moderación, puntuación, objeciones, auditoría y la API para la proyección. La historia del caso, las evidencias reales, la clave real y la presentación *make-slide* (`gradient-pop`) son de **Agente A** y se integran sin cambiar el código (ver [docs/INTEGRACION.md](docs/INTEGRACION.md)).

## Requisitos

- **Node.js 22.13 o superior** (incluye SQLite integrado; no hay dependencias nativas que compilar). Descárguelo de <https://nodejs.org>.
- Un portátil y una red Wi‑Fi a la que se conecten los teléfonos. Los teléfonos **no instalan nada**: usan el navegador.
- Opcional: alojamiento gratuito con HTTPS en Render (ver [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)).

## Puesta en marcha (modo DEMO)

```bash
npm install            # instala dependencias (ajv; Playwright solo para pruebas)
npm run configurar     # crea .env con una contraseña de moderación aleatoria y la muestra
npm run demo           # arranca con los datos ficticios de fixtures/demo/
```

La consola muestra las direcciones: los teléfonos abren `http://<IP-del-portátil>:3000/`, la moderación abre `http://localhost:3000/moderador` y la proyección se abre desde el panel. En modo DEMO toda pantalla muestra el precinto **«DEMO — DATOS FICTICIOS DE PRUEBA»**.

## Modo real (taller)

1. Integre el paquete de Agente A (`content/public.json`, `content/schema.json`, `content/projection-map.json`, `projection/index.html`, `assets/`).
2. Coloque la clave real **fuera de Git** en `content/answer-key.private.json` (ignorada) o indique otra ruta con `ANSWER_KEY_PATH`.
3. Valide y arranque:

```bash
npm run validar:real   # 0 = aprobado · 1 = errores · 2 = PENDIENTE (falta algo)
npm run real
```

El modo real **falla cerrado**: si falta un archivo, el esquema no coincide, hay referencias rotas, la clave está versionada en Git o es la copia DEMO, el servidor **no arranca** y explica el motivo en español. **Nunca** recurre a los datos DEMO.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run configurar` | Crea `.env` desde `.env.example` con contraseña aleatoria (no sobrescribe). |
| `npm run demo` / `npm run real` | Arranca el servidor en el modo indicado. `npm start` usa `CONTENT_MODE` de `.env`. |
| `npm run validar` / `npm run validar:real` | Puerta de contrato: esquema, referencias, revelado, recursos, mapa de proyección, fugas de datos privados y recorrido HTTP completo. |
| `npm test` | Pruebas unitarias y de integración (`node:test`). |
| `npm run simular` | Partida determinista completa de cinco equipos con resultado exacto esperado. |
| `npm run test:e2e` | Ensayo completo en Chromium: cinco teléfonos, moderación y proyector 16:9. |
| `npm run test:todo` | Todo lo anterior en secuencia. |
| `npm run archivar-partida -- --modo=demo --confirmar` | Archiva la partida activa sin borrar datos (solo si el contenido cambió a mitad de partida). |

## Cómo se juega en la aplicación

| Etapa | Duración | Equipos (teléfono) | Moderación |
|---|---|---|---|
| Tutorial | 7:00 | Reglas y puntos | Reparte códigos |
| Revelación (R1–R4) | 1:00 | Leen la evidencia nueva | — |
| Decisión del equipo | 2:00 (FINAL 1:30) | Sellan su respuesta (una vez) | Ve quién selló |
| Argumentos públicos | 2:30 (FINAL 2:00) | Ven las cinco respuestas | Da la palabra |
| Objeciones | 0:45 | Gastan o guardan una ficha | Ve cuántas llegan |
| Confrontación oral | 3:00 | Ven quién objeta a quién | Coordina turnos |
| Resultados | 0:45 | Ven sus puntos | Puntuación automática |
| Cierre | 5:00 | Clasificación final | Exporta la auditoría |

Los tiempos son **orientativos**: la fase solo cambia cuando la moderación pulsa **Avanzar**. Las respuestas se bloquean al cerrar la decisión y las objeciones al cerrar su ventana. Puntos: **+3** afirmación con el conjunto de evidencias aceptado, **+2** acción válida, **+3** objeción correcta contra la respuesta realmente sellada del equipo objetado; **0** en cualquier otro caso (la ficha se gasta igual). Desempate: más objeciones válidas, luego más afirmaciones sostenidas; si persiste, **victoria conjunta**.

## Estructura del proyecto

```text
src/
  server.js               punto de entrada
  config.js               modos demo|real, rutas, variables de entorno
  constants.js            contrato v1.0 (IDs de equipos y rondas, fases, puntos)
  content/                carga y validación del paquete (esquema + comprobaciones cruzadas)
  engine/                 guion de etapas y motor de puntuación puro
  store/db.js             SQLite: transacciones, unicidad y disparadores de inmutabilidad
  game/service.js         reglas del juego, sesiones, vistas pública/equipo/moderación, auditoría
  http/                   servidor HTTP, roles, CSRF, límites de intentos, CSV
  web/                    interfaz (equipo y estrado), fuentes OFL alojadas localmente
fixtures/demo/            paquete DEMO sintético (público, clave, mapa, esquema, recursos, página de prueba)
scripts/                  validación, simulación, configuración y archivado
tests/                    unitarias, integración y E2E (Playwright)
docs/                     operación, integración, seguridad, despliegue e informe de QA
```

## Documentación

- [docs/OPERACION.md](docs/OPERACION.md): guía del día del taller (teléfonos, proyector, incidencias).
- [docs/INTEGRACION.md](docs/INTEGRACION.md): contrato v1.0, API de la proyección y lista de integración con Agente A.
- [docs/SEGURIDAD.md](docs/SEGURIDAD.md): secretos, repositorio público y riesgos residuales.
- [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md): alojamiento gratuito con HTTPS (Render).
- [docs/INFORME_QA.md](docs/INFORME_QA.md): pruebas ejecutadas, resultados y pendientes.
- [fixtures/demo/README.md](fixtures/demo/README.md): qué es el paquete DEMO y la simulación esperada.

## Licencias de fuentes

La interfaz usa **Archivo** y **Atkinson Hyperlegible Next**, ambas bajo SIL Open Font License 1.1, alojadas en `src/web/static/` (licencias en `src/web/licencias-fuentes/`). No se cargan recursos de Internet: funciona en una Wi‑Fi sin salida.
