import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { Miniflare, createFetchMock } from 'miniflare';

const origin = 'https://receiver.test';
const callback = '/api/integrations/mercadolibre/oauth/callback';
const password = 'SYNTHETIC_ADMIN_KEY_FOR_TESTS_123456789';
const clientSecret = 'SYNTHETIC_CLIENT_SECRET_123456789';
const mock = createFetchMock();
mock.disableNetConnect();
let mf, db;
const calls = [];
const reads = [];
const tokens = overrides => ({ access_token: 'SYNTHETIC_ACCESS_TOKEN',
  refresh_token: 'SYNTHETIC_REFRESH_TOKEN', token_type: 'Bearer',
  expires_in: 21600, user_id: 123, ...overrides });
const cookieOf = response => (response.headers.get('set-cookie') || '').split(';')[0];
async function post(path, cookie = '', body = '', extra = {}) {
  const response = await mf.dispatchFetch(origin + path, {
    method: 'POST', redirect: 'manual',
    headers: { origin, cookie, 'content-type': 'application/x-www-form-urlencoded', ...extra },
    body,
  });
  await Promise.all(reads);
  return response;
}
async function login() {
  const response = await post('/connect', '', new URLSearchParams({ password }).toString());
  assert.equal(response.status, 303);
  return cookieOf(response);
}
async function start(admin = '') {
  const response = await post('/connect/start', admin || await login());
  assert.equal(response.status, 303);
  return { response, authorize: new URL(response.headers.get('location')),
    browser: cookieOf(response), admin };
}
function tokenReply(payload, status = 200, delay = 0) {
  const scope = mock.get('https://api.mercadolibre.com')
    .intercept({ method: 'POST', path: '/oauth/token' })
    .reply(options => {
      reads.push(new Response(options.body).text().then(body => {
        calls.push(new URLSearchParams(body));
      }));
      return { statusCode: status, data: JSON.stringify(payload),
        responseOptions: { headers: { 'content-type': 'application/json' } } };
    });
  if (delay) scope.delay(delay);
}
async function complete(flow, code = 'SYNTHETIC_AUTHORIZATION_CODE') {
  const response = await mf.dispatchFetch(origin + callback + '?code=' + code + '&state=' + flow.authorize.searchParams.get('state'), {
    redirect: 'manual', headers: { cookie: flow.browser },
  });
  await Promise.all(reads);
  return response;
}
before(async () => {
  mf = new Miniflare({ modules: true, scriptPath: resolve('dist/worker.js'),
    compatibilityDate: '2026-07-30',
    d1Databases: { NOTIFICATIONS_DB: 'oauth-test' }, fetchMock: mock,
    bindings: { PCC_ORIGIN: origin, ML_APPLICATION_ID: '2', ML_CLIENT_SECRET: clientSecret,
      PCC_ADMIN_KEY: password, ML_SELLER_ID: '123' },
  });
  await mf.dispatchFetch(origin + '/connect');
  db = await mf.getD1Database('NOTIFICATIONS_DB');
});
beforeEach(async () => {
  for (const name of ['pcc_admin_sessions', 'pcc_login_limits', 'pcc_oauth_flows', 'pcc_oauth_connection']) {
    await db.prepare('DELETE FROM ' + name).run();
  }
  calls.length = 0;
  reads.length = 0;
});
after(async () => { await mf.dispose(); await mock.close(); });

