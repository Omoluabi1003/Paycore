import { randomBytes, randomUUID, createHash } from "node:crypto";
import { applicationOrigin } from "./config.ts";
import { scoped } from "./database.ts";
import { seal, unseal, digest } from "./crypto.ts";
import { GMAIL_SCOPE, exchangeToken, GmailClient } from "./client.ts";
import { credentials, event } from "./repository.ts";
import type { Mailbox } from "./repository.ts";
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
  await transaction(company, user, async (sql) => {
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
  await dependencies.transaction(company, user, async (sql) => {
    const membership = (
      await sql.query(
        "SELECT roles FROM document_company_memberships WHERE company_id=$1 AND user_id=$2 AND active=true",
        [company, user],
      )
    ).rows[0];
    if (
      !membership?.roles.some((role: string) =>
        ["OWNER_ADMIN", "FINANCE"].includes(role),
      )
    )
      throw Error("Mailbox access was removed.");
    await sql.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `${company}:${profile.emailAddress.toLowerCase()}`,
    ]);
    const prior = (
      await sql.query(
        "SELECT * FROM gmail_mailboxes WHERE company_id=$1 AND email=$2 FOR UPDATE",
        [company, profile.emailAddress.toLowerCase()],
      )
    ).rows[0] as Mailbox | undefined;
    const id = prior?.id ?? randomUUID(),
      refresh =
        token.refresh_token ||
        (prior?.active ? credentials(prior).refreshToken : "");
    if (!refresh)
      throw Error(
        "Offline Gmail permission is required. Reconnect with consent.",
      );
    const value = seal(
      JSON.stringify({
        accessToken: token.access_token,
        refreshToken: refresh,
        expiresAt: Date.now() + token.expires_in * 1000,
      }),
      `gmail-token:${company}:${id}`,
    );
    await sql.query(
      "INSERT INTO gmail_mailboxes(id,company_id,email,connected_by,credentials,checkpoint) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(company_id,email) DO UPDATE SET credentials=excluded.credentials,active=true,connected_by=excluded.connected_by,checkpoint=excluded.checkpoint,last_error=NULL",
      [
        id,
        company,
        profile.emailAddress.toLowerCase(),
        user,
        value,
        JSON.stringify({ phase: "BACKFILL", anchor: profile.historyId }),
      ],
    );
    await sql.query(
      "INSERT INTO gmail_sync_jobs(mailbox_id,company_id) VALUES($1,$2) ON CONFLICT(mailbox_id) DO UPDATE SET next_run_at=now(),lease_owner=NULL,lease_until=NULL",
      [id, company],
    );
    await event(sql, company, user, "gmail.connected", { mailboxId: id });
  });
}
