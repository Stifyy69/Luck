const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { signUserToken, verifyUserToken, visitorNeedsAccount } = require('./userAuth.cjs');

const appSource = fs.readFileSync(path.join(__dirname, '../../src/App.tsx'), 'utf8');
const accountSource = fs.readFileSync(path.join(__dirname, '../../src/components/AccountPage.tsx'), 'utf8');
const tutorialSource = fs.readFileSync(path.join(__dirname, '../../src/components/city/CityTutorialOverlay.tsx'), 'utf8');

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

test('frontend flow is tutorial then account then city for visitors', () => {
  assert.match(appSource, /const visitor = Boolean\(session\?\.isGuest\)/);
  assert.match(appSource, /tutorialFinished = Boolean\(cityProgress\?\.tutorial\?\.completedAt \|\| cityProgress\?\.tutorial\?\.skippedAt\)/);
  assert.match(appSource, /const accountRequired = visitor && tutorialFinished/);
  assert.doesNotMatch(appSource, /const accountRequired = Boolean\(session\?\.isGuest\)/);
  assert.match(tutorialSource, /Create account or log in/);
  assert.match(tutorialSource, /onNavigate\(session\?\.isGuest \? '\/account' : '\/city'\)/);
  assert.match(accountSource, /Your Visitor tutorial is complete/);
  assert.match(accountSource, /window\.location\.assign\('\/city'\)/);
});

test('visitor profile name stays locked until account creation', async () => {
  const db = { query: async () => { throw new Error('profile lock should not need a database read'); } };
  const visitor = { isGuest: true, playerId: 'internal-player' };

  assert.equal(await visitorNeedsAccount({ originalUrl: '/api/player/profile/name' }, db, visitor), true);
  assert.equal(await visitorNeedsAccount({ originalUrl: '/api/player/profile/name' }, db, { ...visitor, isGuest: false }), false);
});
