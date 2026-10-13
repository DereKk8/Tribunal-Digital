// Validador mínimo de JSON Schema (draft 2020-12) sin dependencias.
// Cubre exactamente las palabras clave que usa content/schema.json:
// $ref (punteros locales), oneOf, allOf, type, required, properties,
// additionalProperties, prefixItems, items, minItems, maxItems, uniqueItems,
// enum, const, pattern, minLength, minimum, propertyNames.
// El esquema también se verificó con Ajv 8 (modo estricto) y con python-jsonschema.

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function resolvePointer(root, ref) {
  if (!ref.startsWith('#')) throw new Error(`Solo se admiten $ref locales: ${ref}`);
  const parts = ref.slice(1).split('/').filter(Boolean).map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let node = root;
  for (const p of parts) {
    node = node?.[p];
    if (node === undefined) throw new Error(`$ref sin resolver: ${ref}`);
  }
  return node;
}

export function validate(schema, data, root = schema, at = '$') {
  const errors = [];
  const err = (m) => errors.push(`${at}: ${m}`);
  if (schema === true) return errors;
  if (schema === false) return [`${at}: no se admite ningún valor aquí`];

  if (schema.$ref) errors.push(...validate(resolvePointer(root, schema.$ref), data, root, at));
  if (schema.allOf) for (const s of schema.allOf) errors.push(...validate(s, data, root, at));
  if (schema.oneOf) {
    const results = schema.oneOf.map((s) => validate(s, data, root, at));
    const ok = results.filter((r) => r.length === 0).length;
    if (ok !== 1) {
      const best = results.reduce((a, b) => (b.length < a.length ? b : a));
      err(`debe cumplir exactamente una alternativa (cumple ${ok})`);
      if (ok === 0) errors.push(...best.slice(0, 8));
    }
  }
  if (schema.type) {
    const t = typeOf(data);
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const ok = allowed.some((a) => a === t || (a === 'number' && (t === 'integer' || t === 'number')));
    if (!ok) { err(`se esperaba ${allowed.join('|')} y llegó ${t}`); return errors; }
  }
  if ('const' in schema && !deepEqual(schema.const, data)) err(`debe ser ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((e) => deepEqual(e, data))) err(`valor no permitido ${JSON.stringify(data)}`);

  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) err(`texto demasiado corto`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(data)) err(`«${data}» no cumple ${schema.pattern}`);
  }
  if (typeof data === 'number' && schema.minimum !== undefined && data < schema.minimum) err(`debe ser ≥ ${schema.minimum}`);

  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) err(`mínimo ${schema.minItems} elementos`);
    if (schema.maxItems !== undefined && data.length > schema.maxItems) err(`máximo ${schema.maxItems} elementos`);
    if (schema.uniqueItems && new Set(data.map((d) => JSON.stringify(d))).size !== data.length) err('elementos repetidos');
    const pre = schema.prefixItems || [];
    pre.forEach((s, i) => { if (i < data.length) errors.push(...validate(s, data[i], root, `${at}[${i}]`)); });
    if (schema.items !== undefined) {
      for (let i = pre.length; i < data.length; i++) errors.push(...validate(schema.items, data[i], root, `${at}[${i}]`));
    }
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const r of schema.required || []) if (!(r in data)) err(`falta la propiedad obligatoria «${r}»`);
    const props = schema.properties || {};
    for (const [k, v] of Object.entries(data)) {
      if (schema.propertyNames) errors.push(...validate(schema.propertyNames, k, root, `${at}.${k}(nombre)`));
      if (k in props) errors.push(...validate(props[k], v, root, `${at}.${k}`));
      else if (schema.additionalProperties !== undefined) {
        if (schema.additionalProperties === false) err(`propiedad no permitida «${k}»`);
        else errors.push(...validate(schema.additionalProperties, v, root, `${at}.${k}`));
      }
    }
  }
  return errors;
}
