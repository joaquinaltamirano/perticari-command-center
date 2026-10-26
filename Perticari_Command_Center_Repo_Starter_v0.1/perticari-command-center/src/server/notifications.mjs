import { handleOAuth, scheduledOAuth } from './oauth.mjs';
// Recepción durable y autorización OAuth. Las operaciones comerciales están pendientes.
// Campos basados en el ejemplo del PDF; el contrato oficial debe verificarse.
const NOTIFICATION_PATH = '/api/integrations/mercadolibre/notifications';
const MAX_BODY_BYTES = 16384;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

class InputError extends Error {
  constructor(code, status = 400) { super(code); this.status = status; }
}

async function readJson(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
    throw new InputError('body_too_large', 413);
  }
  if (!request.body) throw new InputError('invalid_json');
  const reader = request.body.getReader();
  const parts = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new InputError('body_too_large', 413);
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const value of parts) { bytes.set(value, offset); offset += value.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new InputError('invalid_json'); }
}

function identifier(value) {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0)) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value);
  return /^[1-9][0-9]{0,24}$/.test(text) ? text : null;
}

function envelope(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new InputError('invalid_envelope');
  const { topic, resource } = data;
  if (typeof topic !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(topic)) {
    throw new InputError('invalid_topic');
  }
  if (typeof resource !== 'string' || resource.length > 2048 ||
      !resource.startsWith('/') || resource.startsWith('//') ||
      /[\\\x00-\x20?#]/.test(resource) || resource.includes('://') ||
      resource.split('/').some(part => part === '..' || part === '.')) {
    throw new InputError('invalid_resource');
  }
  const applicationId = identifier(data.application_id);
  const sellerId = identifier(data.user_id);
  if (!applicationId || !sellerId) throw new InputError('invalid_identity_fields');
  let eventId = null;
  if (data._id !== undefined && data._id !== null) {
    if (typeof data._id !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(data._id)) {
      throw new InputError('invalid_event_id');
    }
    eventId = data._id;
  }
  let sent = null;
  if (data.sent !== undefined && data.sent !== null) {
    if (typeof data.sent !== 'string' || data.sent.length > 64 || !Number.isFinite(Date.parse(data.sent))) {
      throw new InputError('invalid_sent');
    }
    sent = new Date(data.sent).toISOString();
  }
  // No copiar texto de compradores, tokens o campos adicionales al almacenamiento.
  return { topic, resource, applicationId, sellerId, eventId, sent };
}

async function keyFor(event) {
  // Un recurso puede cambiar varias veces: no deduplicar para siempre por resource.
  const discriminator = event.eventId ? ['id', event.eventId] : event.sent
    ? ['sent', event.topic, event.resource, event.sent] : ['receipt', crypto.randomUUID()];
  const value = JSON.stringify([event.applicationId, event.sellerId, ...discriminator]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(scheduledOAuth(env));
  },
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    try {
      const oauth = await handleOAuth(request, env);
      if (oauth) return oauth;
    } catch {
      if (path === '/api/integrations/mercadolibre/oauth/callback') {
        return new Response(null, { status: 303, headers: {
          location: '/connect?result=authorization_failed',
          'cache-control': 'no-store', 'referrer-policy': 'no-referrer',
        } });
      }
      return new Response('No se pudo completar la solicitud. Volvé a /connect.', {
        status: 503, headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
      });
    }
    if (path !== NOTIFICATION_PATH && path !== '/health') return json({ error: 'not_found' }, 404);
    if (request.method === 'GET') {
      try {
        if (!env.NOTIFICATIONS_DB) throw new Error('no_database');
        await env.NOTIFICATIONS_DB.prepare('SELECT id FROM pcc_notifications LIMIT 1').first();
        return json({ receiver: 'ready', processing: 'asynchronous', version: '2.0.0' });
      } catch { return json({ error: 'storage_unavailable' }, 503); }
    }
    if (path === '/health' || request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    let event;
    try { event = envelope(await readJson(request)); }
    catch (error) {
      return json({ error: error instanceof InputError ? error.message : 'invalid_request' },
                  error instanceof InputError ? error.status : 400);
    }
    if ((env.ML_APPLICATION_ID && String(env.ML_APPLICATION_ID) !== event.applicationId) ||
        (env.ML_SELLER_ID && String(env.ML_SELLER_ID) !== event.sellerId)) {
      return json({ error: 'unexpected_account' }, 403);
    }
    try {
      if (!env.NOTIFICATIONS_DB) throw new Error('no_database');
      const eventKey = await keyFor(event);
      const now = new Date().toISOString();
      await env.NOTIFICATIONS_DB.prepare(`
        INSERT INTO pcc_notifications
          (event_key, event_id, topic, resource, application_id, seller_id, sent, first_received, last_received)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(event_key) DO UPDATE SET
          deliveries = pcc_notifications.deliveries + 1,
          last_received = excluded.last_received
      `).bind(eventKey, event.eventId, event.topic, event.resource, event.applicationId,
              event.sellerId, event.sent, now, now).run();
      // No devolver éxito hasta que el almacenamiento durable haya confirmado.
      return json({ received: true });
    } catch {
      console.error('notification_persistence_failed');
      return json({ error: 'storage_unavailable' }, 503);
    }
  },
};
