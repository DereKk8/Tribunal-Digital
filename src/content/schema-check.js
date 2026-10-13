// Validación con JSON Schema (ajv) y traducción de errores al español.
import Ajv from 'ajv';
import Ajv2019 from 'ajv/dist/2019.js';
import Ajv2020 from 'ajv/dist/2020.js';

const DEF_CANDIDATES = {
  public: ['public_case', 'publicCase', 'public'],
  answer_key: ['answer_key', 'answerKey', 'private_key', 'privateKey'],
  projection_map: ['projection_map', 'projectionMap'],
};

const DEFAULT_ID = 'https://tribunal-digital.local/schema/canonical';

function pickAjv(schema) {
  const meta = typeof schema.$schema === 'string' ? schema.$schema : '';
  const opts = { allErrors: true, strict: false, validateFormats: false };
  if (meta.includes('2020-12')) return new Ajv2020(opts);
  if (meta.includes('2019-09')) return new Ajv2019(opts);
  if (meta === '' || meta.includes('draft-07') || meta.includes('draft-06')) return new Ajv(opts);
  throw new Error(`versión de JSON Schema no compatible: ${meta}`);
}

function translate(err) {
  const p = err.params || {};
  switch (err.keyword) {
    case 'required': return `falta la propiedad obligatoria «${p.missingProperty}»`;
    case 'type': return `debe ser de tipo ${p.type}`;
    case 'const': return `debe valer ${JSON.stringify(p.allowedValue)}`;
    case 'enum': return `debe ser uno de: ${(p.allowedValues || []).map((v) => JSON.stringify(v)).join(', ')}`;
    case 'minItems': return `debe tener al menos ${p.limit} elemento(s)`;
    case 'maxItems': return `debe tener como máximo ${p.limit} elemento(s)`;
    case 'minLength': return `debe tener al menos ${p.limit} carácter(es)`;
    case 'maxLength': return `debe tener como máximo ${p.limit} carácter(es)`;
    case 'pattern': return `no cumple el formato ${p.pattern}`;
    case 'uniqueItems': return `tiene elementos repetidos (posiciones ${p.j} y ${p.i})`;
    case 'additionalProperties': return `propiedad no permitida «${p.additionalProperty}»`;
    case 'minimum': return `debe ser ≥ ${p.limit}`;
    case 'not': return 'contiene datos que el esquema prohíbe (p. ej. campos privados)';
    case 'oneOf': return 'no coincide exactamente con una de las formas permitidas';
    case 'anyOf': return 'no coincide con ninguna de las formas permitidas';
    case 'false schema': return 'elemento no permitido';
    default: return `no cumple la regla «${err.keyword}»`;
  }
}

export function formatAjvErrors(fileLabel, errors) {
  const seen = new Set();
  const out = [];
  for (const e of errors || []) {
    // Los errores internos de combinadores se resumen en el error padre.
    if (e.keyword === 'if' || e.keyword === '$ref') continue;
    const msg = `${fileLabel}: ${e.instancePath || '(raíz)'} ${translate(e)}`;
    if (!seen.has(msg)) {
      seen.add(msg);
      out.push(msg);
    }
  }
  return out.slice(0, 40);
}

function findDef(schema, kind) {
  for (const bucket of ['$defs', 'definitions']) {
    const defs = schema[bucket];
    if (!defs || typeof defs !== 'object') continue;
    for (const name of DEF_CANDIDATES[kind]) {
      if (defs[name]) return `#/${bucket}/${name}`;
    }
  }
  return null;
}

/**
 * Valida los documentos contra el esquema. Devuelve {errors, warnings}.
 * - public: con $defs.public_case (o similar) o, si no existe, con la raíz.
 * - answer_key / projection_map: solo si el esquema define $defs para ellos;
 *   si no, se deja un aviso (las comprobaciones en código siguen siendo obligatorias).
 */
export function checkWithSchema(schema, docs) {
  const errors = [];
  const warnings = [];
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return { errors: ['schema.json: el esquema debe ser un objeto JSON'], warnings };
  }
  let ajv;
  const s = structuredClone(schema);
  if (typeof s.$id !== 'string' || !s.$id) s.$id = DEFAULT_ID;
  try {
    ajv = pickAjv(s);
    ajv.addSchema(s);
  } catch (e) {
    return { errors: [`schema.json: no se pudo compilar el esquema (${e.message})`], warnings };
  }
  const plan = [
    { kind: 'public', label: 'public.json', doc: docs.publicCase, fallbackRoot: true },
    { kind: 'answer_key', label: 'clave privada', doc: docs.answerKey, fallbackRoot: false },
    { kind: 'projection_map', label: 'projection-map.json', doc: docs.projectionMap, fallbackRoot: false },
  ];
  for (const item of plan) {
    if (item.doc === undefined) continue;
    const pointer = findDef(s, item.kind);
    let validate;
    try {
      if (pointer) validate = ajv.compile({ $ref: s.$id + pointer });
      else if (item.fallbackRoot) validate = ajv.getSchema(s.$id);
      else {
        warnings.push(`schema.json no define $defs para «${item.label}»; se valida solo con las comprobaciones del contrato en código.`);
        continue;
      }
    } catch (e) {
      errors.push(`schema.json: no se pudo preparar la validación de ${item.label} (${e.message})`);
      continue;
    }
    if (!validate(item.doc)) errors.push(...formatAjvErrors(item.label, validate.errors));
  }
  return { errors, warnings };
}
