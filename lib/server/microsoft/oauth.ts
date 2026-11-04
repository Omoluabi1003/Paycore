import { verifyMicrosoftOwner, isBrice, BRICE_EMAIL } from "./ownership.ts";
import { randomBytes, createHash } from "node:crypto";
import { scoped } from "../gmail/database.ts";
import { seal, unseal, digest } from "../gmail/crypto.ts";
import { applicationOrigin } from "../gmail/config.ts";
import { saveMailboxConnection } from "../gmail/connect-mailbox.ts";
import {
  microsoftAuthority,
  MICROSOFT_SCOPES,
  exchangeMicrosoftToken,
  MicrosoftClient,
} from "./client.ts";
export async function beginMicrosoftConnect(
  company: string,
  user: string,
  transaction = scoped,
) {
  const verifier = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const state = seal(
    JSON.stringify({ company, nonce }),
    "microsoft-oauth-state",
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
        seal(verifier, `microsoft-pkce:${company}:${user}`),
      ],
    );
  });
  const url = new URL(`${microsoftAuthority()}/authorize`);
  url.search = new URLSearchParams({
    nonce,
    client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
    response_type: "code",
    response_mode: "query",
    redirect_uri: `${applicationOrigin()}/api/microsoft/callback`,
    scope: MICROSOFT_SCOPES,
    prompt: "select_account",
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    state,
  }).toString();
  url.searchParams.set("login_hint", BRICE_EMAIL);
  return url.href;
}
export function microsoftStateCompany(state: string) {
  if (state.length > 4096) throw Error("Invalid Microsoft state.");
  const value = JSON.parse(unseal(state, "microsoft-oauth-state"));
  if (typeof value.company !== "string" || typeof value.nonce !== "string")
    throw Error("Invalid Microsoft state.");
  return value.company as string;
}
export async function finishMicrosoftConnect(
  company: string,
  user: string,
  state: string,
  code: string,
  dependencies = {
    transaction: scoped,
    exchange: exchangeMicrosoftToken,
    profile: async (token: string) => new MicrosoftClient(token).profile(),
    verifyOwner: verifyMicrosoftOwner,
  },
) {
  if (microsoftStateCompany(state) !== company)
    throw Error("Invalid Microsoft company state.");
  const verifier = await dependencies.transaction(
    company,
    user,
    async (sql) => {
      const row = (
        await sql.query(
          "DELETE FROM gmail_oauth_states WHERE company_id=$1 AND user_id=$2 AND state_hash=$3 AND expires_at>now() RETURNING verifier",
          [company, user, digest(state)],
        )
      ).rows[0];
      if (!row)
        throw Error(
          "Microsoft connection request expired or was already used.",
        );
      return unseal(row.verifier, `microsoft-pkce:${company}:${user}`);
    },
  );
  const token = await dependencies.exchange({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: `${applicationOrigin()}/api/microsoft/callback`,
  });
  const scopes =
    token.scope
      ?.split(/\s+/)
      .map((value) => value.split("/").at(-1)?.toLowerCase()) ?? [];
  if (!scopes.includes("mail.read") || !scopes.includes("user.read"))
    throw Error("Microsoft read-only mailbox permission was not granted.");
  const nonce = JSON.parse(unseal(state, "microsoft-oauth-state")).nonce;
  const accountId = await dependencies.verifyOwner(token.id_token ?? "", nonce);
  const profile = await dependencies.profile(token.access_token);
  if (!isBrice(profile.emailAddress) || profile.accountId.toLowerCase() !== accountId)
    throw Error("Only Brice’s Microsoft mailbox can be connected.");
  return saveMailboxConnection(
    company,
    user,
    "MICROSOFT",
    profile,
    token,
    dependencies.transaction,
    accountId,
  );
}
