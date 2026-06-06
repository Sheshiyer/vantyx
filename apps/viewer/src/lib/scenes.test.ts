import { test, expect } from "bun:test";
import { parseTenantConfig } from "@panorama/shared";
import { buildScenes, sceneId, initialSelection, resolveSelection, clamp } from "./scenes";

const config = parseTenantConfig({
  tenant: { slug: "t", name: "T" },
  branding: { appTitle: "T" },
  views: [
    { id: "central-sea", label: "Sea" },
    { id: "stadium", label: "Stadium" },
  ],
  times: [
    { id: "noon", label: "Day" },
    { id: "night", label: "Night" },
  ],
  floors: [
    {
      id: "44f",
      label: "44th",
      order: 1,
      slots: [
        { viewId: "central-sea", timeId: "noon", image: "44f/noon/central-sea.jpg" },
        { viewId: "central-sea", timeId: "night", image: "44f/night/central-sea.jpg" },
        { viewId: "stadium", timeId: "noon", image: "44f/noon/stadium.jpg" },
      ],
    },
    {
      id: "48f",
      label: "48th",
      order: 2,
      slots: [{ viewId: "stadium", timeId: "night", image: "48f/night/stadium.jpg" }],
    },
  ],
});

test("buildScenes maps enabled slots to same-origin /assets URLs", () => {
  const scenes = buildScenes(config);
  expect(Object.keys(scenes).length).toBe(4);
  const s = scenes[sceneId("44f", "central-sea", "noon")]!;
  expect(s.panorama).toBe("/assets/44f/noon/central-sea.jpg");
  expect(s.type).toBe("equirectangular");
  expect(s.hfov).toBe(90); // viewerDefaults.defaultHfov
});

test("initialSelection picks the first enabled slot in floor order", () => {
  expect(initialSelection(config)).toEqual({ floorId: "44f", viewId: "central-sea", timeId: "noon" });
});

test("resolveSelection returns the exact slot when present", () => {
  expect(resolveSelection(config, "44f", "stadium", "noon")).toEqual({
    floorId: "44f",
    viewId: "stadium",
    timeId: "noon",
  });
});

test("resolveSelection keeps the view but changes time when the exact cell is missing", () => {
  expect(resolveSelection(config, "44f", "central-sea", "evening")).toEqual({
    floorId: "44f",
    viewId: "central-sea",
    timeId: "noon",
  });
});

test("resolveSelection falls back to the floor's only slot on a sparse floor", () => {
  expect(resolveSelection(config, "48f", "central-sea", "noon")).toEqual({
    floorId: "48f",
    viewId: "stadium",
    timeId: "night",
  });
});

test("clamp bounds a value", () => {
  expect(clamp(5, 0, 10)).toBe(5);
  expect(clamp(-3, 0, 10)).toBe(0);
  expect(clamp(99, 0, 10)).toBe(10);
});
