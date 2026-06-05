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
