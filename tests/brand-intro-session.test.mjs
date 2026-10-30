import test from 'node:test';
import assert from 'node:assert/strict';
import { BRAND_INTRO_SESSION_KEY, createIntroSessionGuard } from '../lib/brand-intro-session.ts';
const store = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
test('first root entry claims the splash and immediately marks the tab as entered', () => {
  const storage = store();
  assert.equal(createIntroSessionGuard().claim('/', storage), true);
  assert.equal(storage.getItem(BRAND_INTRO_SESSION_KEY), '1');
});
test('navigation and a document reload cannot claim another splash in the same tab', () => {
  const storage = store(), first = createIntroSessionGuard();
  assert.equal(first.claim('/', storage), true);
  for (const route of ['/scan', '/scan/inbox', '/', '/brand']) assert.equal(first.claim(route, storage), false);
  assert.equal(createIntroSessionGuard().claim('/', storage), false);
});
test('direct task links bypass the splash and returning home does not introduce one', () => {
  for (const route of ['/scan', '/scan/inbox', '/brand', '/welcome']) {
    const storage = store(), entry = createIntroSessionGuard();
    assert.equal(entry.claim(route, storage), false);
    assert.equal(createIntroSessionGuard().claim('/', storage), false);
  }
});
test('a separate fresh tab can show its own first-entry splash', () => {
  assert.equal(createIntroSessionGuard().claim('/', store()), true);
  assert.equal(createIntroSessionGuard().claim('/', store()), true);
});
test('blocked storage never blocks task routes or replays on client navigation', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  const entry = createIntroSessionGuard();
  assert.equal(entry.claim('/', blocked), true);
  assert.equal(entry.claim('/', blocked), false);
  assert.equal(entry.claim('/scan', blocked), false);
  assert.equal(createIntroSessionGuard().claim('/scan', blocked), false);
  const noStorage = createIntroSessionGuard();
  assert.equal(noStorage.claim('/scan/inbox', null), false);
  assert.equal(noStorage.claim('/', null), false);
});
