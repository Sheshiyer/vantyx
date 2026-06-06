import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { TenantConfig, Slot } from "@panorama/shared";
import { getDraft, putDraft, uploadImage, publish as apiPublish } from "./api";
import { downscaleToJpeg, readImageMeta, isEquirectangular } from "./lib/downscale";
import { SlotGrid } from "./components/SlotGrid";
import { PublishBar } from "./components/PublishBar";
import { cn } from "./lib/ui";

type Status = "loading" | "ready" | "error";

function patchSlotImage(
  config: TenantConfig,
  floorId: string,
  viewId: string,
  timeId: string,
  key: string,
): TenantConfig {
  return {
    ...config,
    floors: config.floors.map((f) => {
      if (f.id !== floorId) return f;
      const exists = f.slots.some((s) => s.viewId === viewId && s.timeId === timeId);
      const slots: Slot[] = exists
        ? f.slots.map((s) =>
            s.viewId === viewId && s.timeId === timeId ? { ...s, image: key, enabled: true } : s,
          )
        : [...f.slots, { viewId, timeId, enabled: true, image: key, hotspots: [] }];
      return { ...f, slots };
    }),
  };
}

export function App() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [floorId, setFloorId] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getDraft()
      .then((c) => {
        if (!active) return;
        setConfig(c);
        setFloorId(c.floors[0]?.id ?? "");
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load");
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const floor = useMemo(
    () => config?.floors.find((f) => f.id === floorId) ?? null,
    [config, floorId],
  );

  async function replaceSlot(viewId: string, timeId: string, file: File) {
    if (!floor) return;
    setToast(null);
    setBusy("Reading image…");
    try {
      const meta = await readImageMeta(file);
      if (!isEquirectangular(meta)) {
        setToast(`Note: ${meta.width}×${meta.height} isn't 2:1 equirectangular — it may look stretched.`);
      }
      setBusy("Downscaling + uploading…");
      const blob = await downscaleToJpeg(file);
      const key = await uploadImage({ floorId: floor.id, timeId, viewId }, blob);
      setConfig((prev) => (prev ? patchSlotImage(prev, floor.id, viewId, timeId, key) : prev));
      setDirty(true);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!config) return;
    setBusy("Saving draft…");
    try {
      await putDraft(config);
      setDirty(false);
      setToast("Draft saved. Your live tour is untouched.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!config) return;
    setBusy("Publishing…");
    try {
      if (dirty) await putDraft(config);
      const version = await apiPublish();
      setConfig(await getDraft());
      setDirty(false);
      setToast(`Published — live now (v${version}). The tour never went down.`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(null);
    }
  }

  if (status === "loading") return <Centered>Loading your tour…</Centered>;
  if (status === "error") return <Centered>{error}</Centered>;
  if (!config) return null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-white/10 px-6 py-3">
        <div className="text-sm font-semibold tracking-tight">
          <span className="text-indigo-300">Vantyx</span>
          <span className="px-2 text-white/30">·</span>
          <span className="text-white/90">{config.tenant.name}</span>
        </div>
        <nav className="flex flex-wrap gap-1.5">
          {[...config.floors]
            .sort((a, b) => a.order - b.order)
            .map((f) => (
              <button
                key={f.id}
                onClick={() => setFloorId(f.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  f.id === floorId
                    ? "bg-white text-black"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
                )}
              >
                {f.floorNumber ?? f.label}
              </button>
            ))}
        </nav>
      </header>

      <main className="flex-1 overflow-auto p-6">
        {floor && <SlotGrid config={config} floor={floor} busy={!!busy} onReplace={replaceSlot} />}
      </main>

      <PublishBar
        version={config.version}
        dirty={dirty}
        busy={busy}
        toast={toast}
        onSave={save}
        onPublish={publish}
      />
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/70">
      {children}
    </div>
  );
}
