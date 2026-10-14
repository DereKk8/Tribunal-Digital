// Tribunal Digital · Caso «El pase directo»
// Fuente canónica PÚBLICA del caso: equipos, rondas, evidencias, afirmaciones y acciones.
// De aquí se generan content/public.json, las imágenes de assets/evidence/ y la proyección.
// Este archivo NO contiene (ni debe contener) qué opciones puntúan: eso vive solo en
// content/answer-rules.private.json, que está excluido de Git.

export const GAME_ID = 'tribunal-digital';
export const SCHEMA_VERSION = '1.0';

export const CASE_INFO = {
  title: 'El pase directo',
  introduction: 'Leo tiene 14 años y quiere jugar el torneo del Club Atalaya. Su mamá ya lo inscribió. Un contacto dice ser Rai Ferrer, el entrenador, y le ofrece un pase directo a la final. Marina, su hermana, nos pide averiguar si la oferta es real y cómo ayudar a Leo.',
  tagline: 'Un caso ficticio sobre ofertas, perfiles y secretos en un videojuego en línea',
  disclaimer:
    'Caso ficticio. Las personas, cuentas, marcas, sitios y dominios son inventados. No contiene material sexual explícito.',
  provenance:
    'Leo guardó algunas capturas porque quería enseñarlas cuando su «pase» fuera oficial; las demás las reunió Marina a partir del 8 de octubre.',
};

export const TEAMS = [
  { id: 'azul', name: 'Equipo Azul' },
  { id: 'rojo', name: 'Equipo Rojo' },
  { id: 'verde', name: 'Equipo Verde' },
  { id: 'amarillo', name: 'Equipo Amarillo' },
  { id: 'morado', name: 'Equipo Morado' },
];

// Personajes y glosario (se muestran en la introducción; no revelan rondas futuras).
export const CHARACTERS = [
  { name: 'Leo Márquez', role: 'Tiene 14 años y quiere jugar el torneo del club.' },
  { name: 'Marina Márquez', role: 'Es la hermana mayor de Leo y reúne las pruebas con su permiso.' },
  { name: 'Carmen Ruiz', role: 'Es la mamá de Leo y hace su inscripción al torneo.' },
  { name: 'Club Atalaya', role: 'Organiza el torneo para jugadores de 13 a 17 años.' },
];

