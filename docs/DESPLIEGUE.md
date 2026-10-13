# Despliegue gratuito con HTTPS (Render)

Además del modo recomendado (portátil + Wi‑Fi local), la aplicación puede alojarse en **Render**, plan gratuito, con una URL pública `https://…onrender.com`. Ventaja: los teléfonos pueden usar datos móviles o cualquier Wi‑Fi, con HTTPS.

## Por qué Render y no Vercel

Vercel ejecuta funciones *serverless* sin proceso persistente ni disco: el estado de la partida (SQLite, sesiones, sondeo cada 2 s) no sobreviviría entre peticiones y cada petición podría ir a una instancia distinta. Render ejecuta un **servidor Node normal**, que es lo que esta aplicación necesita, sin cambiar el código.

## Pasos (unos 5 minutos)

1. Cree una cuenta gratuita en <https://render.com> e inicie sesión con GitHub.
2. Abra <https://render.com/deploy?repo=https://github.com/DereKk8/Tribunal-Digital> (usa `render.yaml` de la rama principal; si este cambio aún no está fusionado, cree el servicio desde **New → Blueprint** eligiendo la rama).
3. Render crea el servicio `tribunal-digital` con:
   - `npm ci --omit=dev` y `node src/server.js`;
   - `CONTENT_MODE=demo`, `TRUST_PROXY=1` y una `MODERATOR_PASSWORD` **aleatoria**.
4. Cuando el despliegue termine, abra **Environment** en Render y copie `MODERATOR_PASSWORD`.
5. Entre en `https://<su-servicio>.onrender.com/moderador`.

## Limitaciones del plan gratuito (importantes)

- **Se duerme tras 15 minutos sin tráfico** y tarda ~1 minuto en despertar. Abra el estrado unos minutos antes: el sondeo de las pantallas lo mantiene despierto durante el taller.
- **El disco es efímero**: un reinicio o un nuevo despliegue **borra la partida** (códigos, respuestas y puntos). Cree la partida justo antes de empezar, no despliegue durante el taller y **exporte JSON y CSV** al terminar. Para persistencia real use el portátil o un disco de pago de Render (`DATA_DIR` apuntando al disco).

## Modo real en Render

1. El paquete público de Agente A debe estar en la rama desplegada (vea las recomendaciones de publicación en [SEGURIDAD.md](SEGURIDAD.md)).
2. En Render → **Environment → Secret Files**, cree `answer-key.private.json` con la clave real (Render la monta en `/etc/secrets/`).
3. Cambie `CONTENT_MODE=real` y añada `ANSWER_KEY_PATH=/etc/secrets/answer-key.private.json`.
4. Si algo falta o no valida, el servicio no arranca y el registro de Render muestra el diagnóstico en español.

## Seguridad en la URL pública

- Cookies `Secure` y `SameSite=Strict`; límite de intentos por IP real y tope global de intentos fallidos.
- Cualquiera con la URL ve la pantalla de acceso y `GET /api/public-state` (información pública); sin código o contraseña no puede actuar.
- No comparta la URL del estrado ni la contraseña; los códigos cambian en cada partida.
