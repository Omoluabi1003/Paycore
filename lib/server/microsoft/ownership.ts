import { createRemoteJWKSet, jwtVerify } from "jose";
export const BRICE_EMAIL = "brice@makfreightservices.com";
export const BRICE_TENANT = "d2fad647-1619-4648-8d67-16a04f3c3646";
export function isBrice(email: unknown) {
  return typeof email === "string" && email.toLowerCase() === BRICE_EMAIL;
}
export function verifiedBrice(user: { email?: unknown; email_verified?: unknown }) {
  return user.email_verified === true && isBrice(user.email);
}
const keys = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${BRICE_TENANT}/discovery/v2.0/keys`));
export async function verifyMicrosoftOwner(token: string, nonce: string, keySet = keys) {
  const { payload } = await jwtVerify(token, keySet, {
    issuer: `https://login.microsoftonline.com/${BRICE_TENANT}/v2.0`,
    audience: process.env.MICROSOFT_CLIENT_ID,
    algorithms: ["RS256"], maxTokenAge: "10m",
    requiredClaims: ["exp", "iat", "sub", "oid", "tid", "nonce"],
  });
  if (!process.env.MICROSOFT_CLIENT_ID || payload.tid !== BRICE_TENANT ||
      payload.nonce !== nonce || typeof payload.oid !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(payload.oid)) throw Error("Microsoft account is not authorized.");
  return payload.oid.toLowerCase();
}
