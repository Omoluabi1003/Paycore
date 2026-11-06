import { scoped } from "../gmail/database.ts";
import { HttpError } from "./http.ts";
export const requestLimits = {
  documents: { count: 120, seconds: 60 },
  "mailbox-management": { count: 10, seconds: 600 },
} as const;
export class RateLimitError extends HttpError {
  retryAfter: number;
  constructor(seconds: number) {
    super(429, "Too many requests. Please wait before trying again.");
    this.retryAfter = seconds;
  }
}
// Shared database state, keyed to the verified account, not client IP/headers/company.
export async function limitRequest(
  user: string,
  bucket: keyof typeof requestLimits,
  transaction = scoped,
) {
  const policy = requestLimits[bucket];
  const allowed = await transaction("", user, async sql => (
    await sql.query(
      `INSERT INTO request_rate_limits(user_id,bucket,hits) VALUES($1,$2,1)
       ON CONFLICT(user_id,bucket) DO UPDATE SET
       hits=CASE WHEN request_rate_limits.window_started_at<=now()-make_interval(secs=>$3) THEN 1 ELSE request_rate_limits.hits+1 END,
       window_started_at=CASE WHEN request_rate_limits.window_started_at<=now()-make_interval(secs=>$3) THEN now() ELSE request_rate_limits.window_started_at END
       WHERE request_rate_limits.window_started_at<=now()-make_interval(secs=>$3) OR request_rate_limits.hits<$4
       RETURNING hits`, [user, bucket, policy.seconds, policy.count],
    )
  ).rows.length > 0);
  if (!allowed) throw new RateLimitError(policy.seconds);
}
