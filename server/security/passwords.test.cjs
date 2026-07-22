const assert = require('node:assert/strict');
const test = require('node:test');

const { hashPassword, isPasswordHash, validatePassword, verifyPassword } = require('./passwords.cjs');

test('passwords are stored as scrypt hashes and verify without exposing plaintext', async () => {
  const password = 'correct horse battery staple';
  const hash = await hashPassword(password);
  assert.equal(isPasswordHash(hash), true);
  assert.equal(hash.includes(password), false);
  assert.deepEqual(await verifyPassword(password, hash), { valid: true, needsUpgrade: false });
  assert.deepEqual(await verifyPassword('incorrect password', hash), { valid: false, needsUpgrade: false });
});

test('legacy plaintext passwords are accepted once and marked for migration', async () => {
  assert.deepEqual(await verifyPassword('legacy-password', 'legacy-password'), { valid: true, needsUpgrade: true });
  assert.throws(() => validatePassword('short'), /at least 10 characters/);
});
