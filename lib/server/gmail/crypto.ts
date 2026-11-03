import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  timingSafeEqual,
} from "node:crypto";
export function seal(
  value: string,
  context: string,
  key = process.env.GMAIL_ENCRYPTION_KEY ?? "",
) {
  if (!/^[a-f0-9]{64}$/i.test(key))
    throw Error("Mailbox encryption is not configured.");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}
export function unseal(
  value: string,
  context: string,
  key = process.env.GMAIL_ENCRYPTION_KEY ?? "",
) {
  const [version, iv, tag, data] = value.split(".");
  if (version !== "v1" || !/^[a-f0-9]{64}$/i.test(key))
    throw Error("Invalid encrypted mailbox data.");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "hex"),
    Buffer.from(iv, "base64url"),
  );
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    cipher.update(Buffer.from(data, "base64url")),
    cipher.final(),
  ]).toString("utf8");
}
export const digest = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export function cronAuthorized(
  value: string | null,
  secret: string | undefined,
) {
  if (!secret) return false;
  const actual = Buffer.from(value ?? ""),
    expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
