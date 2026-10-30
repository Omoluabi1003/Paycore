import test from 'node:test';
import assert from 'node:assert/strict';
import { copyPayCoreLink, sharePayCoreLink } from '../lib/brand-sharing.ts';
import { PAYCORE_PUBLIC_URL } from '../lib/brand-identity.ts';

test('native sharing uses the confirmed public URL with no payroll or session data', async () => {
  const payloads = [];
  const status = await sharePayCoreLink({ share: async payload => payloads.push(payload), copy: async () => assert.fail('No clipboard write after native sharing succeeds') });
  assert.equal(status, 'shared'); assert.equal(payloads.length, 1);
  assert.equal(payloads[0].url, 'https://paycore-1.vercel.app/');
  assert.deepEqual(Object.keys(payloads[0]).sort(), ['text', 'title', 'url']);
  assert.equal(new URL(payloads[0].url).search, '');
});
test('unsupported native sharing copies only the public app link', async () => {
  const copied = [];
  assert.equal(await sharePayCoreLink({ copy: async value => copied.push(value) }), 'copied');
  assert.deepEqual(copied, [PAYCORE_PUBLIC_URL]);
});
test('a cancelled native share does not overwrite the clipboard', async () => {
  assert.equal(await sharePayCoreLink({ share: async () => { throw { name: 'AbortError' }; }, copy: async () => assert.fail('Cancellation must not copy') }), 'cancelled');
});
test('failed native sharing falls back to the clipboard and reports manual copy when denied', async () => {
  const share = async () => { throw new Error('Share unavailable'); };
  assert.equal(await sharePayCoreLink({ share, copy: async () => {} }), 'copied');
  assert.equal(await sharePayCoreLink({ share, copy: async () => { throw new Error('Permission denied'); } }), 'manual');
  assert.equal(await copyPayCoreLink(), 'manual');
});
test('copy status never reports success before a clipboard operation completes', async () => {
  let fail;
  const pending = copyPayCoreLink(() => new Promise((_, reject) => { fail = reject; }));
  fail(new Error('Clipboard denied'));
  assert.equal(await pending, 'manual');
});
