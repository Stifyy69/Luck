const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = Object.freeze({ N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const HASH_PREFIX = 'scrypt';

function validatePassword(value) {
  const password = String(value || '');
  if (password.length < 10) throw new Error('password must contain at least 10 characters');
  if (password.length > 200) throw new Error('password is too long');
  return password;
}

async function hashPassword(value) {
  const password = validatePassword(value);
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return [
    HASH_PREFIX,
    SCRYPT_OPTIONS.N,
    SCRYPT_OPTIONS.r,
    SCRYPT_OPTIONS.p,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

function isPasswordHash(value) {
  return String(value || '').startsWith(`${HASH_PREFIX}$`);
}

async function verifyPassword(value, storedValue) {
  const password = String(value || '');
  const stored = String(storedValue || '');
  if (!password || !stored) return { valid: false, needsUpgrade: false };

  if (!isPasswordHash(stored)) {
    const provided = Buffer.from(password);
    const legacy = Buffer.from(stored);
    const valid = provided.length === legacy.length && crypto.timingSafeEqual(provided, legacy);
    return { valid, needsUpgrade: valid };
  }

  const [prefix, rawN, rawR, rawP, rawSalt, rawHash] = stored.split('$');
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (prefix !== HASH_PREFIX || N !== SCRYPT_OPTIONS.N || r !== SCRYPT_OPTIONS.r || p !== SCRYPT_OPTIONS.p) {
    return { valid: false, needsUpgrade: false };
  }

  try {
    const salt = Buffer.from(rawSalt, 'base64url');
    const expected = Buffer.from(rawHash, 'base64url');
    const derived = await scrypt(password, salt, expected.length, { N, r, p, maxmem: SCRYPT_OPTIONS.maxmem });
    const valid = derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
    return { valid, needsUpgrade: false };
  } catch {
    return { valid: false, needsUpgrade: false };
  }
}

module.exports = {
  hashPassword,
  isPasswordHash,
  validatePassword,
  verifyPassword,
};
