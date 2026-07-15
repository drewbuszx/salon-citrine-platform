# Team app — home-screen install (PWA)

Staff can pin **Salon Citrine Team** to an Android or iPhone home screen so it opens in its own shell (`display: standalone`) with the crystal brand icon.

## Public install URL (use this today)

**https://salon-citrine-team.dbuszx.workers.dev/team/install**

- QR on that page encodes the same URL (generated at build time into `public/icons/install-qr.svg`).
- Sign-in page also links to `/team/install`.

Custom domain `https://team.saloncitrineindy.com` is configured in Astro/`wrangler` docs but **DNS does not resolve today** — do not put that host on printed QR cards until it resolves again.

## What was added

| Piece | Location |
|-------|----------|
| Web App Manifest | `apps/team/public/manifest.webmanifest` — `standalone`, scope `/team/`, start `/team/login` |
| Icons 192 / 512 / maskable / apple-touch 180 | `apps/team/public/icons/` (from crystal source) |
| Apple + theme meta | `apps/team/src/layouts/TeamLayout.astro` |
| Minimal service worker | `apps/team/public/sw.js` (network-only; Android Chrome installability) |
| Install + QR page | `apps/team/src/pages/install.astro` (public, no login) |

Regenerate icons/QR after replacing the crystal source:

```bash
npm run generate:pwa --workspace apps/team
```

## Phone caveats

- **iPhone:** Use **Safari** → Share → **Add to Home Screen**. Chrome on iOS does not provide the same A2HS/standalone install flow.
- **Android:** Use **Chrome** → menu **Install app** / **Add to Home screen**. The native install prompt is not guaranteed on every visit; menu install still works once the manifest + SW are present.
- After install, the shortcut opens at `/team/login` in standalone chrome with the crystal icon.

## Deploy

After merging to `master`:

```bash
npm run build --workspace apps/team
cd apps/team && npx wrangler deploy
```
