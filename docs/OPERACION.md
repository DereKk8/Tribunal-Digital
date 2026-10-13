# Guía de operación del taller

## Antes del taller (día anterior)

1. En el portátil: `npm install`, `npm run configurar` (anote la contraseña que aparece).
2. Integre el paquete real (ver [INTEGRACION.md](INTEGRACION.md)) y ejecute `npm run validar:real`. Debe terminar en **APROBADO**.
3. Haga un ensayo: `npm run real`, abra `/moderador`, cree la partida, entre con dos teléfonos y avance hasta la primera decisión. Después pulse **Reiniciar partida** (escriba `REINICIAR`) para empezar limpio el día del taller.
4. Compruebe la proyección: botón **Abrir proyección** en el estrado, en el portátil conectado al proyector (16:9).

## Red y direcciones

- Conecte el portátil y los teléfonos **a la misma Wi‑Fi**. La consola del servidor muestra la dirección para teléfonos, p. ej. `http://192.168.1.23:3000/`. Escríbala en la pizarra o en las tarjetas.
- Si la red del aula aísla a los dispositivos entre sí (muy común en redes de invitados), use un **punto de acceso** del propio portátil o de un teléfono, o el alojamiento con HTTPS de [DESPLIEGUE.md](DESPLIEGUE.md).
- El servidor escucha en `0.0.0.0:3000`. Si el sistema pregunta, permita conexiones entrantes para Node.js.

## Durante el taller

1. **Estrado** (`/moderador`): inicie sesión y pulse **Crear partida**. Aparecen cinco códigos. **Imprimir códigos** genera una tarjeta por equipo.
2. **Teléfonos**: un teléfono por equipo abre la dirección y escribe su código. El estrado marca cada equipo como *En línea*.
3. **Proyector**: **Abrir proyección** (requiere la sesión de moderación; los códigos de equipo no la abren).
4. **Avanzar** cambia de fase. Cada avance pide confirmación y explica qué se bloquea (p. ej. «Respuestas selladas: 4 de 5; los equipos sin respuesta obtendrán 0»). Un doble clic no avanza dos veces.
5. **Turnos de palabra**: tras cerrar las objeciones, el estrado agrupa quién objeta a quién para dar la palabra. La aplicación nunca silencia a nadie.
6. **Resultados**: al entrar en *Resultados* la puntuación se calcula sola y es idempotente. La tabla *Puntuación regla por regla* explica cada punto.
7. **Cierre**: clasificación final y ganadores (o victoria conjunta). Pulse **Exportar JSON** y **Exportar CSV** y guarde ambos archivos fuera del repositorio.

## Incidencias

| Situación | Qué hacer |
|---|---|
| Un teléfono se apaga o recarga | Vuelve a abrir la dirección: la sesión sigue activa. Si cerró sesión, vuelve a escribir el código. |
| Se corta la Wi‑Fi al sellar | El teléfono reintenta solo; el servidor no duplica respuestas ni fichas. |
| Dos teléfonos del mismo equipo | Solo cuenta el primer sellado; el segundo recibe «ya envió la respuesta». |
| El portátil se reinicia | `npm run real` de nuevo: partida, sesiones, respuestas, fichas y puntos se conservan en `data/`. |
| El servidor no arranca y habla de «otro contenido» | Se cambiaron archivos del paquete a mitad de partida. Restaure los originales o use `npm run archivar-partida -- --modo=real --confirmar` y cree una partida nueva. |
| Un equipo no selló a tiempo | Obtiene 0 en afirmación y acción en esa ronda; puede objetar igualmente. |
| Se pulsó Avanzar por error | No hay retroceso (las respuestas ya se hicieron públicas). Continúe; la puntuación es automática. |

## Después del taller

- Guarde las exportaciones en un lugar privado. `data/` contiene códigos y respuestas: bórrelo o archívelo fuera del repositorio.
- La clave real nunca se sube a Git ni se adjunta a issues, PR o capturas.
