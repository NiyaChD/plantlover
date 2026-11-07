# PlantLover

A clickable prototype of PlantLover, a plant care app with a virtual garden. It runs in the phone's browser and can be added to the home screen, where it opens full screen with its own icon, like an installed app.

**Open it:** https://niyachd.github.io/plantlover/

## Put it on your phone
- **iPhone (Safari):** open the link → Share → *Add to Home Screen*.
- **Android (Chrome):** open the link → ⋮ menu → *Add to Home screen* / *Install app*.

## Demo login
`demo@plantlover.app` / `plants2026`, or create your own account with Sign up.
In Forgot password, the prototype code is **48213**.

## Real plant identification (Pl@ntNet)
"Add a plant" can identify the photo for real with the free [Pl@ntNet API](https://my.plantnet.org).
1. Create a free account at https://my.plantnet.org and open your API key settings.
2. Tick **expose my API key** and add `https://niyachd.github.io` under **Authorized domains**.
3. Put the key in `config.js` (`plantnetKey: '...'`) and commit.

Without a key the app shows a demo result (Moth orchid), as in the design prototype.

## Good to know
- Everything (accounts, plants, watering, wish list, photos) is saved only on that phone, in the browser. Nothing is sent to a server.
- To start fresh for a new test participant, use a private/incognito tab, or clear the site data.

## Publish with GitHub Pages
Settings → Pages → *Deploy from a branch* → `main` / `(root)` → Save. The site is live a minute later.

## Files
- `index.html`, `app.js` — the app shell and a small runtime that renders the screens
- `screens.js` — all 17 screens (generated from the design prototype)
- `preact.min.js` — [Preact](https://preactjs.com) 10.24.3 (MIT, see `PREACT-LICENSE.txt`)
- `manifest.webmanifest`, `sw.js`, `icons/` — home-screen install and offline support
