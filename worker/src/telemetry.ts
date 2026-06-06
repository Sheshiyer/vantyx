import type { Env } from "./env";

/** Structured log line — picked up by Workers observability + `wrangler tail`. Never throws. */
export function logEvent(obj: Record<string, unknown>): void {
  try {
    console.log(JSON.stringify({ ts: new Date().toISOString(), ...obj }));
  } catch {
    console.log("[telemetry] unserializable event");
  }
}

const MAX_BODY = 4096;

/**
 * POST /api/telemetry — same-origin beacon from the SPAs (client errors + product events). Always
 * emits a structured log line (visible in Workers observability / `wrangler tail`) and additionally
 * forwards to PostHog when POSTHOG_KEY is set. Returns 204 fast; client input is small + shape-checked.
 */
export async function handleTelemetry(
  slug: string | null,
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  let body: { type?: unknown; event?: unknown; props?: unknown; id?: unknown };
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return new Response(null, { status: 413 });
    body = JSON.parse(text) as typeof body;
  } catch {
    return new Response(null, { status: 400 });
  }
  const type = body.type === "error" ? "error" : "event";
  const event = typeof body.event === "string" ? body.event.slice(0, 120) : "unknown";
  const props = body.props && typeof body.props === "object" ? (body.props as Record<string, unknown>) : {};
  const distinctId = typeof body.id === "string" ? body.id.slice(0, 200) : "anon";

  logEvent({ t: `client.${type}`, slug, event, props, ua: request.headers.get("user-agent") });

  if (env.POSTHOG_KEY) {
    ctx.waitUntil(forwardToPostHog(env, { event: `${type}:${event}`, distinctId, slug, props }));
  }
  return new Response(null, { status: 204 });
}

async function forwardToPostHog(
  env: Env,
  e: { event: string; distinctId: string; slug: string | null; props: Record<string, unknown> },
): Promise<void> {
  const host = (env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
  try {
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: env.POSTHOG_KEY,
        event: e.event,
        distinct_id: e.distinctId,
        properties: { ...e.props, slug: e.slug, $lib: "vantyx-worker" },
      }),
    });
  } catch {
    // best-effort: telemetry must never break or slow a real request
  }
}
