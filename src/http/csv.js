// Exportación CSV de auditoría (UTF-8 con BOM para hojas de cálculo en español).

function cell(v) {
  let s = v === null || v === undefined ? '' : String(v);
  // Evita que una hoja de cálculo interprete el texto como fórmula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const row = (values) => values.map(cell).join(',');

const CATEGORY_LABELS = { argument: 'Argumento', action: 'Acción', objection: 'Objeción' };

export function buildCsv(data) {
  const lines = [];
  lines.push(row(['seccion', 'ronda', 'equipo', 'categoria', 'puntos', 'regla_aplicada', 'motivo', 'detalle']));
  for (const e of data.score_events) {
    const d = e.detail || {};
    let detail;
    if (d.absent) detail = 'sin respuesta';
    else if (e.category === 'objection') detail = `objeta a ${d.target_team_id}; ${d.objection_kind}; cita ${d.cited_evidence_id}; respuesta objetada ${d.target_snapshot?.claim_id} [${(d.target_snapshot?.evidence_ids || []).join(' ')}] ${d.target_snapshot?.action_id}`;
    else detail = `${d.claim_id} [${(d.evidence_ids || []).join(' ')}] ${d.action_id}`;
    lines.push(row(['puntuacion', e.round_id, e.team_id, CATEGORY_LABELS[e.category] ?? e.category, e.points, e.rule_ref ?? 'ninguna', e.reason_label, detail]));
  }
  for (const s of data.standings) {
    lines.push(row(['clasificacion', '', s.team_id, `puesto ${s.rank}`, s.score, '', `objeciones válidas ${s.valid_objections}; argumentos sustentados ${s.supported_arguments}`, data.winners.includes(s.team_id) ? 'ganador' : '']));
  }
  const meta = [
    row(['metadatos', '', '', 'modo', '', '', `${data.content_mode}${data.demo_notice ? ' — ' + data.demo_notice : ''}`, '']),
    row(['metadatos', '', '', 'partida', '', '', data.game.id, '']),
    row(['metadatos', '', '', 'exportado', '', '', data.exported_at, '']),
    row(['metadatos', '', '', 'huella_contenido', '', '', data.content_fingerprint, '']),
  ];
  return '﻿' + [lines[0], ...meta, ...lines.slice(1)].join('\r\n') + '\r\n';
}
