const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const express = require('express');
const cookieParser = require('cookie-parser');
const { signUserToken } = require('./userAuth.cjs');
const { assertJobAvailable, installJailGuard, isJobMutation, jailStatus } = require('./jail.cjs');

test('global jail guard is mounted before platform gang routes and other job routes', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../server.cjs'), 'utf8');
  assert.ok(source.indexOf('installJailGuard(app, pool);') < source.indexOf('installPlatformSystems(app, express);'));
  assert.ok(source.indexOf('installPlatformSystems(app, express);') < source.indexOf("app.post('/api/pizzer/delivery/handover'"));
});

test('job guard covers reward and progression routes but permits reads and session cleanup', () => {
  for (const path of [
    '/api/pizzer/delivery/handover', '/api/fisher/dock/select', '/api/fisher/land',
    '/api/fisher/catch/sell', '/api/pilot/flight/complete', '/api/cayo/convert',
    '/api/sleep/claim', '/api/gangs/work', '/api/gangs/process', '/api/gangs/sell',
    '/api/gangs/battle', '/api/gangs/funds/launder',
  ]) assert.equal(isJobMutation('POST', path), true, path);
  for (const path of [
    '/api/pizzer/shift/end', '/api/fisher/shift/end', '/api/pilot/shift/end',
    '/api/pilot/flight/cancel', '/api/gangs/funds/transfer', '/api/market/buy',
  ]) assert.equal(isJobMutation('POST', path), false, path);
  assert.equal(isJobMutation('GET', '/api/fisher/state'), false);
  assert.equal(isJobMutation('GET', '/api/jail/state'), false);
  assert.equal(isJobMutation('POST', '/api/pizzer-fake/delivery/handover'), false);
});

test('expired jail is cleared in the response without removing its database history', () => {
  const now = Date.parse('2026-09-25T12:00:00Z');
  assert.equal(jailStatus({ jailed_until: new Date(now - 1), jail_reason: 'CAYO_RAID' }, now).jailed, false);
  assert.equal(jailStatus({ jailed_until: new Date(now + 300_000), jail_reason: 'CAYO_RAID' }, now).remainingMs, 300_000);
});

test('transactional reward check holds the restriction row lock and rejects jailed players', async () => {
  const queries = [];
  const db = { async query(sql) {
    queries.push(sql);
    return sql.startsWith('SELECT jailed_until')
      ? { rows: [{ jailed_until: new Date(Date.now() + 150_000), jail_reason: 'CAYO_RAID' }] }
      : { rows: [] };
  } };
  await assert.rejects(assertJobAvailable(db, 'player1'), (error) => error.statusCode === 403 && /You are in jail/.test(error.message));
  assert.ok(queries.some((sql) => sql.includes('FOR UPDATE')));
});

test('authenticated direct requests to every protected job are denied while jailed', async (t) => {
  let jailedUntil = new Date(Date.now() + 180_000);
  let jailUnavailable = false;
  const db = { async query(sql) {
    if (sql.includes('FROM users WHERE id')) return { rows: [{ id: 1, username: 'test', email: 'test@example.com', player_id: 'player1', is_guest: false }] };
    if (sql.includes('FROM player_restrictions')) {
      if (jailUnavailable) throw new Error('database unavailable');
      return { rows: [{ jailed_until: jailedUntil, jail_reason: 'CAYO_RAID' }] };
    }
    throw new Error(`Unexpected SQL ${sql}`);
  } };
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  installJailGuard(app, db);
  app.post('/api/pizzer/delivery/handover', (_req, res) => res.json({ rewarded: true }));
  app.post('/api/fisher/dock/select', (_req, res) => res.json({ rewarded: true }));
  app.post('/api/sleep/claim', (_req, res) => res.json({ rewarded: true }));
  app.post('/api/gangs/work', (_req, res) => res.json({ rewarded: true }));
  app.post('/api/pilot/shift/end', (_req, res) => res.json({ ended: true }));

  const server = app.listen(0, '127.0.0.1');
  t.after(() => server.close());
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookie = `cityflow_user_token=${signUserToken(1, Date.now() + 60_000)}`;
  for (const path of ['/api/pizzer/delivery/handover', '/api/fisher/dock/select', '/api/sleep/claim', '/api/gangs/work']) {
    const response = await fetch(`${base}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ playerId: 'player1' }),
    });
    assert.equal(response.status, 403, path);
    const payload = await response.json();
    assert.equal(payload.code, 'PLAYER_JAILED');
    assert.match(payload.error, /You are in jail\. \d\d:\d\d remaining/);
  }
  const cleanup = await fetch(`${base}/api/pilot/shift/end`, { method: 'POST', headers: { Cookie: cookie } });
  assert.equal(cleanup.status, 200);
  const state = await fetch(`${base}/api/jail/state`, { headers: { Cookie: cookie } });
  assert.equal((await state.json()).jail.jailed, true);
  const spoof = await fetch(`${base}/api/gangs/work`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ playerId: 'different-player' }),
  });
  assert.equal(spoof.status, 403);
  jailUnavailable = true;
  const unavailable = await fetch(`${base}/api/sleep/claim`, {
    method: 'POST', headers: { Cookie: cookie },
  });
  assert.equal(unavailable.status, 503);
  jailUnavailable = false;
  jailedUntil = new Date(Date.now() - 1);
  const released = await fetch(`${base}/api/pizzer/delivery/handover`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ playerId: 'player1' }),
  });
  assert.equal(released.status, 200);
  assert.equal((await released.json()).rewarded, true);
});
