# Landing media — animating the stills

The landing sections render the gpt-image-2 **stills** in `public/media/*.png` as `<video poster>`s.
To upgrade a section to motion, animate its still → an `.mp4` of the **same name** and drop it in
`public/media/`. No code change — the video autoplays over the poster.

## Files

| Section | Still (poster) | Drop the video here | Aspect |
|---------|----------------|---------------------|--------|
| Hero background | `public/media/hero.png` | `public/media/hero.mp4` | 16:9 |
| Featured ("our approach") | `public/media/featured.png` | `public/media/featured.mp4` | 16:9 |
| Philosophy (Living × Vantage) | `public/media/philosophy.png` | `public/media/philosophy.mp4` | 4:3 |
| Service card 1 (Experience) | `public/media/experience.png` | `public/media/experience.mp4` | 16:9 |
| Service card 2 (Platform) | `public/media/platform.png` | `public/media/platform.mp4` | 16:9 |

## Grok Imagine prompts (image → video)

Keep motion **subtle** — these are backgrounds; heavy motion distracts. Aim for slow, loopable, no
camera shake.

- **hero** — *Slow, subtle cinematic push-in. Warm golden light drifts almost imperceptibly across the city skyline; distant clouds move slowly; faint reflections shift on the glass. Calm, premium, loopable.*
- **featured** — *Gentle slow parallax across the unfinished concrete floor toward the skyline. Dusk light deepens slightly; a few distant windows flicker on. Atmospheric, minimal motion, loopable.*
- **philosophy** — *Slow time-of-day shift across the skyline: warm gold near the horizon easing toward deeper blue above; soft movement in the reflections. Contemplative, very slow, loopable.*
- **experience** — *Slow smooth pan along the curved floor-to-ceiling window, revealing more of the panoramic skyline; golden light shimmers gently on the glass. Immersive, steady, loopable.*
- **platform** — *Camera slowly tilts up the glass tower; interior lights switch on floor by floor; the sky deepens toward indigo twilight. Confident, minimal, smooth, loopable.*

## Ship it

After dropping the `.mp4`(s):

```bash
cd /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/Panaroma-Webapp
bash scripts/build-deploy.sh && (cd worker && bunx wrangler deploy)
```

Then commit the new media. (`mp4` files aren't gitignored — they'll be tracked; keep them reasonably
sized, ideally < ~5 MB each for fast loads.)
