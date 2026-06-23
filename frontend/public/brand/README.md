# Brand logo

Drop your logo here as **`logo.png`** (this exact path: `frontend/public/brand/logo.png`)
and it is used automatically in the side-nav, landing nav and footer — no code change.

Tips:
- A **transparent-background PNG** looks best (the app background is near-black `#08090A`).
- Roughly **square** (e.g. 256×256 or 512×512). It is rendered with `object-fit: contain`.
- A clean, simple mark reads best at 22–28 px in the nav rail.

If `logo.png` is absent, the app falls back to the built-in almond-eye SVG mark.

The browser-tab favicon is `frontend/src/app/icon.svg` — replace that separately if you
want the tab icon to match.
