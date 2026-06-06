/** JSON response with the right content-type. */
export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

/** Standard `{ error, code }` envelope. */
export function apiError(status: number, code: string, message: string): Response {
  return json({ error: message, code }, { status });
}

/** 429 with a Retry-After hint (seconds). */
export function tooManyRequests(retryAfter: number): Response {
  const res = apiError(429, "rate_limited", "Too many attempts. Please wait, then try again.");
  res.headers.set("retry-after", String(Math.max(1, Math.floor(retryAfter))));
  return res;
}