test('inicio y datos de conexión requieren sesión; solicitudes de otro origen se rechazan', async () => {
  assert.equal((await post('/connect/start')).status, 401);
  assert.equal((await post('/connect', '', new URLSearchParams({ password }).toString(),
    { origin: 'https://other.test' })).status, 403);
  const page = await mf.dispatchFetch(origin + '/connect');
  assert.equal(page.status, 200);
  assert.ok(!(await page.text()).includes(clientSecret));
  assert.equal(calls.length, 0);
});
test('contraseña errónea y diez intentos por ventana no crean sesión', async () => {
  for (let i = 0; i < 10; i++) assert.equal((await post('/connect', '', 'password=bad')).status, 401);
  assert.equal((await post('/connect', '', new URLSearchParams({ password }).toString())).status, 429);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM pcc_admin_sessions').first()).n, 0);
});
test('login limita el cuerpo por bytes aun cuando llega como stream sin Content-Length', async () => {
  const body = new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode('password=' + 'x'.repeat(5000)));
    controller.close();
  } });
  const response = await mf.dispatchFetch(origin + '/connect', { method: 'POST',
    headers: { origin, 'content-type': 'application/x-www-form-urlencoded' }, body, duplex: 'half' });
  assert.equal(response.status, 413);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM pcc_admin_sessions').first()).n, 0);
});
test('sesión de administración usa cookie segura y sólo guarda su hash', async () => {
  const response = await post('/connect', '', new URLSearchParams({ password }).toString());
  assert.equal(response.status, 303);
  const cookie = response.headers.get('set-cookie');
  for (const attr of ['Secure', 'HttpOnly', 'SameSite=Lax', 'Path=/']) assert.ok(cookie.includes(attr));
  const stored = JSON.stringify(await db.prepare('SELECT * FROM pcc_admin_sessions').all());
  assert.ok(!stored.includes(password));
  assert.ok(!stored.includes(cookieOf(response).split('=')[1]));
});
test('authorization solicita state y PKCE, con verifier cifrado y cookie de navegador', async () => {
  const flow = await start();
  assert.equal(flow.authorize.origin, 'https://auth.mercadolibre.com.ar');
  assert.equal(flow.authorize.pathname, '/authorization');
  assert.equal(flow.authorize.searchParams.get('client_id'), '2');
  assert.equal(flow.authorize.searchParams.get('redirect_uri'), origin + callback);
  assert.equal(flow.authorize.searchParams.get('code_challenge_method'), 'S256');
  assert.match(flow.authorize.searchParams.get('state'), /^[A-Za-z0-9_-]{43}$/);
  assert.match(flow.authorize.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);
  assert.ok(flow.response.headers.get('set-cookie').includes('SameSite=Lax'));
  const stored = JSON.stringify(await db.prepare('SELECT * FROM pcc_oauth_flows').all());
  assert.ok(!stored.includes(flow.authorize.searchParams.get('state')));
  assert.ok(!stored.includes(flow.browser.split('=')[1]));
});
test('otro navegador y una solicitud vencida no pueden canjear un código', async () => {
  const flow = await start();
  const wrong = await mf.dispatchFetch(origin + callback + '?code=SYNTHETIC_CODE&state=' + flow.authorize.searchParams.get('state'), {
    redirect: 'manual', headers: { cookie: '__Host-pcc_oauth=' + 'a'.repeat(43) },
  });
  assert.equal(wrong.headers.get('location'), '/connect?result=invalid_flow');
  await db.prepare('UPDATE pcc_oauth_flows SET expires = 1').run();
  assert.equal((await complete(flow)).headers.get('location'), '/connect?result=invalid_flow');
  assert.equal(calls.length, 0);
});
test('callback usa verifier correcto, persiste tokens cifrados y rechaza repetición del código', async () => {
  const admin = await login(), flow = await start(admin);
  tokenReply(tokens());
  const result = await complete(flow);
  assert.equal(result.status, 303);
  assert.equal(result.headers.get('location'), '/connect?result=connected');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].get('client_secret'), clientSecret);
  assert.equal(calls[0].get('grant_type'), 'authorization_code');
  assert.equal(calls[0].get('redirect_uri'), origin + callback);
  const verifier = calls[0].get('code_verifier');
  const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url');
  assert.equal(challenge, flow.authorize.searchParams.get('code_challenge'));
  const row = await db.prepare('SELECT * FROM pcc_oauth_connection').first();
  assert.equal(row.seller_id, '123');
  for (const secret of [tokens().access_token, tokens().refresh_token, clientSecret, password]) {
    assert.ok(!JSON.stringify(row).includes(secret));
  }
  assert.equal((await complete(flow)).headers.get('location'), '/connect?result=invalid_flow');
  assert.equal(calls.length, 1);
  const publicPage = await mf.dispatchFetch(origin + '/connect');
  assert.ok(!(await publicPage.text()).includes('Cuenta 123'));
  const owner = await mf.dispatchFetch(origin + '/connect', { headers: { cookie: admin } });
  const text = await owner.text();
  assert.ok(text.includes('Cuenta 123'));
  assert.ok(!text.includes(tokens().access_token));
});
test('cancelar no canjea el código y elimina parámetros sensibles de la dirección final', async () => {
  const flow = await start();
  const response = await mf.dispatchFetch(origin + callback + '?error=access_denied&error_description=SYNTHETIC_PRIVATE&state=' + flow.authorize.searchParams.get('state'), {
    redirect: 'manual', headers: { cookie: flow.browser },
  });
  assert.equal(response.headers.get('location'), '/connect?result=cancelled');
  assert.equal(await response.text(), '');
  assert.equal(calls.length, 0);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM pcc_oauth_connection').first()).n, 0);
});
test('un token de otro vendedor o una respuesta no válida nunca se persisten', async () => {
  for (const payload of [tokens({ user_id: 456 }), tokens({ expires_in: 0 })]) {
    const flow = await start();
    tokenReply(payload);
    assert.equal((await complete(flow)).headers.get('location'), '/connect?result=authorization_failed');
  }
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM pcc_oauth_connection').first()).n, 0);
});
test('renovaciones simultáneas canjean una sola vez el refresh token y actualizan la versión', async () => {
  const admin = await login(), flow = await start(admin);
  tokenReply(tokens());
  await complete(flow);
  tokenReply(tokens({ access_token: 'SYNTHETIC_FRESH_ACCESS', refresh_token: 'SYNTHETIC_FRESH_REFRESH' }), 200, 50);
  const results = await Promise.all([post('/connect/refresh', admin), post('/connect/refresh', admin)]);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].get('grant_type'), 'refresh_token');
  assert.equal(calls[1].get('refresh_token'), tokens().refresh_token);
  assert.equal(results.filter(r => r.headers.get('location') === '/connect?result=refreshed').length, 1);
  const row = await db.prepare('SELECT * FROM pcc_oauth_connection').first();
  assert.equal(row.version, 2);
  assert.equal(row.refresh_status, 'idle');
  assert.ok(!row.tokens.includes('SYNTHETIC_FRESH_REFRESH'));
});
test('un refresh incierto queda bloqueado y no se vuelve a canjear automáticamente', async () => {
  const admin = await login(), flow = await start(admin);
  tokenReply(tokens());
  await complete(flow);
  tokenReply({ error: 'invalid_grant', private_field: 'SYNTHETIC_PRIVATE' }, 400);
  assert.equal((await post('/connect/refresh', admin)).headers.get('location'), '/connect?result=reconnect_required');
  assert.equal((await post('/connect/refresh', admin)).headers.get('location'), '/connect?result=reconnect_required');
  assert.equal(calls.length, 2);
  assert.equal((await db.prepare('SELECT refresh_status FROM pcc_oauth_connection').first()).refresh_status, 'uncertain');
});
test('cerrar sesión invalida el acceso del navegador', async () => {
  const admin = await login();
  assert.equal((await post('/connect/logout', admin)).status, 303);
  assert.equal((await post('/connect/start', admin)).status, 401);
});
test('el cron renueva sólo cuando la credencial está por vencer', async () => {
  const flow = await start();
  tokenReply(tokens({ expires_in: 60 }));
  await complete(flow);
  tokenReply(tokens({ access_token: 'SYNTHETIC_CRON_ACCESS', refresh_token: 'SYNTHETIC_CRON_REFRESH' }));
  const worker = await mf.getWorker();
  await worker.scheduled({ cron: '*/15 * * * *', scheduledTime: Date.now() });
  await Promise.all(reads);
  assert.equal(calls.length, 2);
  assert.equal((await db.prepare('SELECT version FROM pcc_oauth_connection').first()).version, 2);
  await worker.scheduled({ cron: '*/15 * * * *', scheduledTime: Date.now() });
  assert.equal(calls.length, 2);
});
test('un redirect del endpoint de tokens nunca reenvía credenciales a otro dominio', async () => {
  const flow = await start();
  let foreignCalls = 0;
  mock.get('https://foreign.test').intercept({ method: 'POST', path: '/collect' })
    .reply(() => { foreignCalls++; return { statusCode: 200, data: JSON.stringify(tokens()) }; });
  mock.get('https://api.mercadolibre.com').intercept({ method: 'POST', path: '/oauth/token' })
    .reply(307, '', { headers: { location: 'https://foreign.test/collect' } });
  assert.equal((await complete(flow)).headers.get('location'), '/connect?result=authorization_failed');
  assert.equal(foreignCalls, 0);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM pcc_oauth_connection').first()).n, 0);
});
