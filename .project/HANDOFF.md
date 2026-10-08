# Project handoff

## Checkpoint

- Status: `draft-held`
- Portfolio: `thoughtseed`
- Repository: `panaroma-webapp`
- Registry WorkObject: `sapling:vantyx`
- GitHub: `Sheshiyer/vantyx`

This packet was drafted by the packet-authoring tool from registry and
repository evidence. It has not been reviewed by a human and is not
committed.

## Completed

- Registry WorkObject matched via `sourceInventory`.
- Packet drafted: all six files present.
- 1 field(s) flagged for review — see `.project/CONTEXT.md`.

## Next action

Review this draft packet, resolve any items flagged in the review summary,
commit the six files as a single repository change, and move
`packet_status` to `reviewed-held`. A relocation manifest approval and a
live-apply approval both remain separate, later steps.

## Verification

```bash
bun install
bun run test
git status --short
```

No registry, capsule, relocation, session, Paseo, provider, or deployment
mutation has been performed by drafting this packet.

## 2026-08-16 CLI/CI hardening checkpoint

- Added the CLI workspace to strict root typechecking; the former pull-request workflow is now retired.
- Added deterministic `new-client` dry-run tests with caller-selected output isolation.
- Added a preflight receipt whose sensitive inputs and machine-local paths are redacted.
- Apply-mode transcripts suppress raw provider output and withhold invite response details.
- This checkpoint does not create a tenant, register a domain, deploy, invite users, or activate analytics/email providers.
- Repository issue #1 remains open for separately approved second-tenant onboarding and rollback proof.

## 2026-10-08 Actions retirement checkpoint

GitHub Actions workflow source is removed in this PR. Local `bun run typecheck` and `bun run test` remain the validation commands; `.local-jobs/jobs.json` records opt-in job definitions. No scheduler or listener is installed. Deployments stay manual and separately authorized. The existing held packet and relocation boundaries remain in force.
