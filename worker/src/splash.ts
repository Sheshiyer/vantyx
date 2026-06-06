/**
 * Branded Vantyx splash served at the apex / www / any host that doesn't resolve to a tenant.
 * Self-contained (no external assets) so it works before any SPA/asset is wired for the bare domain.
 */
const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Vantyx — Sell the view.</title>
<meta name="description" content="Vantyx — living 360° property tours that are always true to today." />
<style>
  :root { color-scheme: dark; }
  * { margin: 0; box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: radial-gradient(1200px 600px at 50% -10%, #1e1b4b 0%, #0b1220 55%, #070b14 100%);
    color: #e7e9f3; display: grid; place-items: center; text-align: center; padding: 2rem;
  }
  .wrap { max-width: 32rem; animation: fade 0.8s ease both; }
  .mark { font-size: clamp(2.5rem, 8vw, 4.5rem); font-weight: 700; letter-spacing: -0.03em; }
  .mark span { color: #818cf8; }
  .tag { margin-top: 0.75rem; font-size: clamp(1rem, 3vw, 1.25rem); color: #aab0c6; }
  .rule { width: 3rem; height: 2px; margin: 1.75rem auto 0; background: linear-gradient(90deg, transparent, #6366f1, transparent); }
  .foot { margin-top: 1.5rem; font-size: 0.8rem; color: #6b7191; }
  @keyframes fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
</style>
</head>
<body>
  <main class="wrap">
    <div class="mark">Vant<span>yx</span></div>
    <p class="tag">Sell the view.</p>
    <div class="rule"></div>
    <p class="foot">Living 360° property tours — always true to today.</p>
  </main>
</body>
</html>`;

export function splashResponse(): Response {
  return new Response(HTML, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
