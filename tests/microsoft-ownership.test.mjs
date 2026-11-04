import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import { verifiedBrice, isBrice, verifyMicrosoftOwner, BRICE_TENANT } from '../lib/server/microsoft/ownership.ts';
import { saveMailboxConnection } from '../lib/server/gmail/connect-mailbox.ts';
test('management requires the verified Brice identity, not an editable email or domain match', () => {
  assert.equal(verifiedBrice({ email: 'BRICE@makfreightservices.com', email_verified: true }), true);
  for (const user of [{}, { email: 'brice@makfreightservices.com' }, { email: 'brice@makfreightservices.com', email_verified: 'true' }, { email: 'someone@makfreightservices.com', email_verified: true }]) assert.equal(verifiedBrice(user), false);
  assert.equal(isBrice('brice@makfreightservices.com.attacker.test'), false);
});
test('Microsoft identity verification rejects wrong signatures, tenant, audience, nonce and expired tokens', async () => {
  process.env.MICROSOFT_CLIENT_ID = 'synthetic-owner-client';
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  const keys = createLocalJWKSet({ keys: [{ ...jwk, kid: 'owner' }] });
  const claims = { tid: BRICE_TENANT, oid: '11111111-1111-1111-1111-111111111111', nonce: 'synthetic-nonce' };
  async function token(overrides = {}, signingKey = privateKey) {
    return new SignJWT({ ...claims, ...overrides }).setProtectedHeader({ alg: 'RS256', kid: 'owner' })
      .setIssuer(`https://login.microsoftonline.com/${BRICE_TENANT}/v2.0`).setAudience('synthetic-owner-client').setSubject('synthetic-owner').setIssuedAt().setExpirationTime('5m').sign(signingKey);
  }
  assert.equal(await verifyMicrosoftOwner(await token(), 'synthetic-nonce', keys), claims.oid);
  for (const overrides of [{ tid: 'wrong' }, { nonce: 'wrong' }, { oid: 'invalid' }]) await assert.rejects(() => token(overrides).then(t => verifyMicrosoftOwner(t, 'synthetic-nonce', keys)));
  await assert.rejects(() => verifyMicrosoftOwner('forged', 'synthetic-nonce', keys));
  const other = await generateKeyPair('RS256');
  await assert.rejects(() => token({}, other.privateKey).then(t => verifyMicrosoftOwner(t, 'synthetic-nonce', keys)));
  process.env.MICROSOFT_CLIENT_ID = 'wrong-audience';
  await assert.rejects(() => token().then(t => verifyMicrosoftOwner(t, 'synthetic-nonce', keys)));
  process.env.MICROSOFT_CLIENT_ID = 'synthetic-owner-client';
  const expired = await new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'owner' }).setIssuer(`https://login.microsoftonline.com/${BRICE_TENANT}/v2.0`).setAudience('synthetic-owner-client').setSubject('owner').setIssuedAt(Math.floor(Date.now()/1000)-900).setExpirationTime(Math.floor(Date.now()/1000)-600).sign(privateKey);
  await assert.rejects(() => verifyMicrosoftOwner(expired, 'synthetic-nonce', keys));
});
test('protected mailbox cannot be claimed through Google or a different Microsoft mailbox', async () => {
  const transaction = () => { throw Error('Database must not be touched'); };
  const token = { access_token: 'synthetic', expires_in: 3600 };
  await assert.rejects(() => saveMailboxConnection('company','user','GMAIL',{ emailAddress:'brice@makfreightservices.com',historyId:'1' }, token, transaction), /requires/);
  await assert.rejects(() => saveMailboxConnection('company','user','MICROSOFT',{ emailAddress:'someone@example.test',historyId:'1' },token,transaction,'11111111-1111-1111-1111-111111111111'), /requires/);
});
