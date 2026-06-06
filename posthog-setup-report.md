<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Panorama/Vantyx platform. The platform is a Cloudflare Worker monorepo; rather than installing `posthog-node` (which requires Node.js built-ins unavailable in the Workers runtime), the integration extends the project's existing HTTP-based PostHog seam (`worker/src/telemetry.ts`) with two new exports — `captureEvent` and `identifyUser` — that use `ctx.waitUntil()` for reliable fire-after-response delivery.

**Worker-side changes (`worker/src/`):**
- `telemetry.ts` — added `captureEvent()` and `identifyUser()` for server-side capture; extended `handleTelemetry` to accept `type: "identify"` payloads from the client SPAs, forwarding them to PostHog as `$identify` events with `$anon_distinct_id` for cross-session correlation.
- `authRoutes.ts` — `handleLogin`, `handleActivate`, `handleReset`, and `handleInvite` each receive a `ctx: ExecutionContext` parameter and emit capture + identify events on success.
- `config.ts` — `handlePutConfig`, `handlePublish`, and `handleRollback` emit events using the session's email as `distinct_id` (resolved via `currentSession()`).
- `uploads.ts` — `handleUpload` emits `image_uploaded` with floor/time/view slot coordinates.
- `index.ts` — updated all route() call sites to pass `ctx`; added `$exception` capture in the top-level error boundary.

**Admin SPA changes (`apps/admin/src/`):**
- `lib/telemetry.ts` — added `identify(email)` beacon that sends `type: "identify"` to `/api/telemetry`, merging the browser's anonymous `vx_anon` ID with the user's email in PostHog.
- `components/LoginScreen.tsx` — calls `identify(email)` + `track("admin_signed_in")` on successful login.
- `components/ResetScreen.tsx` — calls `track("password_reset_requested")` after a reset link is requested.
- `AdminApp.tsx` — calls `track("draft_saved", { version })` after a draft is successfully saved.
- `App.tsx` — calls `identify(me.email)` on page load when a session is already active, ensuring re-identification across refreshes.

**Environment:**
- `worker/.dev.vars` — `POSTHOG_KEY` and `POSTHOG_HOST` variables added for local development (fill in the real project API key).
- Production: set `POSTHOG_KEY` and `POSTHOG_HOST` as Wrangler secrets (`wrangler secret put POSTHOG_KEY`).

| Event | Description | File |
|-------|-------------|------|
| `user_signed_in` | Admin successfully signs in | `worker/src/authRoutes.ts` |
| `user_account_activated` | New admin activates account via invite link | `worker/src/authRoutes.ts` |
| `user_password_reset` | Admin completes a password reset | `worker/src/authRoutes.ts` |
| `user_invited` | Admin invites a new user to a tenant | `worker/src/authRoutes.ts` |
| `config_published` | Tour draft published to live | `worker/src/config.ts` |
| `config_rolled_back` | Live tour rolled back to previous version | `worker/src/config.ts` |
| `draft_saved` | Draft config saved (server-side) | `worker/src/config.ts` |
| `image_uploaded` | Panorama image uploaded to R2 slot | `worker/src/uploads.ts` |
| `$exception` | Unhandled server error in Worker boundary | `worker/src/index.ts` |
| `admin_signed_in` | Client-side login success + identify | `apps/admin/src/components/LoginScreen.tsx` |
| `draft_saved` | Draft saved (client-side) | `apps/admin/src/AdminApp.tsx` |
| `password_reset_requested` | User requests a password reset link | `apps/admin/src/components/ResetScreen.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/367343/dashboard/1678548)
- [Admin Onboarding Funnel (wizard)](https://us.posthog.com/project/367343/insights/5SHGkUHY) — invite → activation → first sign-in conversion
- [Weekly Active Admins (wizard)](https://us.posthog.com/project/367343/insights/ITlz3Srf) — unique admins signing in per week
- [Publishing Pipeline (wizard)](https://us.posthog.com/project/367343/insights/6TseauHC) — draft saves vs. publishes over time
- [Login to Publish Funnel (wizard)](https://us.posthog.com/project/367343/insights/poz5tdwz) — sign-in → upload → draft → publish conversion
- [Server Exceptions (wizard)](https://us.posthog.com/project/367343/insights/4NV0sM7p) — unhandled Worker errors per day

**Before deploying to production**, set the PostHog key as a Wrangler secret:
```
wrangler secret put POSTHOG_KEY
wrangler secret put POSTHOG_HOST
```

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-javascript_node/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
