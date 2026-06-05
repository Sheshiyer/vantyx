import { test, expect } from "bun:test";
import {
  hostnameToSlug,
  isValidSlug,
  slotObjectKey,
  tenantBucketKey,
  configKvKey,
  parseTenantConfig,
  safeParseTenantConfig,
  floorIdFromNumber,
  floorLabelFromNumber,
  MARINA_ONE_FLOOR_ELEVATION,
  type TenantConfig,
} from "./index";

const APEX = "pano.example.com";

test("hostnameToSlug resolves tenant subdomains", () => {
  expect(hostnameToSlug("marina-one.pano.example.com", APEX)).toBe("marina-one");
  expect(hostnameToSlug("MARINA-ONE.Pano.Example.Com", APEX)).toBe("marina-one");
  expect(hostnameToSlug("marina-one.pano.example.com:8787", APEX)).toBe("marina-one");
});

test("hostnameToSlug rejects apex, reserved, nested, and foreign hosts", () => {
  expect(hostnameToSlug("pano.example.com", APEX)).toBeNull();
  expect(hostnameToSlug("www.pano.example.com", APEX)).toBeNull();
  expect(hostnameToSlug("admin.pano.example.com", APEX)).toBeNull();
  expect(hostnameToSlug("a.b.pano.example.com", APEX)).toBeNull();
  expect(hostnameToSlug("marina-one.evil.com", APEX)).toBeNull();
  expect(hostnameToSlug(null, APEX)).toBeNull();
});

test("isValidSlug enforces dns-safety + reserved list", () => {
  expect(isValidSlug("marina-one")).toBe(true);
  expect(isValidSlug("admin")).toBe(false);
  expect(isValidSlug("-bad")).toBe(false);
  expect(isValidSlug("UPPER")).toBe(false);
});

test("r2 keys build the canonical shape and block prefix escape", () => {
  expect(slotObjectKey({ floorId: "44f", timeId: "noon", viewId: "central-sea" })).toBe(
    "44f/noon/central-sea.jpg",
  );
  expect(tenantBucketKey("marina-one", "44f/noon/central-sea.jpg")).toBe(
    "marina-one/44f/noon/central-sea.jpg",
  );
  expect(configKvKey("marina-one")).toBe("config:marina-one");
  expect(() => slotObjectKey({ floorId: "../etc", timeId: "noon", viewId: "x" })).toThrow();
  expect(() => tenantBucketKey("marina-one", "../other/secret.jpg")).toThrow();
});

test("mapping helpers + frozen elevation table", () => {
  expect(floorIdFromNumber(44)).toBe("44f");
  expect(floorLabelFromNumber(44)).toBe("44th Floor");
  expect(floorLabelFromNumber(72)).toBe("72nd Floor");
  // The corrected table — 56→196, 60→210, 64→224, 68→238 (NOT the scrambled map).
  expect(MARINA_ONE_FLOOR_ELEVATION[56]).toBe(196);
  expect(MARINA_ONE_FLOOR_ELEVATION[68]).toBe(238);
});

test("parseTenantConfig applies defaults across the document", () => {
  const minimal = {
    tenant: { slug: "marina-one", name: "Marina One" },
    branding: { appTitle: "One Marina" },
    views: [{ id: "central-sea", label: "Sea View" }],
    times: [{ id: "noon", label: "Day", icon: "sun" }],
    floors: [
      {
        id: "44f",
        label: "44th Floor",
        elevation: 154,
        slots: [{ viewId: "central-sea", timeId: "noon", image: "44f/noon/central-sea.jpg" }],
      },
    ],
  };
  const cfg: TenantConfig = parseTenantConfig(minimal);
  expect(cfg.schemaVersion).toBe(1);
  expect(cfg.version).toBe(1);
  expect(cfg.lead).toBeNull();
  expect(cfg.viewerDefaults.defaultHfov).toBe(90);
  expect(cfg.viewerDefaults.autoRotate).toBe(-2);
  const floor = cfg.floors[0]!;
  const slot = floor.slots[0]!;
  expect(slot.enabled).toBe(true);
  expect(slot.hotspots).toEqual([]);
  expect(floor.order).toBe(0);
  expect(cfg.branding.secondaryLogos).toEqual([]);
});

test("safeParseTenantConfig rejects invalid documents", () => {
  // empty views[] violates .min(1); bad slug; missing branding.appTitle
  const bad = safeParseTenantConfig({
    tenant: { slug: "Bad Slug", name: "x" },
    branding: {},
    views: [],
    times: [],
  });
  expect(bad.success).toBe(false);
});