export const GLOSSARY = [
  { term: 'El juego', text: 'Leo habla con otros jugadores y recibe regalos virtuales.' },
  { term: 'La red social', text: 'La insignia indica que la plataforma verificó una cuenta.' },
  { term: 'La app de mensajes', text: 'Las conversaciones pueden borrarse solas si se activan mensajes temporales.' },
  { term: 'El portal del club', text: 'La mamá de Leo hace aquí los trámites oficiales del torneo.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCIAS
// Cada evidencia tiene datos estructurados que se usan tanto para dibujar la
// maqueta (SVG) como para escribir la transcripción accesible (body).
// ─────────────────────────────────────────────────────────────────────────────

const RAI_PHOTO_NOTE = 'Rai Ferrer aparece con gorra morada del club y auriculares amarillos.';

export const EVIDENCE = [
  // ───────────── RONDA 1 ─────────────
  {
    id: 'E01', round: 'R1', kind: 'web',
    label: 'Página web del club',
    title: 'Las reglas del torneo',
    summary: 'El torneo exige una prueba previa y una final acompañada por un adulto.',
    facts: ['Solo los 40 mejores de la prueba del 3 de octubre pasan a la final del 24.', 'Rai Ferrer es el entrenador y su equipo puede invitar a jugadores a inscribirse.', 'Las familias hacen la inscripción en el portal del club.', 'En la foto oficial, el entrenador lleva gorra morada y auriculares amarillos.'],
    source: 'clubatalaya.gg/semillero',
    when: 'Publicada el lunes 7 de septiembre de 2026',
    web: {
      url: 'clubatalaya.gg/semillero',
      site: 'Club Atalaya eSports',
      published: 'Publicado el 7 sep 2026',
      title: 'Semillero Atalaya 2026',
      subtitle: 'Pruebas abiertas de Fractal Arena para jugadores de 13 a 17 años',
      blocks: [
        { head: '1 · Inscripción', text: 'La hace la madre, el padre o el tutor en el Portal Familias, hasta el miércoles 30 de septiembre a las 23:59.' },
        { head: '2 · Clasificatorio online', text: 'Sábado 3 de octubre, de 10:00 a 14:00, con transmisión en Lumen Live (@clubatalaya).' },
        { head: '3 · Final presencial', text: 'Los 40 mejores del clasificatorio pasan a la final del sábado 24 de octubre en la Sede Atalaya, acompañados por un adulto responsable.' },
      ],
      staffTitle: 'Cuerpo técnico',
      staffNote: 'Nuestro cuerpo técnico sigue partidas del servidor y puede invitar a jugadores destacados a inscribirse.',
      safeguarding: 'Coordinación y protección de menores: Inés Calvo.',
      staff: [
        { name: 'Rai Ferrer', role: 'Entrenador principal', avatar: 'rai' },
        { name: 'Lucía Paz', role: 'Analista', avatar: 'lucia' },
        { name: 'Tomás Ibarra', role: 'Preparador', avatar: 'tomas' },
      ],
    },
    extraNote: RAI_PHOTO_NOTE,
  },
  {
    id: 'E02', round: 'R1', kind: 'game-chat',
    label: 'Chat privado de Fractal Arena',
    title: 'La oferta que recibió Leo',
    summary: 'Un contacto dice ser el entrenador y ofrece a Leo saltarse la prueba previa.',
    facts: ['Dice que vio a Leo jugando partidas clasificatorias.', 'Pide su edad, ciudad y colegio, y dice que la oferta todavía no es pública.', 'Leo le cuenta que su mamá ya lo inscribió.'],
    source: 'Fractal Arena · Mensajes',
    when: 'Martes 29 de septiembre de 2026',
    chat: {
      me: 'LeoNova14',
      other: { handle: 'RaiCoach_ATL', avatar: 'atl', line: 'Nivel 9' },
      day: 'MARTES 29 DE SEPTIEMBRE',
      messages: [
        { t: '21:47', from: 'RaiCoach_ATL', text: 'Ey, crack 👋 Te estuve viendo en clasificatorias. Tienes muy buen nivel 🔥' },
        { t: '21:48', from: 'RaiCoach_ATL', text: 'Soy Rai, entreno al Semillero Atalaya. Estoy armando una lista corta para darles pase directo a la final del 24, sin pasar por el clasificatorio.' },
        { t: '21:50', from: 'LeoNova14', text: 'en serio?? ya me inscribió mi mamá en el portal' },
        { t: '21:52', from: 'RaiCoach_ATL', text: 'Perfecto 😉 Para la lista necesito tu edad, tu ciudad y en qué cole estás. Y tranqui, que esto todavía no es público.' },
      ],
    },
  },
  {
    id: 'E03', round: 'R1', kind: 'game-profile',
    label: 'Perfil de jugador: RaiCoach_ATL',
    title: 'La cuenta del contacto',
    summary: 'La cuenta del supuesto entrenador tenía ocho días cuando escribió a Leo y apenas 14 partidas.',
    facts: ['Usa el logo del club y se presenta como entrenador.', 'Tiene nivel 9 y no tiene rango en partidas clasificatorias.'],
    source: 'Fractal Arena · Perfil',
    when: 'Captura de Leo, martes 29 de septiembre de 2026, 21:55',
    profile: {
      handle: 'RaiCoach_ATL',
      avatar: 'atl',
      bio: 'Coach del Semillero Atalaya 🦅 | scouting',
      stats: [
        ['Nivel', '9'],
        ['Cuenta creada', '21 sep 2026'],
        ['Partidas jugadas', '14'],
        ['Rango clasificatoria', 'Sin clasificar'],
        ['Amigos', '6'],
        ['Clan', '—'],
      ],
      status: 'En línea',
      history: null,
    },
  },
  {
    id: 'E04', round: 'R1', kind: 'game-profile',
    label: 'Perfil de jugador: LeoNova14',
    title: 'Lo que sabemos de Leo',
    summary: 'Leo tiene 14 años, buen nivel y ya jugó partidas clasificatorias antes de la invitación.',
    facts: ['Jugó clasificatorias el 28 y el 29 de septiembre.', 'Su perfil muestra su zona y el grupo al que pertenece.'],
    source: 'Fractal Arena · Perfil',
    when: 'Captura de Leo, martes 29 de septiembre de 2026, 21:56',
    profile: {
      handle: 'LeoNova14',
      avatar: 'leo',
      bio: '14 · zona norte · main Vex',
      stats: [
        ['Nivel', '63'],
        ['Cuenta creada', '3 mar 2023'],
        ['Partidas jugadas', '1.284'],
        ['Rango clasificatoria', 'Diamante II'],
        ['Amigos', '57'],
        ['Clan', 'Los Zurdos [MONTEVERDE]'],
      ],
      status: 'En línea',
      history: [
        ['lun 28 sep', 'Clasificatoria', 'Victoria'],
        ['mar 29 sep', 'Clasificatoria', 'Victoria · MVP'],
        ['mar 29 sep', 'Normal', 'Derrota'],
      ],
    },
  },

  // ───────────── RONDA 2 ─────────────
  {
    id: 'E05', round: 'R2', kind: 'game-chat',
    label: 'Chat privado de Fractal Arena',
    title: 'Un secreto para la familia',
    summary: 'El contacto pide hablar por otra app y ocultar la conversación a la familia de Leo.',
    facts: ['Activa mensajes que se borran solos.', 'Dice que él arregla la inscripción sin que la mamá use el portal del club.'],
    source: 'Fractal Arena · Mensajes',
    when: 'Jueves 1 de octubre de 2026',
    chat: {
      me: 'LeoNova14',
      other: { handle: 'RaiCoach_ATL', avatar: 'atl', line: 'Nivel 9' },
      day: 'JUEVES 1 DE OCTUBRE',
      messages: [
        { t: '22:10', from: 'RaiCoach_ATL', text: 'Lo del pase va bien. Aquí hay mucho mirón; mejor seguimos por Susurro: rf_coach' },
        { t: '22:11', from: 'RaiCoach_ATL', text: 'Allá pongo mensajes temporales, así no queda nada colgado 😉' },
        { t: '22:12', from: 'LeoNova14', text: 'ok. le digo a mi mamá?' },
        { t: '22:14', from: 'RaiCoach_ATL', text: 'Todavía no. Ni en casa ni al clan, que después se ilusionan y si no sale es un bajón. Y no hace falta que tu mamá toque nada en el portal: yo lo gestiono desde dentro.' },
        { t: '22:15', from: 'LeoNova14', text: 'vale 👍' },
      ],
    },
  },
  {
    id: 'E06', round: 'R2', kind: 'game-chat',
    label: 'Chat privado de Fractal Arena',
    title: 'El secreto de Dani',
    summary: 'Dani, compañero de Leo, le pide el número para sumarlo al grupo del colegio.',
    facts: ['Dice que el profesor Andrés Gil dirige el grupo.', 'Pide ocultar una jugada al equipo rival, sin pedir que Leo oculte el grupo a su familia.'],
    source: 'Fractal Arena · Mensajes',
    when: 'Jueves 1 de octubre de 2026',
    chat: {
      me: 'LeoNova14',
      other: { handle: 'DaniZurdo', avatar: 'dani', line: 'Nivel 88 · «16 · capi de Los Zurdos»' },
      day: 'JUEVES 1 DE OCTUBRE',
      messages: [
        { t: '19:05', from: 'DaniZurdo', text: 'Leo! Pásame tu número y te meto al grupo del equipo del cole, el que lleva el profe Gil 💪' },
        { t: '19:06', from: 'DaniZurdo', text: 'Y ni una palabra a los del Colegio San Telmo sobre la jugada del humo: es nuestra sorpresa para el intercolegial 🤫' },
        { t: '19:20', from: 'LeoNova14', text: 'jaja hecho. ahí va: [número tapado por Marina]' },
      ],
    },
  },
  {
    id: 'E07', round: 'R2', kind: 'group-info',
    label: 'Información de un grupo de Susurro',
    title: 'El grupo del colegio',
    summary: 'El grupo del colegio tiene un profesor a cargo y mantiene informadas a las familias.',
    facts: ['El profesor Andrés Gil administra el equipo del Colegio Monteverde.', 'Los mensajes no se borran y las familias reciben un correo cada semana.'],
    source: 'Susurro · Info del grupo',
    when: 'Captura de Leo, viernes 2 de octubre de 2026',
    group: {
      name: 'Los Zurdos · Monteverde',
      meta: 'Grupo · 9 participantes',
      created: 'Creado por Prof. Andrés Gil',
      temporal: 'Mensajes temporales: desactivados',
      description: 'Equipo de eSports del Colegio Monteverde. Avisos de entrenamientos y torneos. Las familias reciben un resumen semanal por correo.',
      members: [
        { name: 'Prof. Andrés Gil', note: 'Admin' },
        { name: 'Dani Soler', note: '' },
        { name: 'Leo Márquez', note: 'Añadido por Prof. Andrés Gil · 2 oct' },
        { name: '+ 6 integrantes más del equipo', note: '' },
      ],
    },
  },
  {
    id: 'E08', round: 'R2', kind: 'web',
    label: 'Página web del club',
    title: 'Cómo se comunica el club',
    summary: 'El club no ofrece pases directos ni pide datos a menores por mensajes privados.',
    facts: ['Los 40 puestos dependen de la prueba previa del 3 de octubre.', 'Los trámites se hacen en el portal del club con el adulto inscrito.', 'El personal puede felicitar por el chat público, pero no seguir hablando por otra app.'],
    source: 'clubatalaya.gg/semillero/preguntas',
    when: 'Publicada el lunes 7 de septiembre de 2026',
    web: {
      url: 'clubatalaya.gg/semillero/preguntas',
      site: 'Club Atalaya eSports',
      published: 'Publicado el 7 sep 2026',
      title: 'Preguntas frecuentes del Semillero',
      subtitle: null,
      faq: [
        { q: '¿El cuerpo técnico puede escribirme?', a: 'Puede felicitarte en el chat público del juego, pero nunca te pedirá datos personales ni seguirá la conversación por mensajes privados o apps externas. Todos los trámites se hacen en el Portal Familias, con la persona adulta inscrita.' },
        { q: '¿Hay pases directos a la final?', a: 'No. Las 40 plazas de la final salen del clasificatorio del 3 de octubre.' },
        { q: '¿Cómo sé si un mensaje es del club?', a: 'Nuestros correos terminan en @clubatalaya.gg. Ante cualquier duda, escribe a semillero@clubatalaya.gg.' },
      ],
    },
  },

  // ───────────── RONDA 3 ─────────────
  {
    id: 'E09', round: 'R3', kind: 'lumen-profile',
    label: 'Perfil de Lumen: @rai.atalaya',
    title: 'Una foto conocida',
    summary: 'El perfil del contacto en la red social usa el nombre y una foto del entrenador.',
    facts: ['No está verificado, se creó en septiembre y solo tiene tres fotos del club.', 'La foto muestra al entrenador con gorra morada y auriculares amarillos.'],
    source: 'Lumen · Perfil',
    when: 'Captura de Marina, jueves 8 de octubre de 2026',
    lumen: {
      handle: '@rai.atalaya',
      name: 'Rai Ferrer | Coach',
      verified: false,
      avatar: 'rai',
      joined: 'Se unió en septiembre de 2026',
      counts: [['3', 'publicaciones'], ['41', 'seguidores'], ['12', 'seguidos']],
      bio: 'Coach Semillero Atalaya 🦅 Busco talento. DM abiertos.',
      posts: ['logo', 'sede', 'logo2'],
      postsNote: 'Publicaciones: tres imágenes del logo y la sede del club.',
    },
    extraNote: 'Foto de perfil: Rai Ferrer con gorra morada del club y auriculares amarillos.',
  },
  {
    id: 'E10', round: 'R3', kind: 'email',
    label: 'Correo del club',
    title: 'La primera respuesta del club',
    summary: 'El club confirma quién es su entrenador, pero aún investiga quién maneja las cuentas que escriben a Leo.',
    facts: ['El perfil público de Rai Ferrer sí está verificado.', 'Las cuentas del contacto no figuran entre las declaradas por el personal.', 'El club sigue consultando al entrenador y pide que Leo no responda.'],
    source: 'Correo electrónico',
    when: 'Viernes 9 de octubre de 2026, 10:32',
    email: {
      from: 'Inés Calvo <proteccion@clubatalaya.gg>',
      to: 'Carmen Ruiz',
      cc: 'Marina Márquez',
      date: 'vie 9 oct 2026, 10:32',
      subject: 'Re: Mensajes recibidos por Leo Márquez',
      paragraphs: [
        'Hola, Carmen y Marina: gracias por escribirnos.',
        'Les confirmo que Raimundo Ferrer es el entrenador principal del Semillero; su perfil público es @raiferrer, verificado en Lumen.',
        'Las cuentas RaiCoach_ATL, @rai.atalaya y rf_coach no son cuentas del club ni figuran entre las que nuestro personal tiene declaradas. Lo estamos consultando con Rai y les escribiremos en cuanto tengamos respuesta.',
        'Les recuerdo que nadie del club ofrece pases directos ni escribe a jugadores menores por mensajes privados. Mientras tanto, les pedimos que Leo no responda a esas cuentas.',
      ],
      signature: 'Inés Calvo · Coordinadora del Semillero y responsable de protección de menores',
    },
  },
  {
    id: 'E11', round: 'R3', kind: 'lumen-post',
    title: 'Los horarios de la transmisión',
    summary: 'Rai Ferrer narró la prueba del torneo, pero el directo tuvo un corte de 15 minutos.',
    facts: ['La transmisión fue el 3 de octubre, de 10:00 a 14:00.', 'Estuvo cortada de 12:00 a 12:15.'],
    label: 'Publicación de Lumen de @clubatalaya',
    source: 'Lumen · Publicación',
    when: 'Sábado 3 de octubre de 2026, 09:45',
    post: {
      handle: '@clubatalaya',
      name: 'Club Atalaya eSports',
      verified: true,
      time: 'sáb 3 oct · 09:45',
      live: 'EN VIVO HOY',
      text: 'Clasificatorio del Semillero Atalaya 2026, de 10:00 a 14:00. Narran Rai Ferrer y Lucía Paz. De 12:00 a 12:15, pausa técnica: se corta la transmisión.',
      imageNote: 'Imagen: Rai Ferrer y Lucía Paz en la mesa de narración, con auriculares.',
    },
  },
  {
    id: 'E12', round: 'R3', kind: 'phone-chat',
    title: 'Los horarios de los mensajes',
    summary: 'El contacto envió tres mensajes a Leo el mismo día de la prueba del torneo.',
    facts: ['Escribió a las 11:06, 12:07 y 13:31 del 3 de octubre.', 'A las 12:07, dijo que tenía un descanso.', 'La cuenta usa las iniciales del entrenador y sus mensajes se borran en 24 horas.'],
    label: 'Chat de Susurro con rf_coach',
    source: 'Susurro · Chat',
    when: 'Captura de Leo, sábado 3 de octubre de 2026, 13:40',
    phone: {
      clock: '13:40',
      contact: 'rf_coach',
      sub: 'mensajes temporales · 24 h',
      notice: 'rf_coach activó los mensajes temporales: los mensajes desaparecen 24 horas después de enviarse.',
      day: 'SÁBADO 3 DE OCTUBRE',
      messages: [
        { t: '11:06', from: 'rf_coach', text: '¿Cómo vas en el clasificatorio? Yo aquí liado con mil cosas 😅' },
        { t: '12:07', from: 'rf_coach', text: 'Te escribo rápido, que tengo un respiro: el lunes te llega una sorpresa 🎁' },
        { t: '12:09', from: 'Leo', text: 'jaja qué es' },
        { t: '13:31', from: 'rf_coach', text: 'Sorpresa es sorpresa 😉 ¿Sigues jugando?' },
      ],
      footer: null,
    },
  },

  // ───────────── RONDA 4 ─────────────
  {
    id: 'E13', round: 'R4', kind: 'game-notification',
    label: 'Notificación de regalo en Fractal Arena',
    title: 'Un regalo para Leo',
    summary: 'El contacto regaló a Leo 1.200 monedas del videojuego y le pidió guardar el secreto.',
    facts: ['Leo recibió el regalo el 5 de octubre y lo aceptó.', 'El contacto dice que el regalo es para la ropa virtual del equipo.'],
    source: 'Fractal Arena · Notificaciones',
    when: 'Lunes 5 de octubre de 2026, 20:14',
    notification: {
      to: 'LeoNova14',
      time: 'lun 5 oct · 20:14',
      title: 'RaiCoach_ATL te regaló 1.200 Cristales',
      message: 'Para la skin del equipo. Que quede entre nosotros 😉',
      status: 'Aceptado',
      balance: 'Saldo actual: 1.350 Cristales',
    },
  },
  {
    id: 'E14', round: 'R4', kind: 'phone-chat',
    title: 'Una llamada a solas',
    summary: 'El contacto pide a Leo una videollamada a solas y fotos de su cuarto.',
    facts: ['El 7 de octubre, pide que no haya nadie más en el cuarto.', 'También pide una foto de Leo con la camiseta del equipo.', 'Pregunta a qué colegio va para organizar un transporte.'],
    label: 'Chat de Susurro con rf_coach',
    source: 'Susurro · Chat',
    when: 'Captura de Leo, miércoles 7 de octubre de 2026, 22:51',
    phone: {
      clock: '22:51',
      contact: 'rf_coach',
      sub: 'mensajes temporales · 24 h',
      notice: null,
      day: 'MIÉRCOLES 7 DE OCTUBRE',
      messages: [
        { t: '21:58', from: 'rf_coach', text: 'Para cerrar tu pase necesito verte jugar por videollamada. A solas, sin nadie en el cuarto, que si no me desconcentro 😅' },
        { t: '22:01', from: 'rf_coach', text: 'Antes mándame una foto tuya con la camiseta del equipo y otra de tu cuarto, para ver la luz y el setup.' },
        { t: '22:03', from: 'rf_coach', text: '¿Y a qué cole vas? Es para coordinar el transporte.' },
        { t: '22:40', from: 'Leo', text: 'mmm no sé, mañana veo' },
      ],
      footer: null,
    },
  },
  {
    id: 'E15', round: 'R4', kind: 'phone-chat',
    title: 'Una cita sin sus padres',
    summary: 'El contacto propone recoger a Leo para una prueba privada el 17 de octubre, sin sus padres.',
    facts: ['La reunión sería cerca de su colegio, que encontró en el perfil del juego.', 'Pide guardar el secreto y deja otro perfil de la red social por si desaparece.', 'Leo no aceptó ni respondió a la propuesta.'],
    label: 'Chat de Susurro con rf_coach',
    source: 'Susurro · Chat',
    when: 'Captura de Marina, sábado 10 de octubre de 2026, 18:02',
    phone: {
      clock: '18:02',
      contact: 'rf_coach',
      sub: 'mensajes temporales · 24 h',
      notice: null,
      day: 'SÁBADO 10 DE OCTUBRE',
      messages: [
        { t: '16:12', from: 'rf_coach', text: 'Leo? Te noto desaparecido 😕' },
        { t: '16:15', from: 'rf_coach', text: 'El sábado 17 hago una prueba privada para los del pase, en un local cerca del Monteverde (vi en tu clan que es tu cole). Te paso a buscar a las 16:00. No hace falta que vengan tus papás: es algo técnico y rapidito.' },
        { t: '16:16', from: 'rf_coach', text: 'Y si algún día no me encuentras por aquí, búscame en Lumen como @r.ferrer.pro' },
        { t: '16:17', from: 'rf_coach', text: 'No le cuentes a nadie todavía, que se arruina la sorpresa 🤐' },
      ],
      footer: 'Leo no respondió.',
    },
  },
  {
    id: 'E16', round: 'R4', kind: 'email',
    label: 'Correo del club',
    title: 'La invitación oficial',
    summary: 'Un correo oficial confirma que Leo ganó su plaza en la final del 24 de octubre.',
    facts: ['El correo del 12 de octubre confirma que Leo quedó en el puesto 27 en la prueba del día 3.', 'Su mamá debe completar la autorización, el contacto de emergencia y la ficha médica en el portal.', 'La final es en la sede del club y Leo debe ir acompañado por un adulto.'],
    source: 'Correo electrónico',
    when: 'Lunes 12 de octubre de 2026, 09:15',
    email: {
      from: 'Inscripciones Semillero <inscripciones@clubatalaya.gg>',
      to: 'Carmen Ruiz (adulta inscrita)',
      cc: null,
      date: 'lun 12 oct 2026, 09:15',
      subject: 'Leo Márquez · Final presencial del 24 de octubre',
      paragraphs: [
        'Hola, Carmen: ¡enhorabuena! Leo terminó en el puesto 27 del clasificatorio del 3 de octubre y tiene plaza en la final presencial del sábado 24 de octubre, a las 10:00, en la Sede Atalaya (Av. del Puerto 1450).',
        'Para confirmar la plaza, complete en el Portal Familias antes del 20 de octubre: la autorización firmada por el adulto responsable, un contacto de emergencia y la ficha médica básica.',
        'Leo debe venir acompañado por un adulto. Nunca pedimos datos por mensaje privado ni directamente a los jugadores.',
      ],
      signature: 'Equipo de Inscripciones del Semillero Atalaya',
    },
  },

  // ───────────── FINAL ─────────────
  {
    id: 'E17', round: 'FINAL', kind: 'platform-notice',
    label: 'Aviso del Centro de Seguridad de Lumen',
    title: 'La red social responde',
    summary: 'La red social suspendió el primer perfil por suplantar la identidad del entrenador.',
    facts: ['La suspensión afecta al perfil denunciado, no a todos los contactos relacionados.', 'La plataforma no revela quién lo manejaba y permite reportar otras cuentas.'],
    source: 'Lumen · Centro de Seguridad',
    when: 'Martes 13 de octubre de 2026, 08:40',
    notice: {
      to: 'Marina Márquez',
      time: 'mar 13 oct 2026 · 08:40',
      ref: 'Tu reporte #LM-48213',
      paragraphs: [
        'Revisamos la cuenta @rai.atalaya que reportaste el 10 de octubre y la suspendimos por suplantación de identidad.',
        'Por privacidad, no podemos compartir información sobre quién la gestionaba.',
        'Si ves otra cuenta relacionada, repórtala desde su perfil.',
      ],
      status: 'Cuenta suspendida: @rai.atalaya',
    },
  },
  {
    id: 'E18', round: 'FINAL', kind: 'email',
    label: 'Correo del club',
    title: 'El club presenta una denuncia',
    summary: 'El entrenador niega manejar las cuentas y el club ya presentó una denuncia a la policía.',
    facts: ['Rai Ferrer reportó personalmente las cuentas por usar su identidad.', 'El club avisa a todas las familias sin revelar los datos de Leo.', 'Pide conservar las capturas y ofrece apoyo psicológico a Leo.'],
    source: 'Correo electrónico',
    when: 'Martes 13 de octubre de 2026, 12:10',
    email: {
      from: 'Inés Calvo <proteccion@clubatalaya.gg>',
      to: 'Carmen Ruiz',
      cc: 'Marina Márquez',
      date: 'mar 13 oct 2026, 12:10',
      subject: 'Re: Mensajes recibidos por Leo Márquez',
      paragraphs: [
        'Hola de nuevo: Rai Ferrer nos confirmó que no creó ni maneja RaiCoach_ATL, @rai.atalaya ni rf_coach, y él mismo las reportó como suplantación.',
        'Con las capturas que nos enviaron, ayer presentamos una denuncia ante la unidad de delitos informáticos de la policía. Hoy avisaremos a todas las familias del Semillero, sin dar ningún dato de Leo.',
        'Les pedimos que conserven todas las capturas y no borren nada. Si Leo lo necesita, la psicóloga del club puede acompañarlo.',
      ],
      signature: 'Inés Calvo',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// RONDAS: pregunta investigable, afirmaciones y acciones (en orden de pantalla)
// ─────────────────────────────────────────────────────────────────────────────

export const ROUNDS = [
  {
    id: 'R1',
    number: 1,
    name: 'La invitación',
    question: '¿Ese pase directo es real?',
    context: 'Leo tiene 14 años y quiere jugar el torneo del Club Atalaya. Su mamá ya lo inscribió. Un contacto dice ser Rai Ferrer, el entrenador, y le ofrece un pase directo a la final. Marina, su hermana, nos pide revisar la oferta: tenemos las reglas del torneo, la invitación y los perfiles del juego.',
    claims: [
      'El contacto es el verdadero entrenador porque el club existe y busca jugadores.',
      'El contacto lleva años viendo partidas de jugadores como Leo.',
      'El pase se salta la prueba que el club exige para llegar a la final.',
      'El contacto miente sobre las clasificatorias, porque Leo nunca había jugado una antes del 3 de octubre.',
      'Que un adulto desconocido escriba a Leo ya demuestra que busca abusar de él.',
    ],
    actions: [
      'Démosle la edad, la ciudad y el colegio de Leo, porque la plaza parece real.',
      'Verifiquemos la cuenta y el pase por el canal oficial del club.',
      'Avisemos a otros jugadores de que el entrenador engaña a menores.',
      'Bloqueemos la cuenta y borremos el chat para que Leo siga jugando tranquilo.',
    ],
  },
  {
    id: 'R2',
    number: 2,
    name: 'Secretos y canales',
    question: '¿Son iguales los dos secretos?',
    context: 'Leo, de 14 años, recibió una oferta de pase directo al torneo del Club Atalaya de alguien que dice ser el entrenador Rai Ferrer. Ahora ese contacto pide cambiar de app y ocultar la conversación a su familia. Dani, compañero de Leo, también pide un secreto sobre una jugada. Marina, la hermana de Leo, nos pide comparar las situaciones.',
    claims: [
      'Dani y el contacto piden datos y secretos, así que deberían preocuparnos por igual.',
      'Dani oculta una jugada al rival, pero el contacto oculta la charla a la familia.',
      'El contacto no puede ser el entrenador, porque usa una app que el club prohíbe.',
      'El contacto pidió que la mamá de Leo terminara la inscripción en el portal.',
      'El contacto rompe las normas del club al seguir hablando por otra app.',
    ],
    actions: [
      'Sigamos hablando del juego por la nueva app sin dar datos hasta que el club publique los finalistas.',
      'Mandémosle las normas del club y pidámosle que explique por qué no las cumple.',
      'Contémoselo a la mamá de Leo para que consulte al club por su canal oficial.',
      'Pidamos a Dani que se haga pasar por Leo y escriba al contacto.',
    ],
  },
  {
    id: 'R3',
    number: 3,
    name: '¿Quién está detrás?',
    question: '¿Sabemos quién escribe?',
    context: 'Leo tiene 14 años y habla con un contacto que dice ser Rai Ferrer, entrenador del torneo del Club Atalaya. Le ofreció un pase directo y pidió ocultar la charla a su familia. Marina, su hermana, reúne un perfil, la respuesta del club y los horarios de una transmisión para comprobar quién escribe.',
    claims: [
      'Los horarios dejan la identidad abierta: hubo mensajes durante el directo y durante el corte.',
      'El club dice que su entrenador admitió usar las tres cuentas para buscar jugadores.',
      'Las cuentas deben ser del entrenador, porque el club confirma su nombre y usan su foto.',
      'La foto del perfil del contacto coincide con la del entrenador en la web del club.',
      'El contacto no puede ser el entrenador, porque todos sus mensajes llegaron mientras él narraba.',
    ],
    actions: [
      'Guardemos capturas con fecha y hora antes de que se borren, y que Leo deje de responder.',
      'Que Leo siga respondiendo sin dar datos mientras el club investiga, para no levantar sospechas.',
      'Respondamos al correo del club con todas las capturas.',
      'Que su mamá escriba desde el teléfono de Leo, se presente y exija que lo deje en paz.',
    ],
  },
  {
    id: 'R4',
    number: 4,
    name: 'La escalada',
    question: '¿Ya hay motivos para denunciar?',
    context: 'Leo, de 14 años, recibió una oferta de pase directo al torneo del Club Atalaya de un contacto que dice ser su entrenador. Marina, su hermana, ya consultó al club, pero todavía no sabemos quién escribe. Ahora el contacto envía un regalo, pide fotos y una llamada a solas, y propone una prueba privada; también llega una invitación oficial.',
    claims: [
      'Denunciar sin saber quién escribe sería precipitado y podría perjudicar a un inocente.',
      'El correo del día 12 también es una trampa: pide datos y usa un canal ajeno al club.',
      'Fotos del cuarto, llamada a solas y cita sin adultos bastan para denunciar, sin saber quién escribe.',
      'El contacto es el entrenador: usa sus iniciales y dijo tener un descanso justo cuando se cortó el directo.',
      'La prueba del 17 no es del club: su final es el 24, en la sede y con un adulto.',
    ],
    actions: [
      'Aceptemos la cita del 17 y que Marina acompañe a Leo a escondidas para descubrir quién es.',
      'Publiquemos las capturas en la red social con el nombre de Leo tapado para alertar a otras familias.',
      'Digamos al contacto que avisamos a la policía para asustarlo y que deje de escribir.',
      'Guardemos pruebas y, con su mamá, denunciemos ante las plataformas, el club y la policía.',
    ],
  },
  {
    id: 'FINAL',
    number: 5,
    name: 'Veredicto',
    question: '¿Qué sabemos y qué hacemos ahora?',
    context: 'Leo tiene 14 años y recibió una oferta de pase directo al torneo del Club Atalaya. El contacto, que usaba el nombre del entrenador Rai Ferrer, pidió secretos, fotos y un encuentro sin adultos. Marina, su hermana, guardó pruebas y consultó al club. Ahora llegan las respuestas de la red social y del club para decidir qué hacer.',
    claims: [
      'Solo querían robar las monedas y la cuenta del juego, así que Leo nunca estuvo en riesgo.',
      'El caso sigue abierto seguro, porque el contacto dejó otro perfil que la red social no ha suspendido.',
      'El entrenador manejaba las cuentas y el club intenta encubrirlo en vez de investigarlo.',
      'Suplantaron al entrenador y hay señales de manipulación; toca investigar quién escribe y si hubo delito.',
      'El aviso del club a las familias demuestra que hay un agresor y que Leo no es su única víctima.',
    ],
    actions: [
      'Sigamos con la denuncia, aportemos ambos contactos y apoyemos a Leo con su familia y el club.',
      'Borrémoslo todo y cerremos el tema en casa, porque la cuenta ya está suspendida.',
      'Creemos una cuenta falsa para seguir el segundo perfil y llevar más pruebas a la policía.',
      'Compartamos las capturas y el aviso del club en la red social para alertar a otras familias.',
    ],
  },
];

export const ROUND_IDS = ROUNDS.map((r) => r.id);

export function claimId(roundId, i) {
  return `${roundId}-C${i + 1}`;
}
export function actionId(roundId, i) {
  return `${roundId}-A${i + 1}`;
}
