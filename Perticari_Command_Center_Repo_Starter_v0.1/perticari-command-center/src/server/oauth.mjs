const CALLBACK = '/api/integrations/mercadolibre/oauth/callback';
const BASE = 'https://perticari-notificaiones.perticari-sa.workers.dev';
const encoder = new TextEncoder();
const security = {
  'cache-control': 'no-store',
  'referrer-policy': 'strict-origin',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://auth.mercadolibre.com.ar https://www.mercadolibre.com.ar https://www.mercadolibre.com; frame-ancestors 'none'; base-uri 'none'",
};
const tables = [
  'CREATE TABLE IF NOT EXISTS pcc_admin_sessions (session_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS pcc_login_limits (key_hash TEXT PRIMARY KEY, window INTEGER NOT NULL, attempts INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS pcc_oauth_flows (state_hash TEXT PRIMARY KEY, browser_hash TEXT NOT NULL, verifier TEXT NOT NULL, expires INTEGER NOT NULL, status TEXT NOT NULL, expected_version INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS pcc_oauth_connection (id INTEGER PRIMARY KEY CHECK(id = 1), application_id TEXT NOT NULL, seller_id TEXT NOT NULL, tokens TEXT NOT NULL, expires INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1, refresh_status TEXT NOT NULL DEFAULT \'idle\', updated INTEGER NOT NULL)',
];
let initialized;
async function storage(env) {
  if (!env.NOTIFICATIONS_DB) throw new Error('storage_unavailable');
  if (initialized !== env.NOTIFICATIONS_DB) {
    await env.NOTIFICATIONS_DB.batch(tables.map(sql => env.NOTIFICATIONS_DB.prepare(sql)));
    initialized = env.NOTIFICATIONS_DB;
  }
  return env.NOTIFICATIONS_DB;
}
function config(env) {
  const origin = env.PCC_ORIGIN || BASE;
  if (!/^[1-9][0-9]{0,24}$/.test(String(env.ML_APPLICATION_ID || '')) ||
      typeof env.ML_CLIENT_SECRET !== 'string' || env.ML_CLIENT_SECRET.length < 16 ||
      typeof env.PCC_ADMIN_KEY !== 'string' || env.PCC_ADMIN_KEY.length < 24 ||
      new URL(origin).origin !== origin || !origin.startsWith('https://')) {
    throw new Error('configuration_pending');
  }
  return { origin, application: String(env.ML_APPLICATION_ID), secret: env.ML_CLIENT_SECRET,
    admin: env.PCC_ADMIN_KEY, redirect: origin + CALLBACK };
}
function b64(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64(value) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}
const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
async function hash(value) {
  return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}
