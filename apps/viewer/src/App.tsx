import { useEffect, useState } from "react";
import type { TenantConfig } from "@panorama/shared";
import { fetchConfig, ConfigError } from "./api";
import { PanoramaShell } from "./components/panoramic/PanoramaShell";
import { LoadingState } from "./components/LoadingState";
import { ErrorState } from "./components/ErrorState";
import { track, trackError } from "./lib/telemetry";

type State =
  | { status: "loading" }
  | { status: "ready"; config: TenantConfig }
  | { status: "error"; title: string; message: string };

export function App() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    fetchConfig()
      .then((config) => {
        if (!active) return;
        document.title = config.branding.appTitle;
        track("tour_loaded", { slug: config.tenant.slug, floors: config.floors.length });
        setState({ status: "ready", config });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const notProvisioned = err instanceof ConfigError && err.code === "not_provisioned";
        trackError("tour_load_failed", { code: err instanceof ConfigError ? err.code : "unknown" });
        setState({
          status: "error",
          title: notProvisioned ? "Not set up yet" : "Couldn’t load the experience",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.status === "loading") return <LoadingState />;
  if (state.status === "error") return <ErrorState title={state.title} message={state.message} />;
  return <PanoramaShell config={state.config} />;
}
