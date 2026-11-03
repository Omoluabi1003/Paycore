import { Auth0Client } from "@auth0/nextjs-auth0/server";
let client: Auth0Client | undefined;
export function auth0Configured() {
  return Boolean(
    process.env.AUTH0_DOMAIN &&
      process.env.AUTH0_CLIENT_ID &&
      process.env.AUTH0_CLIENT_SECRET &&
      process.env.AUTH0_SECRET &&
      process.env.APP_BASE_URL,
  );
}
export function auth0() {
  if (!auth0Configured())
    throw Error("Secure account connection is not configured.");
  return (client ??= new Auth0Client({
    authorizationParameters: { scope: "openid profile email" },
    enableAccessTokenEndpoint: false,
    session: { absoluteDuration: 28800, inactivityDuration: 3600 },
  }));
}