async function key(c) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(c.admin), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256',
    salt: encoder.encode(c.origin + ':' + c.application),
    info: encoder.encode('perticari-oauth-storage-v1') },
  material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(data, c) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(c),
    encoder.encode(JSON.stringify(data)));
  return b64(iv) + '.' + b64(new Uint8Array(bytes));
}
async function open(value, c) {
  const [iv, bytes] = value.split('.');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await key(c), unb64(bytes));
  return JSON.parse(new TextDecoder().decode(plain));
}
function cookie(request, name) {
  const items = (request.headers.get('cookie') || '').split(';').map(s => s.trim());
  const item = items.find(s => s.startsWith(name + '='));
  return item ? item.slice(name.length + 1) : '';
}
function setCookie(name, value, seconds, sameSite) {
  return name + '=' + value + '; Path=/; Secure; HttpOnly; SameSite=' + sameSite + '; Max-Age=' + seconds;
}
function redirect(location, cookieHeader) {
  const headers = { ...security, location };
  if (cookieHeader) headers['set-cookie'] = cookieHeader;
  return new Response(null, { status: 303, headers });
}
function escape(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function page(message, body = '', status = 200) {
  return new Response('<!doctype html><html lang="es"><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Perticari — Mercado Libre</title><style>body{font:17px system-ui;max-width:680px;margin:60px auto;padding:24px;line-height:1.6}input,button{font:inherit;padding:12px;margin:8px 0}button{cursor:pointer}small{color:#555}</style>'
    + '<h1>Perticari Command Center</h1><p>' + escape(message) + '</p>' + body + '</html>',
  { status, headers: { ...security, 'content-type': 'text/html; charset=utf-8' } });
}
function sameOrigin(request, c) {
  return request.headers.get('origin') === c.origin && new URL(request.url).origin === c.origin;
}
async function loginForm(request) {
  if (Number(request.headers.get('content-length')) > 4096) return null;
  if (!request.body) return new URLSearchParams();
  const reader = request.body.getReader(), decoder = new TextDecoder();
  let length = 0, text = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 4096) { await reader.cancel(); return null; }
    text += decoder.decode(value, { stream: true });
  }
  return new URLSearchParams(text + decoder.decode());
}
async function authenticated(request, db, c) {
  const value = cookie(request, '__Host-pcc_admin');
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  return db.prepare('SELECT session_hash FROM pcc_admin_sessions WHERE session_hash = ? AND expires > ?')
    .bind(await hash(c.admin + ':' + c.application + ':' + value), Date.now()).first();
}
async function connection(db) {
  return db.prepare('SELECT * FROM pcc_oauth_connection WHERE id = 1').first();
}
function validateTokens(data, c, expectedSeller) {
  if (!data || typeof data.access_token !== 'string' || data.access_token.length < 8 ||
      data.access_token.length > 8192 || typeof data.refresh_token !== 'string' ||
      data.refresh_token.length < 8 || data.refresh_token.length > 8192 ||
      !Number.isFinite(data.expires_in) || data.expires_in <= 0 || data.expires_in > 2592000 ||
      (typeof data.user_id === 'number' && !Number.isSafeInteger(data.user_id)) ||
      !/^[1-9][0-9]{0,24}$/.test(String(data.user_id || '')) ||
      String(data.token_type || '').toLowerCase() !== 'bearer' ||
      (expectedSeller && String(data.user_id) !== String(expectedSeller))) {
    throw new Error('invalid_token_response');
  }
  return { access_token: data.access_token, refresh_token: data.refresh_token,
    seller_id: String(data.user_id), application_id: c.application,
    expires: Date.now() + Math.floor(data.expires_in * 1000) };
}
async function grant(c, fields, expectedSeller) {
  const response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(15000),
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ client_id: c.application, client_secret: c.secret, ...fields }).toString(),
  });
  if (!response.ok) throw new Error('authorization_failed');
  return validateTokens(await response.json(), c, expectedSeller);
}
async function refresh(env, force = false) {
  const c = config(env), db = await storage(env), current = await connection(db);
  if (!current || current.application_id !== c.application) return 'not_connected';
  if (!force && current.expires > Date.now() + 20 * 60000) return 'still_valid';
  const locked = await db.prepare("UPDATE pcc_oauth_connection SET refresh_status = 'refreshing', updated = ? WHERE id = 1 AND version = ? AND refresh_status = 'idle'")
    .bind(Date.now(), current.version).run();
  if (locked.meta.changes !== 1) return 'reconnect_required';
  try {
    const previous = await open(current.tokens, c);
    const fresh = await grant(c, { grant_type: 'refresh_token', refresh_token: previous.refresh_token }, current.seller_id);
    const saved = await db.prepare("UPDATE pcc_oauth_connection SET tokens = ?, expires = ?, version = version + 1, refresh_status = 'idle', updated = ? WHERE id = 1 AND version = ? AND refresh_status = 'refreshing'")
      .bind(await seal(fresh, c), fresh.expires, Date.now(), current.version).run();
    if (saved.meta.changes !== 1) throw new Error('refresh_conflict');
    return 'refreshed';
  } catch {
    // No repetir automáticamente un refresh de resultado incierto.
    await db.prepare("UPDATE pcc_oauth_connection SET refresh_status = 'uncertain' WHERE id = 1 AND version = ? AND refresh_status = 'refreshing'")
      .bind(current.version).run();
    return 'reconnect_required';
  }
}
export async function scheduledOAuth(env) {
  try { await refresh(env); } catch { /* Sin códigos, tokens ni errores del proveedor en logs. */ }
}
export async function handleOAuth(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if (path !== CALLBACK && path !== '/connect' && !['/connect/start', '/connect/refresh', '/connect/logout'].includes(path)) return null;
  const clearFlow = setCookie('__Host-pcc_oauth', '', 0, 'Lax');
  let c, db;
  try { c = config(env); db = await storage(env); }
  catch {
    if (path === CALLBACK && url.search) return redirect('/connect?result=configuration_pending', clearFlow);
    return page('La dirección está preparada. Falta configurar ML_APPLICATION_ID, ML_CLIENT_SECRET y PCC_ADMIN_KEY en Cloudflare para conectar la cuenta.', '', 503);
  }
  if (url.origin !== c.origin) return page('Dirección no válida.', '', 400);
  if (path === CALLBACK) {
    if (request.method !== 'GET') return page('Método no permitido.', '', 405);
    if (!url.search) return page('Dirección de retorno preparada. Iniciá la conexión desde /connect.');
    const state = url.searchParams.get('state'), browser = cookie(request, '__Host-pcc_oauth');
    if (url.searchParams.getAll('state').length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(state || '') ||
        !/^[A-Za-z0-9_-]{43}$/.test(browser)) return redirect('/connect?result=invalid_flow', clearFlow);
    const flow = await db.prepare('SELECT * FROM pcc_oauth_flows WHERE state_hash = ? AND browser_hash = ? AND expires > ? AND status = ?')
      .bind(await hash(state), await hash(browser), Date.now(), 'pending').first();
    if (!flow) return redirect('/connect?result=invalid_flow', clearFlow);
    const denied = url.searchParams.has('error');
    const code = url.searchParams.get('code');
    if (!denied && (url.searchParams.getAll('code').length !== 1 || !code || code.length > 2048 || /[\x00-\x20]/.test(code))) {
      return redirect('/connect?result=invalid_flow', clearFlow);
    }
    const claimed = await db.prepare("UPDATE pcc_oauth_flows SET status = ? WHERE state_hash = ? AND browser_hash = ? AND expires > ? AND status = 'pending'")
      .bind(denied ? 'denied' : 'exchanging', await hash(state), await hash(browser), Date.now()).run();
    if (claimed.meta.changes !== 1) return redirect('/connect?result=invalid_flow', clearFlow);
    if (denied) return redirect('/connect?result=cancelled', clearFlow);
    try {
      const verifier = await open(flow.verifier, c);
      const existing = await connection(db);
      const tokens = await grant(c, { grant_type: 'authorization_code', code,
        redirect_uri: c.redirect, code_verifier: verifier }, env.ML_SELLER_ID || existing?.seller_id);
      const encrypted = await seal(tokens, c);
      const saved = flow.expected_version === 0
        ? await db.prepare('INSERT OR IGNORE INTO pcc_oauth_connection (id, application_id, seller_id, tokens, expires, updated) VALUES (1, ?, ?, ?, ?, ?)')
          .bind(c.application, tokens.seller_id, encrypted, tokens.expires, Date.now()).run()
        : await db.prepare("UPDATE pcc_oauth_connection SET application_id = ?, seller_id = ?, tokens = ?, expires = ?, version = version + 1, refresh_status = 'idle', updated = ? WHERE id = 1 AND version = ? AND seller_id = ?")
          .bind(c.application, tokens.seller_id, encrypted, tokens.expires, Date.now(), flow.expected_version, tokens.seller_id).run();
      if (saved.meta.changes !== 1) throw new Error('connection_conflict');
      await db.prepare("UPDATE pcc_oauth_flows SET status = 'complete', verifier = '' WHERE state_hash = ?").bind(await hash(state)).run();
      return redirect('/connect?result=connected', clearFlow);
    } catch {
      await db.prepare("UPDATE pcc_oauth_flows SET status = 'uncertain', verifier = '' WHERE state_hash = ?").bind(await hash(state)).run();
      return redirect('/connect?result=authorization_failed', clearFlow);
    }
  }
  if (path === '/connect' && request.method === 'GET') {
    const session = await authenticated(request, db, c);
    if (!session) return page('Ingresá tu contraseña de Perticari para administrar la conexión.',
      '<form method="post" action="/connect"><label>Contraseña de Perticari<br><input type="password" name="password" minlength="24" maxlength="256" autocomplete="current-password" required></label><br><button>Ingresar</button></form>');
    const current = await connection(db);
    const notices = { connected: 'Cuenta conectada.', cancelled: 'Autorización cancelada.',
      invalid_flow: 'La solicitud venció o no corresponde a este navegador. Iniciá una nueva conexión.',
      authorization_failed: 'La autorización no pudo completarse. Revisá la configuración y volvé a conectar.',
      refreshed: 'Autorización renovada.', reconnect_required: 'Es necesario volver a conectar la cuenta.' };
    const status = current ? 'Cuenta ' + current.seller_id + ' conectada. Credencial de acceso vence ' + new Date(current.expires).toISOString() + '.' : 'La cuenta todavía no está conectada.';
    return page((notices[url.searchParams.get('result')] || '') + ' ' + status,
      '<form method="post" action="/connect/start"><button>' + (current ? 'Volver a autorizar Mercado Libre' : 'Conectar Mercado Libre') + '</button></form>'
      + (current ? '<form method="post" action="/connect/refresh"><button>Renovar autorización</button></form>' : '')
      + '<form method="post" action="/connect/logout"><button>Salir</button></form>'
      + '<small>Las publicaciones, precios, stock y mensajes se habilitarán desde el sistema con sus aprobaciones.</small>');
  }
  if (request.method !== 'POST') return page('Método no permitido.', '', 405);
  if (!sameOrigin(request, c)) return page('Solicitud no válida.', '', 403);
  if (path === '/connect') {
    const limitKey = await hash(c.admin + ':' + (request.headers.get('cf-connecting-ip') || 'unknown'));
    const window = Math.floor(Date.now() / 600000);
    await db.prepare('INSERT INTO pcc_login_limits (key_hash, window, attempts) VALUES (?, ?, 1) ON CONFLICT(key_hash) DO UPDATE SET attempts = CASE WHEN window = excluded.window THEN attempts + 1 ELSE 1 END, window = excluded.window')
      .bind(limitKey, window).run();
    const rate = await db.prepare('SELECT attempts FROM pcc_login_limits WHERE key_hash = ?').bind(limitKey).first();
    if (rate.attempts > 10) return page('Esperá unos minutos antes de volver a ingresar.', '', 429);
    const data = await loginForm(request);
    if (!data) return page('Solicitud demasiado grande.', '', 413);
    const password = data.get('password') || '';
    const supplied = await hash(password), expected = await hash(c.admin);
    let difference = 0;
    for (let i = 0; i < expected.length; i++) difference |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
    if (difference !== 0 || data.getAll('password').length !== 1) return page('Contraseña incorrecta.', '', 401);
    const session = random();
    await db.prepare('INSERT INTO pcc_admin_sessions (session_hash, expires) VALUES (?, ?)').bind(await hash(c.admin + ':' + c.application + ':' + session), Date.now() + 8 * 3600000).run();
    return redirect('/connect', setCookie('__Host-pcc_admin', session, 8 * 3600, 'Lax'));
  }
  const session = await authenticated(request, db, c);
  if (!session) return page('Ingresá para administrar la conexión.', '', 401);
  if (path === '/connect/logout') {
    await db.prepare('DELETE FROM pcc_admin_sessions WHERE session_hash = ?').bind(session.session_hash).run();
    return redirect('/connect', setCookie('__Host-pcc_admin', '', 0, 'Lax'));
  }
  if (path === '/connect/refresh') return redirect('/connect?result=' + await refresh(env, true));
  const state = random(), browser = random(), verifier = random(), current = await connection(db);
  await db.batch([
    db.prepare('DELETE FROM pcc_oauth_flows WHERE expires < ?').bind(Date.now()),
    db.prepare('DELETE FROM pcc_admin_sessions WHERE expires < ?').bind(Date.now()),
    db.prepare('DELETE FROM pcc_login_limits WHERE window < ?').bind(Math.floor(Date.now() / 600000) - 1),
    db.prepare('INSERT INTO pcc_oauth_flows (state_hash, browser_hash, verifier, expires, status, expected_version) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(await hash(state), await hash(browser), await seal(verifier, c), Date.now() + 600000, 'pending', current?.version || 0),
  ]);
  const authorize = new URL('https://auth.mercadolibre.com.ar/authorization');
  for (const [name, value] of Object.entries({ response_type: 'code', client_id: c.application,
    redirect_uri: c.redirect, state, code_challenge: await hash(verifier), code_challenge_method: 'S256' })) authorize.searchParams.set(name, value);
  return redirect(authorize.href, setCookie('__Host-pcc_oauth', browser, 600, 'Lax'));
}

// Shared only with authenticated server modules. These helpers are never bundled for the browser.
export { config as oauthConfig, storage as oauthStorage, authenticated as adminSession,
  seal as encryptValue, open as decryptValue, hash as digest, connection as oauthConnection,
  refresh as refreshOAuth };
