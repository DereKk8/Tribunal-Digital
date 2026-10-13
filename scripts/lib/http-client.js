// Cliente HTTP mínimo con cookies, para la simulación y las pruebas.
export class Client {
  constructor(baseUrl, { headers = {} } = {}) {
    this.base = baseUrl;
    this.cookies = new Map();
    this.extraHeaders = headers;
  }

  async req(method, path, body, { headers = {}, rawBody, contentType } = {}) {
    const h = { ...this.extraHeaders, ...headers };
    if (this.cookies.size) h.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    let payload;
    if (rawBody !== undefined) {
      payload = rawBody;
      if (contentType) h['content-type'] = contentType;
    } else if (body !== undefined) {
      payload = JSON.stringify(body);
      h['content-type'] = contentType ?? 'application/json';
    }
    const res = await fetch(this.base + path, { method, headers: h, body: payload, redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      const k = kv.slice(0, i).trim();
      const v = kv.slice(i + 1).trim();
      if (v) this.cookies.set(k, v);
      else this.cookies.delete(k);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const text = buf.toString('utf8');
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, text, body: buf, headers: res.headers };
  }

  get(path, opts) { return this.req('GET', path, undefined, opts); }
  post(path, body = {}, opts) { return this.req('POST', path, body, opts); }
}
