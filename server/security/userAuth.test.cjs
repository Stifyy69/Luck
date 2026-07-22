const assert = require('node:assert/strict');
const test = require('node:test');

const { signUserToken, verifyUserToken } = require('./userAuth.cjs');

test('user session tokens reject tampering and expiry', () => {
  const token = signUserToken(42, Date.now() + 60_000);
  assert.equal(verifyUserToken(token), 42);
  assert.equal(verifyUserToken(`${token}tampered`), null);
  assert.equal(verifyUserToken(signUserToken(42, Date.now() - 1)), null);
});
