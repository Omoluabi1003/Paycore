export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Use only deployment configuration. Host and forwarded headers are untrusted.
export function configuredOrigin(value = process.env.APP_BASE_URL ?? "") {
  const url = new URL(value);
  const localHttp = url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !localHttp) || url.username ||
      url.password || url.search || url.hash || url.pathname !== "/")
    throw Error("A canonical HTTPS application URL is required.");
  return url.origin;
}

export function requireSameOrigin(request: Request, origin = configuredOrigin()) {
  const site = request.headers.get("sec-fetch-site");
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method) ||
      request.headers.get("origin") !== origin ||
      (site !== null && site !== "same-origin" && site !== "none"))
    throw new HttpError(403, "Open this action from PayCore.");
}
