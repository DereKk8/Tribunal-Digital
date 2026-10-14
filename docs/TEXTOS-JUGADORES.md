# Textos para jugadores

La voz es la de un equipo que conversa: «Ese pase no cuadra» y «Preguntemos al club», con palabras comunes,
verbos concretos y una sola frase por opción. Las opciones del caso no superan 24 palabras. No se añaden
explicaciones que revelen la respuesta, ni se suavizan certezas o acusaciones que los jugadores deban detectar.

Cada ronda presenta el caso desde cero: quién es Leo, quién pide ayuda, qué oferta recibió y qué está pasando
ahora, en un máximo de 70 palabras. Cada pista tiene un título, una frase que explica lo que muestra y hasta
cuatro hechos breves. Los resúmenes describen cada fuente sin anticipar conclusiones que exigen cruzar varias
pruebas. Los nombres de usuario se sustituyen por roles claros, como «el contacto» y «el entrenador».

La lectura muestra historia y pistas; las opciones aparecen al decidir. El botón «Pistas» abre el archivo desde
todas las fases, incluso después de sellar y durante los resultados. Solo incluye las rondas ya reveladas,
cada una con su contexto. Abrirlo no selecciona pruebas, cambia respuestas ni gasta fichas. Las capturas
originales se muestran a petición, fuera de las opciones, con proporciones naturales y un visor que contiene
la imagen completa. Las transcripciones se conservan en el paquete de origen, sin mostrarlas como texto de juego.

La investigación que orientó esta revisión incluye:

- [El diseño narrativo de Reigns, explicado por François Alliot](https://www.gamedeveloper.com/design/game-design-deep-dive-creating-an-adaptive-narrative-in-i-reigns-i-): decisiones mediante tarjetas y una historia que avanza con cada elección.
- [La adaptación de Papers, Please a teléfonos, explicada por Lucas Pope](https://dukope.com/devlogs/papers-please/mobile/): prioridad a documentos legibles y navegación cómoda en pantallas pequeñas.
- [El tutorial de ink de inkle](https://www.inklestudios.com/ink/web-tutorial/): el texto del botón de elección puede separarse del texto narrativo completo.

La frase única, el límite de palabras y los resúmenes desplegables son decisiones de este proyecto inspiradas
en esos enfoques. Se mantienen íntegros los mensajes originales del expediente y la clave de puntuación.

Después de editar `content/src/case.mjs`, regenerar el paquete público y la proyección con sus herramientas;
no editar los archivos generados a mano. Ejecutar las pruebas de texto, el ensayo del contenido y las pruebas
E2E en teléfonos de 360 y 390 px, incluyendo contexto, acceso a pistas en todas las fases, selección,
confirmación, objeciones y las 18 capturas sin recortes.
