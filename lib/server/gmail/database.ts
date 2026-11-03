import { Pool } from "pg";
export interface Sql {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, any>[]; rowCount?: number | null }>;
}
let singleton: Pool | undefined;
export function pool() {
  if (!process.env.DATABASE_URL)
    throw Error("Private database is not configured.");
  if (!singleton) {
    singleton = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 10000,
      statement_timeout: 15000,
    });
    // Idle connection errors must not crash the worker or disclose connection details.
    singleton.on("error", () =>
      console.error("Mailbox database connection interrupted."),
    );
  }
  return singleton;
}
export async function scoped<T>(
  company: string,
  user: string,
  action: (sql: Sql) => Promise<T>,
) {
  const connection = await pool().connect();
  try {
    await connection.query("BEGIN");
    await connection.query(
      "SELECT set_config('paycore.workspace_id',$1,true),set_config('paycore.user_id',$2,true)",
      [company, user],
    );
    const result = await action(connection);
    await connection.query("COMMIT");
    return result;
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}
