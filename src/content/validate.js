// Comprobaciones del contrato v1.0 que JSON Schema no puede expresar:
// referencias entre archivos, revelado de evidencias, recursos, mapa de
// proyección y fugas de datos privados. Todas las salidas están en español.
import {
  SCHEMA_VERSION, GAME_ID, TEAM_IDS, ROUND_IDS, FINAL_ROUND_ID, OBJECTION_KINDS,
  ID_PATTERN, PRIVATE_FIELD_NAMES, MIN_EVIDENCE_PER_RESPONSE, MAX_EVIDENCE_PER_RESPONSE,
} from '../constants.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const SAFE_ASSET_PATH = /^assets\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;
const SLIDE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_:.-]*$/;
const REQUIRED_SLIDE_PHASES = ['deliberation', 'defense', 'objection', 'resolution'];
const OPTIONAL_SLIDE_PHASES = ['confrontation'];

export const evidenceSetKey = (ids) => [...ids].sort().join('|');

/** Busca claves privadas en cualquier nivel de un objeto JSON. */
function findPrivateKeys(value, path = '', found = []) {
  if (Array.isArray(value)) value.forEach((v, i) => findPrivateKeys(v, `${path}[${i}]`, found));
  else if (isObj(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (PRIVATE_FIELD_NAMES.includes(k)) found.push(`${path}.${k}`);
      findPrivateKeys(v, `${path}.${k}`, found);
    }
  }
  return found;
}

/**
 * Valida el caso público y construye índices. Devuelve el índice aunque haya
 * errores (para seguir detectando problemas en otros archivos).
 */
