# Textos para jugadores

La voz es la de un equipo que conversa: «Ese pase no cuadra» y «Preguntemos al club», con palabras comunes,
verbos concretos y una sola frase por opción. Las opciones del caso no superan 24 palabras. No se añaden
explicaciones que revelen la respuesta, ni se suavizan certezas o acusaciones que los jugadores deban detectar.

Cada evidencia tiene un resumen neutral que permite encontrarla, sin interpretar si demuestra algo.
«Ver evidencia» permite leer el texto completo en párrafos y consultar la captura. Abrir una evidencia no la
selecciona ni envía una respuesta. Las instrucciones se muestran donde hacen falta y las confirmaciones
resumen lo elegido.

La investigación que orientó esta revisión incluye:

- [El diseño narrativo de Reigns, explicado por François Alliot](https://www.gamedeveloper.com/design/game-design-deep-dive-creating-an-adaptive-narrative-in-i-reigns-i-): decisiones mediante tarjetas y una historia que avanza con cada elección.
- [La adaptación de Papers, Please a teléfonos, explicada por Lucas Pope](https://dukope.com/devlogs/papers-please/mobile/): prioridad a documentos legibles y navegación cómoda en pantallas pequeñas.
- [El tutorial de ink de inkle](https://www.inklestudios.com/ink/web-tutorial/): el texto del botón de elección puede separarse del texto narrativo completo.

La frase única, el límite de palabras y los resúmenes desplegables son decisiones de este proyecto inspiradas
en esos enfoques. Se mantienen íntegros los mensajes originales del expediente y la clave de puntuación.

Después de editar `content/src/case.mjs`, regenerar el paquete público y la proyección con sus herramientas;
no editar los archivos generados a mano. Ejecutar las pruebas de texto, el ensayo del contenido y las pruebas
E2E en teléfonos de 360 y 390 px, incluyendo lectura de evidencias, selección, confirmación y objeciones.
