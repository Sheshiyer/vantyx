// Dependency-free telemetry → same-origin /api/telemetry beacon. The Worker logs every event
// (Workers observability / `wrangler tail`) and forwards to PostHog when a key is configured.
// Never throws and never blocks rendering.

type Props = Record<string, unknown>;

function distinctId(): string {
  try {
    const k = "vx_anon";
    let v = localStorage.getItem(k);
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return "anon";
  }
}

function send(type: "event" | "error", event: string, props: Props): void {
  try {
    const body = JSON.stringify({ type, event, props, id: distinctId() });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/telemetry", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/telemetry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch {
    /* telemetry must never break the app */
  }
}

export const track = (event: string, props: Props = {}) => send("event", event, props);
export const trackError = (event: string, props: Props = {}) => send("error", event, props);

let installed = false;
/** Install global error + unhandled-rejection beacons once. */
export function installErrorTracking(scope: string): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) =>
    trackError("window.error", {
      scope,
      message: String(e.message).slice(0, 300),
      source: e.filename,
      line: e.lineno,
    }),
  );
  window.addEventListener("unhandledrejection", (e) =>
    trackError("unhandledrejection", { scope, reason: String(e.reason).slice(0, 300) }),
  );
}