function checkPublic(pub, errors, warnings, assetExists) {
  const index = { evidence: new Map(), claims: new Map(), actions: new Map(), roundIndex: new Map() };
  if (!isObj(pub)) {
    errors.push('public.json: debe ser un objeto JSON');
    return index;
  }
  if (pub.schema_version !== SCHEMA_VERSION) errors.push(`public.json: schema_version debe ser "${SCHEMA_VERSION}" (es ${JSON.stringify(pub.schema_version)})`);
  if (pub.game_id !== GAME_ID) errors.push(`public.json: game_id debe ser "${GAME_ID}" (es ${JSON.stringify(pub.game_id)})`);

  // Equipos
  if (!Array.isArray(pub.teams)) errors.push('public.json: «teams» debe ser una lista');
  else {
    const ids = pub.teams.map((t) => (isObj(t) ? t.id : undefined));
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dup.length) errors.push(`public.json: equipos repetidos: ${[...new Set(dup)].join(', ')}`);
    const missing = TEAM_IDS.filter((id) => !ids.includes(id));
    const extra = ids.filter((id) => !TEAM_IDS.includes(id));
    if (missing.length) errors.push(`public.json: faltan los equipos: ${missing.join(', ')}`);
    if (extra.length) errors.push(`public.json: equipos no permitidos: ${extra.map((x) => JSON.stringify(x)).join(', ')}`);
    pub.teams.forEach((t, i) => {
      if (!isObj(t) || !isText(t.name)) errors.push(`public.json: teams[${i}] necesita un nombre («name») en español`);
    });
  }

  // Rondas
  if (!Array.isArray(pub.rounds)) {
    errors.push('public.json: «rounds» debe ser una lista');
    return index;
  }
  const roundIds = pub.rounds.map((r) => (isObj(r) ? r.id : undefined));
  if (roundIds.length !== ROUND_IDS.length || roundIds.some((id, i) => id !== ROUND_IDS[i])) {
    errors.push(`public.json: las rondas deben ser exactamente ${ROUND_IDS.join(', ')} en ese orden (son ${roundIds.map(String).join(', ')})`);
  }
  ROUND_IDS.forEach((id, i) => index.roundIndex.set(id, i));

  const allIds = new Map(); // id -> descripción del primer uso
  const reserved = new Set([...TEAM_IDS, ...ROUND_IDS]);
  const registerId = (id, where) => {
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
      errors.push(`public.json: ${where}: identificador inválido ${JSON.stringify(id)} (use letras, números, «-», «_» o «.»; máx. 64)`);
      return false;
    }
    if (reserved.has(id)) {
      errors.push(`public.json: ${where}: el identificador «${id}» coincide con un equipo o una ronda`);
      return false;
    }
    if (allIds.has(id)) {
      errors.push(`public.json: identificador ambiguo «${id}» en ${where} (ya usado en ${allIds.get(id)})`);
      return false;
    }
    allIds.set(id, where);
    return true;
  };

  pub.rounds.forEach((round, ri) => {
    if (!isObj(round)) {
      errors.push(`public.json: rounds[${ri}] debe ser un objeto`);
      return;
    }
    const rid = round.id;
    const label = `ronda ${rid ?? ri}`;
    if (!isText(round.title)) errors.push(`public.json: ${label}: falta el título («title»)`);
    for (const field of ['evidence', 'claims', 'actions']) {
      if (!Array.isArray(round[field]) || round[field].length === 0) {
        errors.push(`public.json: ${label}: «${field}» debe ser una lista no vacía`);
      }
    }
    for (const field of Object.keys(round)) {
      if (PRIVATE_FIELD_NAMES.includes(field)) errors.push(`public.json: ${label}: contiene el campo privado «${field}»`);
    }
    (Array.isArray(round.evidence) ? round.evidence : []).forEach((ev, ei) => {
      const where = `${label}, evidence[${ei}]`;
      if (!isObj(ev)) return errors.push(`public.json: ${where} debe ser un objeto`);
      const ok = registerId(ev.id, where);
      if (!isText(ev.body)) errors.push(`public.json: ${where} (${ev.id}): falta el texto («body»)`);
      if (typeof ev.asset_path !== 'string' || !SAFE_ASSET_PATH.test(ev.asset_path) || ev.asset_path.includes('..')) {
        errors.push(`public.json: ${where} (${ev.id}): «asset_path» debe ser una ruta relativa segura dentro de assets/ (es ${JSON.stringify(ev.asset_path)})`);
      } else if (assetExists && !assetExists(ev.asset_path)) {
        errors.push(`public.json: ${where} (${ev.id}): no existe el recurso «${ev.asset_path}»`);
      }
      if (!ROUND_IDS.includes(ev.revealed_in)) {
        errors.push(`public.json: ${where} (${ev.id}): «revealed_in» inválido ${JSON.stringify(ev.revealed_in)}`);
      } else if (ev.revealed_in !== rid) {
        errors.push(`public.json: ${where} (${ev.id}): «revealed_in» (${ev.revealed_in}) debe coincidir con la ronda que la contiene (${rid})`);
      }
      if (ok) index.evidence.set(ev.id, { ...ev, roundIndex: index.roundIndex.get(ev.revealed_in) ?? ri });
    });
    for (const [field, map, what] of [['claims', index.claims, 'afirmación'], ['actions', index.actions, 'acción']]) {
      (Array.isArray(round[field]) ? round[field] : []).forEach((item, ii) => {
        const where = `${label}, ${field}[${ii}]`;
        if (!isObj(item)) return errors.push(`public.json: ${where} debe ser un objeto`);
        const ok = registerId(item.id, where);
        if (!isText(item.text)) errors.push(`public.json: ${where} (${item.id}): falta el texto de la ${what}`);
        if (ok) map.set(item.id, { ...item, round_id: rid });
      });
    }
    if (Array.isArray(round.claims) && round.claims.length < 2) warnings.push(`public.json: ${label}: solo hay una afirmación; se recomiendan al menos dos.`);
    if (Array.isArray(round.actions) && round.actions.length < 2) warnings.push(`public.json: ${label}: solo hay una acción; se recomiendan al menos dos.`);
  });

  const leaked = findPrivateKeys(pub);
  if (leaked.length) errors.push(`public.json: contiene campos privados de la clave: ${leaked.slice(0, 5).join(', ')}`);
  return index;
}

