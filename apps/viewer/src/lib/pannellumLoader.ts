import type { Pannellum } from "../types/pannellum";

// Load the VENDORED Pannellum (public/vendor/pannellum) — no third-party CDN at runtime.
// Use Vite's BASE_URL so the path is relative ("./vendor/…") in a static build and absolute
// ("/vendor/…") behind the Worker — works whether served from root, a sub-path, or file://.
const JS_SRC = `${import.meta.env.BASE_URL}vendor/pannellum/pannellum.js`;
const CSS_HREF = `${import.meta.env.BASE_URL}vendor/pannellum/pannellum.css`;

let pannellumPromise: Promise<Pannellum> | null = null;

export function loadPannellum(): Promise<Pannellum> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Pannellum requires a browser"));
  }
  if (window.pannellum) return Promise.resolve(window.pannellum);
  if (pannellumPromise) return pannellumPromise;

  pannellumPromise = new Promise<Pannellum>((resolve, reject) => {
    if (!document.querySelector(`link[href="${CSS_HREF}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = CSS_HREF;
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = JS_SRC;
    script.async = true;
    script.onload = () => {
      if (window.pannellum) resolve(window.pannellum);
      else reject(new Error("Pannellum loaded but did not initialize"));
    };
    script.onerror = () => reject(new Error("Failed to load Pannellum"));
    document.body.appendChild(script);
  });

  return pannellumPromise;
}
