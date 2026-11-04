import { companyIdentity } from "../../company-identity.ts";
import { randomBytes, createHash } from "node:crypto";
import { applicationOrigin } from "./config.ts";
import { scoped } from "./database.ts";
import { seal, unseal, digest } from "./crypto.ts";
import { GMAIL_SCOPE, exchangeToken, GmailClient } from "./client.ts";
import { saveMailboxConnection } from "./connect-mailbox.ts";
export async function beginGoogleConnect(
  company: string,
  user: string,
  transaction = scoped,
) {
  const verifier = randomBytes(32).toString("base64url"),
    state = seal(
      JSON.stringify({ company, nonce: randomBytes(32).toString("base64url") }),
      "gmail-oauth-state",
    );
  const loginHint = await transaction(company, user, async (sql) => {
    await sql.query(
      "DELETE FROM gmail_oauth_states WHERE company_id=$1 AND expires_at<now()",
      [company],
    );
    await sql.query(
      "INSERT INTO gmail_oauth_states(state_hash,company_id,user_id,verifier,expires_at) VALUES($1,$2,$3,$4,now()+interval '10 minutes')",
      [
        digest(state),
        company,
        user,
        seal(verifier, `gmail-pkce:${company}:${user}`),
      ],
    );
    const member = (
      await sql.query(
        "SELECT company_name FROM document_company_memberships WHERE company_id=$1 AND user_id=$2 AND active=true",
        [company, user],
      )
    ).rows[0];
    return member
      ? companyIdentity(member.company_name)?.header.email
      : undefined;
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: `${applicationOrigin()}/api/gmail/callback`,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    state,
  }).toString();
  if (loginHint) url.searchParams.set("login_hint", loginHint);
  return url.toString();
}
export function stateCompany(state: string) {
  if (state.length > 4096) throw Error("Invalid OAuth state.");
  const value = JSON.parse(unseal(state, "gmail-oauth-state"));
  if (typeof value.company !== "string" || typeof value.nonce !== "string")
    throw Error("Invalid OAuth state.");
  return value.company as string;
}
export async function finishGoogleConnect(
  company: string,
  user: string,
  state: string,
  code: string,
  dependencies = {
    transaction: scoped,
    exchange: exchangeToken,
    profile: async (token: string) => new GmailClient(token).profile(),
  },
) {
  if (stateCompany(state) !== company)
    throw Error("Invalid Google company state.");
  const verifier = await dependencies.transaction(
    company,
    user,
    async (sql) => {
      const result = await sql.query(
        "DELETE FROM gmail_oauth_states WHERE company_id=$1 AND user_id=$2 AND state_hash=$3 AND expires_at>now() RETURNING verifier",
        [company, user, digest(state)],
      );
      if (!result.rows.length)
        throw Error("Google connection request expired or was already used.");
      return unseal(result.rows[0].verifier, `gmail-pkce:${company}:${user}`);
    },
  );
  const token = await dependencies.exchange({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: `${applicationOrigin()}/api/gmail/callback`,
  });
  if (!token.scope?.split(" ").includes(GMAIL_SCOPE))
    throw Error("Gmail read-only permission was not granted.");
  const profile = await dependencies.profile(token.access_token);
  return saveMailboxConnection(
    company,
    user,
    "GMAIL",
    profile,
    token,
    dependencies.transaction,
  );
}