function checkEvidenceSet(ids, roundId, index, where, errors) {
  if (!Array.isArray(ids)) {
    errors.push(`${where}: la lista de evidencias debe ser un arreglo`);
    return false;
  }
  if (ids.length < MIN_EVIDENCE_PER_RESPONSE || ids.length > MAX_EVIDENCE_PER_RESPONSE) {
    errors.push(`${where}: debe citar entre ${MIN_EVIDENCE_PER_RESPONSE} y ${MAX_EVIDENCE_PER_RESPONSE} evidencias (cita ${ids.length})`);
    return false;
  }
  if (new Set(ids).size !== ids.length) {
    errors.push(`${where}: evidencias repetidas en el mismo conjunto: ${ids.join(', ')}`);
    return false;
  }
  let ok = true;
  const ri = index.roundIndex.get(roundId);
  for (const id of ids) {
    const ev = index.evidence.get(id);
    if (!ev) {
      errors.push(`${where}: la evidencia «${id}» no existe en public.json`);
      ok = false;
    } else if (ev.roundIndex > ri) {
      errors.push(`${where}: la evidencia «${id}» se revela en ${ev.revealed_in}, después de ${roundId} (referencia al futuro)`);
      ok = false;
    }
  }
  return ok;
}

function checkKey(key, pub, index, errors, warnings) {
  const L = 'clave privada';
  if (!isObj(key)) {
    errors.push(`${L}: debe ser un objeto JSON`);
    return;
  }
  if (key.schema_version !== SCHEMA_VERSION) errors.push(`${L}: schema_version debe ser "${SCHEMA_VERSION}" (es ${JSON.stringify(key.schema_version)})`);
  if (key.game_id !== GAME_ID || (isObj(pub) && key.game_id !== pub.game_id)) {
    errors.push(`${L}: game_id (${JSON.stringify(key.game_id)}) no coincide con public.json`);
  }
  if (isObj(pub) && key.schema_version !== pub.schema_version) errors.push(`${L}: schema_version no coincide con public.json`);
  if (!isObj(key.rounds)) {
    errors.push(`${L}: «rounds» debe ser un objeto con las claves ${ROUND_IDS.join(', ')}`);
    return;
  }
  const keys = Object.keys(key.rounds);
  const missing = ROUND_IDS.filter((r) => !keys.includes(r));
  const extra = keys.filter((r) => !ROUND_IDS.includes(r));
  if (missing.length) errors.push(`${L}: faltan las rondas ${missing.join(', ')}`);
  if (extra.length) errors.push(`${L}: rondas desconocidas ${extra.join(', ')}`);

  for (const rid of ROUND_IDS) {
    const entry = key.rounds[rid];
    if (entry === undefined) continue;
    const W = `${L} ${rid}`;
    if (!isObj(entry)) {
      errors.push(`${W}: debe ser un objeto`);
      continue;
    }
    const known = ['accepted_arguments', 'accepted_actions', 'accepted_objections'];
    const unknown = Object.keys(entry).filter((k) => !known.includes(k));
    if (unknown.length) warnings.push(`${W}: campos no reconocidos (se ignoran): ${unknown.join(', ')}`);
    const claimInRound = (id) => index.claims.get(id)?.round_id === rid;
    const actionInRound = (id) => index.actions.get(id)?.round_id === rid;

    // Argumentos aceptados
    if (!Array.isArray(entry.accepted_arguments) || entry.accepted_arguments.length === 0) {
      errors.push(`${W}: «accepted_arguments» debe ser una lista no vacía`);
    }
    const argKeys = new Set();
    (Array.isArray(entry.accepted_arguments) ? entry.accepted_arguments : []).forEach((a, i) => {
      const w = `${W} accepted_arguments[${i}]`;
      if (!isObj(a)) return errors.push(`${w}: debe ser un objeto`);
      if (!claimInRound(a.claim_id)) errors.push(`${w}: la afirmación ${JSON.stringify(a.claim_id)} no pertenece a ${rid}`);
      if (checkEvidenceSet(a.evidence_ids, rid, index, w, errors)) {
        const k = `${a.claim_id}#${evidenceSetKey(a.evidence_ids)}`;
        if (argKeys.has(k)) errors.push(`${w}: combinación repetida (misma afirmación y mismo conjunto de evidencias)`);
        argKeys.add(k);
      }
    });

    // Acciones aceptadas
    if (!Array.isArray(entry.accepted_actions) || entry.accepted_actions.length === 0) {
      errors.push(`${W}: «accepted_actions» debe ser una lista no vacía`);
    } else {
      const seen = new Set();
      entry.accepted_actions.forEach((id, i) => {
        if (!actionInRound(id)) errors.push(`${W} accepted_actions[${i}]: la acción ${JSON.stringify(id)} no pertenece a ${rid}`);
        if (seen.has(id)) errors.push(`${W} accepted_actions[${i}]: acción repetida «${id}»`);
        seen.add(id);
      });
    }

    // Objeciones aceptadas
    if (!Array.isArray(entry.accepted_objections)) {
      errors.push(`${W}: «accepted_objections» debe ser una lista`);
      continue;
    }
    if (entry.accepted_objections.length === 0) warnings.push(`${W}: no hay objeciones aceptadas; toda objeción en esta ronda valdrá 0.`);
    const objKeys = new Set();
    entry.accepted_objections.forEach((o, i) => {
      const w = `${W} accepted_objections[${i}]`;
      if (!isObj(o)) return errors.push(`${w}: debe ser un objeto`);
      let ok = true;
      if (!claimInRound(o.target_claim_id)) { errors.push(`${w}: «target_claim_id» ${JSON.stringify(o.target_claim_id)} no pertenece a ${rid}`); ok = false; }
      if (!checkEvidenceSet(o.target_evidence_ids, rid, index, `${w} target_evidence_ids`, errors)) ok = false;
      if (!actionInRound(o.target_action_id)) { errors.push(`${w}: «target_action_id» ${JSON.stringify(o.target_action_id)} no pertenece a ${rid}`); ok = false; }
      if (!OBJECTION_KINDS.includes(o.objection_kind)) { errors.push(`${w}: categoría inválida ${JSON.stringify(o.objection_kind)}`); ok = false; }
      if (!checkEvidenceSet([o.cited_evidence_id], rid, index, `${w} cited_evidence_id`, errors)) ok = false;
      if (!ok) return;
      const k = [o.target_claim_id, evidenceSetKey(o.target_evidence_ids), o.target_action_id, o.objection_kind, o.cited_evidence_id].join('#');
      if (objKeys.has(k)) errors.push(`${w}: regla de objeción repetida`);
      objKeys.add(k);
      const targetArgOk = argKeys.has(`${o.target_claim_id}#${evidenceSetKey(o.target_evidence_ids)}`);
      const targetActOk = Array.isArray(entry.accepted_actions) && entry.accepted_actions.includes(o.target_action_id);
      if (targetArgOk && targetActOk) warnings.push(`${w}: la objeción ataca una respuesta que también puntúa como totalmente correcta; revise si es intencional.`);
    });
  }
}

