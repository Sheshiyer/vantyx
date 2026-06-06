import { useEffect, useRef, useState } from "react";
import { getAuthConfig } from "../api";

/**
 * Cloudflare Turnstile. Renders nothing until a site key is configured (served by /api/auth/config),
 * so every form works unchanged until you opt in by setting TURNSTILE_SITE_KEY + TURNSTILE_SECRET.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }) => string;
      reset: (id?: string) => void;
    };
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/** Fetch the configured site key once (null = widget disabled). */
export function useTurnstileSiteKey(): string | null {
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    getAuthConfig()
      .then((c) => on && setKey(c.turnstileSiteKey))
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);
  return key;
}

export function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string | null;
  onToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!siteKey) return;
    const render = () => {
      if (!window.turnstile || !ref.current) return;
      ref.current.innerHTML = "";
      window.turnstile.render(ref.current, { sitekey: siteKey, callback: (t) => cb.current(t) });
    };
    if (window.turnstile) {
      render();
      return;
    }
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    return () => script?.removeEventListener("load", render);
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={ref} className="mt-1" />;
}
