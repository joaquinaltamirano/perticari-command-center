import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { Miniflare } from 'miniflare';

const path = '/api/integrations/mercadolibre/notifications';
const url = `https://receiver.test${path}`;
const schema = await readFile(resolve('migrations/0001_notifications.sql'), 'utf8');
async function migrate(database) {
  await database.batch(schema.split(';').map(s => s.trim()).filter(Boolean).map(s => database.prepare(s)));
}
let mf, db;
function instance(options = {}) {
  return new Miniflare({
    modules: true,
    scriptPath: resolve('dist/worker.js'),
    compatibilityDate: '2026-07-30',
    d1Databases: { NOTIFICATIONS_DB: 'test-notifications' },
    bindings: { ML_APPLICATION_ID: '2', ML_SELLER_ID: '1' },
    ...options,
  });
}
const event = overrides => ({ _id: 'synthetic-event-1', topic: 'questions', resource: '/questions/123',
  user_id: 1, application_id: 2, sent: '2026-10-13T14:25:00.000Z', attempts: 1, ...overrides });
const send = (body, target = mf) => target.dispatchFetch(url, { method: 'POST',
  headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
before(async () => { mf = instance(); db = await mf.getD1Database('NOTIFICATIONS_DB'); await migrate(db); });
beforeEach(async () => { await db.prepare('DELETE FROM pcc_notifications').run(); });
after(async () => { await mf.dispose(); });

test('persiste el evento antes de responder 200 y lo deja pendiente de verificación', async () => {
  const response = await send(event());
  assert.equal(response.status, 200);
  const saved = await db.prepare('SELECT * FROM pcc_notifications').first();
  assert.equal(saved.resource, '/questions/123');
  assert.equal(saved.status, 'pending');
  assert.equal(saved.verification_status, 'unverified');
});
test('tres entregas del mismo evento producen una fila y tres entregas registradas', async () => {
  for (let i = 1; i <= 3; i++) assert.equal((await send(event({ attempts: i }))).status, 200);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM pcc_notifications').first()).n, 1);
  assert.equal((await db.prepare('SELECT deliveries FROM pcc_notifications').first()).deliveries, 3);
});
test('otra actualización del mismo recurso permanece como evento independiente', async () => {
  await send(event()); await send(event({ _id: 'synthetic-event-2', sent: '2026-10-13T14:30:00Z' }));
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM pcc_notifications').first()).n, 2);
});
test('sin ID deduplica por envío, sin suprimir envíos posteriores del mismo recurso', async () => {
  await send(event({ _id: undefined })); await send(event({ _id: undefined, attempts: 2 }));
  await send(event({ _id: undefined, sent: '2026-10-13T15:25:00Z' }));
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM pcc_notifications').first()).n, 2);
});
test('sin ID ni fecha preserva recepciones sin inventar una clave remota estable', async () => {
  await send(event({ _id: undefined, sent: undefined })); await send(event({ _id: undefined, sent: undefined }));
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM pcc_notifications').first()).n, 2);
});
test('no almacena secretos ni texto de compradores de campos adicionales', async () => {
  await send(event({ access_token: 'SYNTHETIC_SECRET', text: 'SYNTHETIC_BUYER_TEXT' }));
  const saved = JSON.stringify(await db.prepare('SELECT * FROM pcc_notifications').first());
  assert.ok(!saved.includes('SYNTHETIC_SECRET')); assert.ok(!saved.includes('SYNTHETIC_BUYER_TEXT'));
});
test('rechaza otra aplicación o vendedor cuando están configurados', async () => {
  assert.equal((await send(event({ application_id: 3 }))).status, 403);
  assert.equal((await send(event({ user_id: 4 }))).status, 403);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM pcc_notifications').first()).n, 0);
});
test('rechaza JSON inválido, recursos externos y sobres de evento inválidos', async () => {
  const broken = await mf.dispatchFetch(url, { method: 'POST', body: '{invalid' });
  assert.equal(broken.status, 400);
  for (const resource of ['https://example.com/token', '//example.com/path', '/items/../secret', '/items/1?access_token=x']) {
    assert.equal((await send(event({ resource }))).status, 400);
  }
  assert.equal((await send([])).status, 400);
});
test('rechaza cuerpos grandes incluso sin Content-Length', async () => {
  assert.equal((await send(event({ extra: 'x'.repeat(20000) }))).status, 413);
});
test('salud comprueba D1 y no expone registros en rutas públicas', async () => {
  await send(event());
  const health = await mf.dispatchFetch('https://receiver.test/health');
  assert.equal(health.status, 200);
  assert.equal((await health.json()).processing, 'asynchronous');
  assert.equal((await mf.dispatchFetch('https://receiver.test/notifications')).status, 404);
  assert.equal((await mf.dispatchFetch(url, { method: 'DELETE' })).status, 405);
});
test('un fallo de almacenamiento responde 503 para permitir reentrega', async () => {
  const broken = instance({ d1Databases: {} });
  try { assert.equal((await send(event(), broken)).status, 503); }
  finally { await broken.dispose(); }
});
test('salud no declara listo un D1 que todavía no tiene la tabla de notificaciones', async () => {
  const empty = instance();
  try {
    const health = await empty.dispatchFetch('https://receiver.test/health');
    assert.equal(health.status, 503);
    assert.deepEqual(await health.json(), { error: 'storage_unavailable' });
  } finally { await empty.dispose(); }
});
test('retorno sin credenciales explica que la configuración sigue pendiente', async () => {
  const response = await mf.dispatchFetch('https://receiver.test/api/integrations/mercadolibre/oauth/callback');
  assert.equal(response.status, 503);
  assert.match(await response.text(), /Falta configurar ML_APPLICATION_ID/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin');
});
test('retorno elimina códigos, estado y errores de la dirección sin reflejarlos ni persistirlos', async () => {
  const callback = '/api/integrations/mercadolibre/oauth/callback';
  for (const query of ['?code=SYNTHETIC_CODE&state=SYNTHETIC_STATE', '?error=access_denied&error_description=SYNTHETIC_PRIVATE_TEXT']) {
    const response = await mf.dispatchFetch(`https://receiver.test${callback}${query}`, { redirect: 'manual' });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), '/connect?result=configuration_pending');
    assert.equal(await response.text(), '');
    assert.match(response.headers.get('set-cookie'), /^__Host-pcc_oauth=;.*Max-Age=0$/);
  }
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM pcc_notifications').first()).n, 0);
});
test('retorno no se declara disponible para autorización sin configurar credenciales', async () => {
  const callback = 'https://receiver.test/api/integrations/mercadolibre/oauth/callback';
  const head = await mf.dispatchFetch(callback, { method: 'HEAD' });
  assert.equal(head.status, 503);
  assert.equal(await head.text(), '');
  for (const method of ['POST', 'PUT', 'DELETE']) {
    assert.equal((await mf.dispatchFetch(callback, { method })).status, 503);
  }
});
test('el evento sobrevive al cierre y reinicio del runtime con el mismo D1 persistente', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pcc-notification-persistence-'));
  let local = instance({ d1Persist: dir });
  try {
    await migrate(await local.getD1Database('NOTIFICATIONS_DB'));
    await send(event(), local);
    await local.dispose();
    local = instance({ d1Persist: dir });
    await send(event({ attempts: 2 }), local);
    const row = await (await local.getD1Database('NOTIFICATIONS_DB')).prepare('SELECT COUNT(*) AS n, MAX(deliveries) AS deliveries FROM pcc_notifications').first();
    assert.equal(row.n, 1); assert.equal(row.deliveries, 2);
  } finally { await local.dispose(); await rm(dir, { recursive: true, force: true }); }
});