/** Cuenta los elementos con la clase «slide» (estructura de make-slide). */
export function countSlides(html) {
  let n = 0;
  const re = /<[a-zA-Z][^>]*\sclass\s*=\s*["']([^"']*)["'][^>]*>/g;
  let m;
  while ((m = re.exec(html))) if (m[1].split(/\s+/).includes('slide')) n += 1;
  return n;
}

function htmlHasId(html, id) {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\sid\\s*=\\s*["']${esc}["']`).test(html);
}

function checkProjectionMap(map, pub, projectionHtml, errors, warnings) {
  const L = 'projection-map.json';
  if (!isObj(map)) {
    errors.push(`${L}: debe ser un objeto JSON`);
    return;
  }
  if (map.schema_version !== SCHEMA_VERSION) errors.push(`${L}: schema_version debe ser "${SCHEMA_VERSION}"`);
  if (map.game_id !== GAME_ID) errors.push(`${L}: game_id debe ser "${GAME_ID}"`);
  const slideCount = typeof projectionHtml === 'string' ? countSlides(projectionHtml) : null;
  const checkRef = (ref, where) => {
    if (typeof ref === 'string') {
      if (!SLIDE_ID_PATTERN.test(ref)) return errors.push(`${L}: ${where}: identificador de diapositiva inválido ${JSON.stringify(ref)}`);
      if (typeof projectionHtml === 'string' && !htmlHasId(projectionHtml, ref)) {
        errors.push(`${L}: ${where}: la diapositiva con id «${ref}» no existe en la proyección`);
      }
    } else if (Number.isInteger(ref) && ref >= 0) {
      if (slideCount === 0) warnings.push(`${L}: ${where}: no se pudo contar diapositivas «.slide» en la proyección para verificar el índice ${ref}`);
      else if (slideCount !== null && ref >= slideCount) errors.push(`${L}: ${where}: índice ${ref} fuera de rango (hay ${slideCount} diapositivas)`);
    } else {
      errors.push(`${L}: ${where}: debe ser un id de diapositiva (texto) o un índice entero ≥ 0`);
    }
  };
  for (const opt of ['tutorial', 'closing']) if (map[opt] !== undefined) checkRef(map[opt], opt);
  if (!isObj(map.rounds)) {
    errors.push(`${L}: «rounds» debe ser un objeto con las claves ${ROUND_IDS.join(', ')}`);
    return;
  }
  for (const rid of ROUND_IDS) {
    const r = map.rounds[rid];
    if (!isObj(r)) {
      errors.push(`${L}: falta la ronda ${rid}`);
      continue;
    }
    const required = rid === FINAL_ROUND_ID ? REQUIRED_SLIDE_PHASES : ['reveal', ...REQUIRED_SLIDE_PHASES];
    for (const ph of required) {
      if (r[ph] === undefined) errors.push(`${L}: ${rid}: falta la fase «${ph}»`);
      else checkRef(r[ph], `${rid}.${ph}`);
    }
    for (const ph of OPTIONAL_SLIDE_PHASES) if (r[ph] !== undefined) checkRef(r[ph], `${rid}.${ph}`);
    if (rid === FINAL_ROUND_ID && r.reveal !== undefined) warnings.push(`${L}: FINAL no tiene revelación cronometrada; «reveal» se ignora.`);
    const allowed = new Set(['reveal', ...REQUIRED_SLIDE_PHASES, ...OPTIONAL_SLIDE_PHASES]);
    const unknown = Object.keys(r).filter((k) => !allowed.has(k));
    if (unknown.length) errors.push(`${L}: ${rid}: fases desconocidas ${unknown.join(', ')}`);
  }
  const extra = Object.keys(map.rounds).filter((k) => !ROUND_IDS.includes(k));
  if (extra.length) errors.push(`${L}: rondas desconocidas ${extra.join(', ')}`);
  const leaked = findPrivateKeys(map);
  if (leaked.length) errors.push(`${L}: contiene campos privados de la clave: ${leaked.slice(0, 5).join(', ')}`);
}

/** Frases largas de un texto privado (para buscar fugas literales). */
export function privateSentences(text) {
  if (typeof text !== 'string') return [];
  return text
    .split(/[\n.!?¡¿]+/)
    .map((s) => s.replace(/[#*>`_|-]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 40);
}

const LEAK_MARKERS = [...PRIVATE_FIELD_NAMES, 'answer-key', 'answer_key', 'rationales.private', '.private.json'];

/** Revisa texto público (HTML, JSON público) en busca de datos privados. */
export function findLeaks(label, text, rationalesText) {
  const found = [];
  if (typeof text !== 'string') return found;
  for (const m of LEAK_MARKERS) if (text.includes(m)) found.push(`${label}: contiene el marcador privado «${m}»`);
  const norm = text.replace(/\s+/g, ' ');
  for (const s of privateSentences(rationalesText)) {
    if (norm.includes(s)) found.push(`${label}: contiene literalmente una frase de rationales.private.md («${s.slice(0, 50)}…»)`);
  }
  return found;
}

/**
 * Valida el paquete completo. Entradas ya parseadas; `assetExists(path)` permite
 * comprobar recursos sin acoplarse al sistema de archivos.
 */
export function validatePackage({ publicCase, answerKey, projectionMap, projectionHtml, assetExists, rationalesText, publicText }) {
  const errors = [];
  const warnings = [];
  const index = checkPublic(publicCase, errors, warnings, assetExists);
  if (answerKey !== undefined) checkKey(answerKey, publicCase, index, errors, warnings);
  if (projectionMap !== undefined) checkProjectionMap(projectionMap, publicCase, projectionHtml, errors, warnings);
  if (typeof projectionHtml === 'string') errors.push(...findLeaks('proyección (index.html)', projectionHtml, rationalesText));
  if (typeof publicText === 'string' && rationalesText) {
    errors.push(...findLeaks('public.json', publicText, rationalesText).filter((e) => e.includes('rationales')));
  }
  return { errors, warnings, index };
}
