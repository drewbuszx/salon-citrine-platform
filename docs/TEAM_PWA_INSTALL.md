# Team app — home-screen install (PWA)

Staff can pin **Salon Citrine Team** to an Android or iPhone home screen so it opens in its own shell (`display: standalone`) with the crystal brand icon.

## Public install URL

**https://team.saloncitrineindy.com/team/install**

- QR on that page encodes the same URL (generated at build time into `public/icons/install-qr.svg`).
- Sign-in page links to `/team/install` and the [staff quick start](https://team.saloncitrineindy.com/team/staff-guide).
- One-pager doc: [employee-platform/STAFF_ONE_PAGER.md](./employee-platform/STAFF_ONE_PAGER.md).

**Fallback:** https://salon-citrine-team.dbuszx.workers.dev/team/install (same Worker).

## What was added

| Piece | Location |
|-------|----------|
| Web App Manifest | `apps/team/public/manifest.webmanifest` — `standalone`, scope `/team/`, start `/team/login` |
| Icons 192 / 512 / maskable / apple-touch 180 | `apps/team/public/icons/` (from crystal source) |
| Apple + theme meta | `apps/team/src/layouts/TeamLayout.astro` |
| Minimal service worker | `apps/team/public/sw.js` (network-only; Android Chrome installability) |
| Install + QR page | `apps/team/src/pages/install.astro` (public, no login) |
| Staff quick start | `apps/team/src/pages/staff-guide.astro` (public) |

Regenerate icons/QR after replacing the crystal source or changing the install origin:

```bash
npm run generate:pwa --workspace apps/team
```

Canonical origin is set in `apps/team/src/lib/pwa-install.ts` and `apps/team/scripts/generate-pwa-assets.mjs` (`team.saloncitrineindy.com`).

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

Custom domain is declared in `apps/team/wrangler.toml` (`routes` + `custom_domain = true` for `team.saloncitrineindy.com`).
