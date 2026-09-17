const assert = require('node:assert/strict');
const test = require('node:test');

const { signUserToken, verifyUserToken, visitorNeedsAccount } = require('./userAuth.cjs');

test('user session tokens reject tampering and expiry', () => {
  const token = signUserToken(42, Date.now() + 60_000);
  assert.equal(verifyUserToken(token), 42);
  assert.equal(verifyUserToken(`${token}tampered`), null);
  assert.equal(verifyUserToken(signUserToken(42, Date.now() - 1)), null);
});

test('visitor can finish the guided city tutorial before the account gate', async () => {
  const db = { query: async () => ({ rows: [{ tutorial_step: 6, tutorial_completed_at: null, tutorial_skipped_at: null }] }) };
  const visitor = { isGuest: true, playerId: 'internal-player' };

  assert.equal(await visitorNeedsAccount({ originalUrl: '/api/city/tutorial/complete' }, db, visitor), false);
  assert.equal(await visitorNeedsAccount({ originalUrl: '/api/pizzer/order/options' }, db, visitor), true);
});

test('visitor profile name stays locked until account creation', async () => {
  const db = { query: async () => { throw new Error('profile lock should not need a database read'); } };
  const visitor = { isGuest: true, playerId: 'internal-player' };

  assert.equal(await visitorNeedsAccount({ originalUrl: '/api/player/profile/name' }, db, visitor), true);
  assert.equal(await visitorNeedsAccount({ originalUrl: '/api/player/profile/name' }, db, { ...visitor, isGuest: false }), false);
});
