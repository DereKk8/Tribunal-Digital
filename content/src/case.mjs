// Tribunal Digital · Caso «El pase directo»
// Fuente canónica PÚBLICA del caso: equipos, rondas, evidencias, afirmaciones y acciones.
// De aquí se generan content/public.json, las imágenes de assets/evidence/ y la proyección.
// Este archivo NO contiene (ni debe contener) qué opciones puntúan: eso vive solo en
// content/answer-rules.private.json, que está excluido de Git.

export const GAME_ID = 'tribunal-digital';
export const SCHEMA_VERSION = '1.0';

export const CASE_INFO = {
  title: 'El pase directo',
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
  { name: 'Leo Márquez', role: '14 años. Juega a Fractal Arena como «LeoNova14».' },
  { name: 'Marina Márquez', role: '20 años, hermana de Leo. Reúne el expediente con permiso de Leo.' },
  { name: 'Carmen Ruiz', role: 'Madre de Leo. Es la persona adulta inscrita en el club.' },
  { name: 'Club Atalaya eSports', role: 'Club que organiza el Semillero Atalaya 2026 para jugadores de 13 a 17 años.' },
];

export const GLOSSARY = [
  { term: 'Fractal Arena', text: 'Videojuego en línea. Tiene partidas «normales» y «clasificatorias» (por rango), chat privado y regalos de «Cristales».' },
  { term: 'Lumen', text: 'Red social de fotos y videos. La insignia ✓ indica una cuenta verificada.' },
  { term: 'Susurro', text: 'App de mensajería. Permite activar «mensajes temporales», que se borran solos.' },
  { term: 'Portal Familias', text: 'Web del club donde la persona adulta inscrita hace los trámites del Semillero.' },
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
    question: '¿Qué respalda la oferta de «pase directo» que recibió Leo?',
    claims: [
      'El Semillero existe y su cuerpo técnico puede invitar a jugadores; por lo tanto, quien le escribe a Leo es de verdad el entrenador Rai Ferrer.',
      'RaiCoach_ATL no es una cuenta nueva: lleva años en el servidor siguiendo partidas y conoce bien el nivel de jugadores como Leo.',
      'Está claro que el «pase directo» de RaiCoach_ATL no figura en las bases: según la web del club, a la final se pasa desde el clasificatorio.',
      'RaiCoach_ATL miente desde el primer mensaje: dice que vio a Leo en clasificatorias, pero Leo no había jugado ni una partida clasificatoria antes del 3 de octubre.',
      'Que un adulto desconocido le escriba a un menor por el chat del juego ya demuestra que se trata de un caso de grooming.',
    ],
    actions: [
      'Responderle con su edad, su ciudad y su colegio: el Semillero existe, la plaza parece real y esos datos no son tan delicados.',
      'Consultar al club por su canal oficial, para comprobar si esa cuenta y ese «pase directo» son reales.',
      'Avisar en el chat del clan de que Rai Ferrer, el entrenador del Atalaya, intenta engañar a menores.',
      'Bloquear la cuenta y borrar el chat para cortar el contacto de raíz, y que Leo siga jugando como si nada hubiera pasado.',
    ],
  },
  {
    id: 'R2',
    number: 2,
    name: 'Secretos y canales',
    question: '¿Qué distingue un secreto inocente de una señal de alerta?',
    claims: [
      'Dani también pidió un dato personal de Leo y un secreto; por lo tanto, su conducta debe preocupar tanto como la de RaiCoach_ATL.',
      'Los dos secretos son muy distintos: Dani pide guardar una jugada ante un equipo rival, mientras RaiCoach_ATL pide ocultar el contacto a la familia.',
      'El paso a Susurro demuestra que RaiCoach_ATL no es el verdadero Rai Ferrer: el club dice que su personal nunca sigue conversaciones por apps externas.',
      'RaiCoach_ATL le recordó a Leo que su madre debía completar la inscripción en el Portal Familias, tal como pide el club en sus bases.',
      'El club dice que su personal nunca sigue conversaciones por apps externas; por lo tanto, el paso a Susurro queda fuera de los canales del Semillero.',
    ],
    actions: [
      'Seguir hablando con RaiCoach_ATL en Susurro, solo de temas del juego y sin dar ningún dato, hasta que el club publique la lista de la final.',
      'Enviarle a RaiCoach_ATL las preguntas frecuentes del club y exigirle que explique por qué no cumple sus normas.',
      'Contárselo a su madre, para que ella consulte al club por el canal oficial si ese contacto es suyo.',
      'Pedirle a Dani, que conoce bien el juego, que escriba a rf_coach haciéndose pasar por Leo para ver qué responde.',
    ],
  },
  {
    id: 'R3',
    number: 3,
    name: '¿Quién está detrás?',
    question: '¿Qué podemos afirmar —y qué no— sobre la identidad de quien escribe?',
    claims: [
      'Los horarios del 3 de octubre dejan abierta la identidad: rf_coach escribió durante la narración y también durante el corte.',
      'Según el correo del club, Rai Ferrer admitió que las tres cuentas son suyas, aunque asegura que las usa solo para buscar talento joven.',
      'Como el club confirma que Rai Ferrer es su entrenador, las cuentas que usan su nombre y su foto también son suyas.',
      'La foto de perfil de @rai.atalaya es la misma imagen de Rai Ferrer que aparece en la web del Semillero.',
      'rf_coach no puede ser Rai Ferrer: todos sus mensajes del sábado 3 de octubre se enviaron mientras Rai narraba en vivo el clasificatorio.',
    ],
    actions: [
      'Guardar capturas con fecha y hora de chats y perfiles antes de que se borren, y que Leo deje de responder.',
      'Que Leo siga respondiendo con normalidad y sin dar datos, para no levantar sospechas mientras el club termina de investigar.',
      'Responder al correo del club adjuntando todas las capturas guardadas.',
      'Que Carmen le escriba a rf_coach desde el móvil de Leo, se identifique como su madre y le exija que deje en paz a su hijo.',
    ],
  },
  {
    id: 'R4',
    number: 4,
    name: 'La escalada',
    question: '¿Hay ya un riesgo claro que justifique denunciar?',
    claims: [
      'Todavía es pronto para denunciar: mientras no se sepa quién está detrás de rf_coach, cualquier denuncia sería precipitada y podría perjudicar a un inocente.',
      'El correo del 12 de octubre es otro intento de engaño: pide datos de Leo, igual que rf_coach, y llega por un canal que no es el que usa el club.',
      'Videollamada a solas, fotos de su cuarto y una cita sin adultos: con eso ya hay motivo para denunciar, sin esperar a saber quién escribe.',
      'Ya está probado que rf_coach es Rai Ferrer: firma con sus iniciales y escribió «tengo un respiro» justo en el corte de la transmisión.',
      'La «prueba privada» del 17 no es del Semillero: la única cita presencial que anuncia el club es la final del 24, en la sede y con un adulto.',
    ],
    actions: [
      'Que Leo acepte la cita del 17 y Marina lo acompañe a escondidas para desenmascararlo.',
      'Publicar en Lumen las capturas, con el nombre de Leo tapado, para que otras familias del Semillero estén alerta cuanto antes.',
      'Responderle a rf_coach que la familia ya avisó a la policía, para que se asuste, desaparezca y no vuelva a escribir a Leo.',
      'Guardar las pruebas y, con su madre, reportar las cuentas en las plataformas y denunciar ante el club y la policía.',
    ],
  },
  {
    id: 'FINAL',
    number: 5,
    name: 'Veredicto',
    question: '¿Qué sostiene la evidencia completa y qué hacemos ahora?',
    claims: [
      'Nunca hubo riesgo real: quien suplantaba al entrenador no buscaba más que los cristales y la cuenta de Leo, como en tantas estafas del juego.',
      'Es seguro que el caso sigue abierto tras suspender @rai.atalaya: rf_coach dejó otro contacto, @r.ferrer.pro, que esa suspensión deja fuera.',
      'Rai Ferrer manejaba las cuentas desde el principio, y el club, en lugar de investigarlo, intenta encubrirlo con un comunicado a las familias.',
      'Las cuentas suplantaban a Rai Ferrer y mostraron señales de captación; quién está detrás y si cometió un delito lo determinará la investigación.',
      'Está demostrado que detrás de las cuentas hay un depredador con más víctimas entre las familias del Semillero: por eso el club avisa a todas ellas.',
    ],
    actions: [
      'Mantener la denuncia, aportar @r.ferrer.pro y rf_coach a la investigación y acompañar a Leo con su familia y el club.',
      'Dar el caso por cerrado con la suspensión, borrar las capturas para que Leo pase página y no volver a hablar del tema en casa.',
      'Crear una cuenta falsa para seguir de cerca a @r.ferrer.pro, reunir más pruebas y entregar a la policía todo lo que se consiga.',
      'Difundir en Lumen las capturas y el aviso del club, para que ninguna otra familia caiga en la trampa.',
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
