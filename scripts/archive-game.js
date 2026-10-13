// Archiva la partida activa SIN borrar datos (queda para auditoría).
// Úselo solo si el servidor no arranca porque el contenido cambió a mitad de partida.
// Uso: npm run archivar-partida -- --modo=demo|real --confirmar
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../src/config.js';
import { openDatabase } from '../src/store/db.js';

if (existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));
const modeArg = process.argv.find((a) => a.startsWith('--modo='));
const mode = modeArg?.slice('--modo='.length);
if (mode !== 'demo' && mode !== 'real') {
  console.error('Indique el modo: --modo=demo o --modo=real');
  process.exit(1);
}
if (!process.argv.includes('--confirmar')) {
  console.error('Esta acción archiva la partida activa (los equipos necesitarán códigos nuevos). Repita el comando con --confirmar.');
  process.exit(1);
}
const dbFile = path.join(path.resolve(ROOT, process.env.DATA_DIR || 'data'), `tribunal-${mode}.sqlite`);
if (!existsSync(dbFile)) {
  console.log(`No existe la base de datos ${dbFile}: no hay nada que archivar.`);
  process.exit(0);
}
const db = openDatabase(dbFile);
const g = db.prepare('SELECT id FROM games WHERE active = 1').get();
if (!g) {
  console.log('No hay partida activa.');
} else {
  const at = new Date().toISOString();
  db.prepare('UPDATE games SET active = 0, archived_at = ? WHERE id = ?').run(at, g.id);
  db.prepare('INSERT INTO audit_log (game_id, at, actor, event, detail) VALUES (?, ?, ?, ?, ?)').run(g.id, at, 'consola', 'game_archived', JSON.stringify({ reason: 'archive-script' }));
  console.log(`Partida ${g.id} archivada. Al arrancar el servidor, cree una partida nueva desde el panel.`);
}
db.close();
