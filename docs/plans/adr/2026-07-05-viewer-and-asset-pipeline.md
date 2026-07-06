# ADR: Co-Author Funnel — Viewer Model & Asset Pipeline

**Date:** 2026-07-05 (revised 2026-07-06 — reconciled with M1)
**Status:** Accepted
**Scope:** Property Co-Author funnel, M0 (contracts) → M1 (customization UI)

## Context

The Property Co-Author funnel needs a customization experience where a buyer
picks finish/palette/flooring options for one Kodigehalli villa unit and sees
the result immediately. The existing Vantyx platform ships a **Pannellum**
360° image viewer (`apps/viewer/src/lib/pannellumLoader.ts`,
`apps/viewer/src/types/pannellum.d.ts`) driven by a pre-rendered
`views × times × floors.slots` matrix (`packages/shared/src/schema.ts:43-68`).
That viewer was the only rendering technology in the codebase when this ADR
was first drafted, so the initial draft scoped customization as pre-baked
image-variant selection on top of it.

The M1 client-pitch demo plan
(`ratandevelopers/.docs/plans/2026-07-05-coauthor-m1-possibilities-demo.md`),
written the same day for the same funnel, independently specified a
client-side **React Three Fiber (three.js)** live 3D configurator as its
centerpiece showcase beat — "a material swap updates the 3D instantly." The
two documents disagreed on the single most consequential decision for the
funnel's customization step. This revision reconciles them.

## Decision A — Customization rendering model

The existing Pannellum viewer is **unchanged** and continues to serve the
non-customizable marketing panoramas (walkthrough views, floor/time
selection) via the existing slot matrix.

The **customization step is a client-side React Three Fiber live 3D scene**,
one villa unit, rendering entirely in the buyer's browser — matching the
approach validated by the M1 demo.

- **Accepted:** R3F for real-time material swaps. The no-render-farm
  constraint (from the earlier product council review) is satisfied because
  all rendering happens client-side — there is no server-side GPU cost. The
  instant material swap is the funnel's core differentiator; a pre-baked
  image matrix cannot deliver that feel.
- **Rejected:** curated pre-baked image-variant selection for the
  *customizable* villa. It would require combinatorial R2 asset generation
  per finish × palette × flooring combination and loses the live-swap feel
  that makes the pitch land. Image variants remain the right model for the
  fixed marketing panoramas, which stay out of scope for the funnel.

## Decision B — Combinatorics guardrail

The guardrail moves from "image variant count" to "3D asset weight," carried
over from M1's Global Constraints so M0 and M1 share one rendering contract:

- One villa unit.
- 3–5 curated starter packs (`StarterPack` contract, Task 1).
- ≤ 3 swappable axes (finish, palette, flooring), ≤ 4 options each — bounds
  enforced in villa config, not in the schema.
- Options map to three.js material properties (`color`, `roughness`,
  `metalness`), not to baked images.
- Draco-compressed glTF, or procedural-geometry fallback when no model is
  authored yet, keeps payload size small.
- Texture atlases ≤ 1024²; instanced furniture; `dpr={[1, 2]}` cap.
- A still-image low-power fallback when `navigator.hardwareConcurrency <= 4`.

Free-form/unbounded options remain out of scope.

## Decision C — Data-model extension path (for M1, recorded now)

A customization axis still mirrors `AxisItemSchema`'s shape (`axis`/`id`/
`label`) but resolves to three.js material properties via a mapping table
(mirrors M1's `useMaterialSwap`), not to a pre-rendered image slot — there is
no `viewId`/`timeId` slot resolution for the customizable villa.

Production still needs a `TenantConfig` migration in M1-real to carry the
villa's `modelUrl` and axis config (downstream dependency, not done in M0).
The migration is smaller than originally scoped: one config blob, not a
slot-image matrix. The existing Pannellum `views × times × floors.slots`
matrix in `schema.ts` is untouched by this decision.

## Consequences

- M0's contracts (`packages/shared/src/funnel.ts`, Task 1) stay
  renderer-agnostic — `CustomizationOption`/`StarterPack` encode
  axis/id/label/price only, so this decision doesn't change their shape.
- The M1-real production build (as opposed to the throwaway pitch demo)
  picks up an R3F dependency (`three`, `@react-three/fiber`,
  `@react-three/drei`) it would not have needed under the original,
  pre-baked-image plan.
- The `TenantConfig` migration deferred to M1-real is scoped to villa
  config (`modelUrl`, axes, starter packs), not image-slot references.
