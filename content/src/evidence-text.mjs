// Genera la transcripción accesible (campo `body` de public.json) a partir de los
// datos estructurados de cada evidencia. Así el texto de la imagen y el texto del
// JSON salen de la misma fuente y no pueden contradecirse.

const q = (s) => `«${s}»`;

function chatLines(messages) {
  return messages.map((m) => `${m.t} ${m.from}: ${q(m.text)}`);
}

export function evidenceBody(ev) {
  const lines = [];
  switch (ev.kind) {
    case 'web': {
      const w = ev.web;
      lines.push(`Página web oficial del ${w.site} (${w.url}). ${ev.when}.`);
      lines.push(`Título: ${q(w.title)}${w.subtitle ? `. Subtítulo: ${q(w.subtitle)}` : ''}.`);
      if (w.blocks) for (const b of w.blocks) lines.push(`${b.head}: ${q(b.text)}`);
      if (w.staff) {
        lines.push(`${w.staffTitle}: ${w.staff.map((s) => `${s.name} (${s.role.toLowerCase()})`).join(', ')}. ${q(w.staffNote)}`);
        if (w.safeguarding) lines.push(q(w.safeguarding));
      }
      if (w.faq) for (const f of w.faq) lines.push(`${q(f.q)} — ${q(f.a)}`);
      break;
    }
    case 'game-chat': {
      const c = ev.chat;
      lines.push(`Chat privado de Fractal Arena entre ${c.other.handle} y ${c.me}. ${ev.when}.`);
      lines.push(`Encabezado del chat: ${c.other.handle} · ${c.other.line}.`);
      lines.push(...chatLines(c.messages));
      break;
    }
    case 'game-profile': {
      const p = ev.profile;
      lines.push(`Perfil de jugador en Fractal Arena: ${p.handle}. ${ev.when}.`);
      lines.push(`Bio: ${q(p.bio)}.`);
      lines.push(p.stats.map(([k, v]) => `${k}: ${v}`).join(' · ') + '.');
      if (p.status) lines.push(`Estado: ${p.status.toLowerCase()}.`);
      if (p.history) {
        lines.push('Historial reciente: ' + p.history.map(([d, mode, res]) => `${d} — modo ${mode} — ${res}`).join('; ') + '.');
      }
      break;
    }
    case 'group-info': {
      const g = ev.group;
      lines.push(`Información del grupo de Susurro ${q(g.name)}. ${ev.when}.`);
      lines.push(`${g.meta} · ${g.created} · ${g.temporal}.`);
      lines.push(`Descripción: ${q(g.description)}`);
      lines.push('Participantes: ' + g.members.map((m) => (m.note ? `${m.name} (${m.note})` : m.name)).join('; ') + '.');
      break;
    }
    case 'lumen-profile': {
      const l = ev.lumen;
      lines.push(`Perfil de Lumen ${l.handle} (${q(l.name)}). ${ev.when}.`);
      lines.push(`${l.verified ? 'Con insignia de verificación' : 'Sin insignia de verificación'} · ${l.joined} · ${l.counts.map(([n, w]) => `${n} ${w}`).join(' · ')}.`);
      lines.push(`Bio: ${q(l.bio)}`);
      lines.push(ev.extraNote);
      lines.push(l.postsNote);
      break;
    }
    case 'email': {
      const e = ev.email;
      lines.push(`Correo electrónico. ${ev.when}.`);
      lines.push(`De: ${e.from} · Para: ${e.to}${e.cc ? ` · CC: ${e.cc}` : ''} · Asunto: ${q(e.subject)}`);
      lines.push(q(e.paragraphs.join(' ')));
      lines.push(`Firma: ${e.signature}.`);
      break;
    }
    case 'lumen-post': {
      const p = ev.post;
      lines.push(`Publicación de Lumen de ${p.handle} (${p.name}, cuenta ${p.verified ? 'verificada' : 'sin verificar'}). ${ev.when}.`);
      lines.push(`${p.live}: ${q(p.text)}`);
      lines.push(p.imageNote);
      break;
    }
    case 'phone-chat': {
      const p = ev.phone;
      lines.push(`Chat de Susurro entre ${p.contact} y Leo. ${ev.when}. Indicador del chat: ${p.sub}.`);
      if (p.notice) lines.push(`Aviso del chat: ${q(p.notice)}`);
      lines.push(...chatLines(p.messages));
      if (p.footer) lines.push(p.footer);
      break;
    }
    case 'game-notification': {
      const n = ev.notification;
      lines.push(`Notificación de Fractal Arena recibida por ${n.to}. ${ev.when}.`);
      lines.push(`${q(n.title)}. Mensaje: ${q(n.message)}. Estado: ${n.status.toLowerCase()}. ${n.balance}.`);
      break;
    }
    case 'platform-notice': {
      const n = ev.notice;
      lines.push(`Aviso del Centro de Seguridad de Lumen a ${n.to}. ${ev.when}.`);
      lines.push(`${n.ref}: ${q(n.paragraphs.join(' '))}`);
      lines.push(`Estado: ${n.status}.`);
      break;
    }
    default:
      throw new Error(`Tipo de evidencia desconocido: ${ev.kind}`);
  }
  if (ev.extraNote && ev.kind !== 'lumen-profile') lines.push(ev.extraNote);
  return `${ev.id} · ${ev.label}\n` + lines.join('\n');
}
