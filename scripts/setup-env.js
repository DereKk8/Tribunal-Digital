// Crea .env a partir de .env.example con una contraseña de moderación aleatoria.
// No sobrescribe un .env existente. Uso: npm run configurar [-- --modo=real]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { ROOT } from '../src/config.js';

const envPath = path.join(ROOT, '.env');
if (existsSync(envPath)) {
  console.log('Ya existe .env; no se modifica. Edítelo a mano si necesita cambiar algo.');
  process.exit(0);
}
const modeArg = process.argv.find((a) => a.startsWith('--modo='));
const mode = modeArg ? modeArg.slice('--modo='.length) : 'demo';
if (mode !== 'demo' && mode !== 'real') {
  console.error('Modo inválido. Use --modo=demo o --modo=real.');
  process.exit(1);
}
// Contraseña legible (sin caracteres ambiguos) de 16 caracteres.
const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const bytes = randomBytes(16);
const password = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
const template = readFileSync(path.join(ROOT, '.env.example'), 'utf8')
  .replace(/^CONTENT_MODE=.*$/m, `CONTENT_MODE=${mode}`)
  .replace(/^MODERATOR_PASSWORD=.*$/m, `MODERATOR_PASSWORD=${password}`);
writeFileSync(envPath, template, { mode: 0o600 });
console.log(`Creado .env (modo ${mode}).`);
console.log(`Contraseña de moderación: ${password}`);
console.log('Guárdela: se pide al abrir /moderador. El archivo .env está ignorado por Git.');
