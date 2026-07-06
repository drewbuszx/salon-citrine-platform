# Takeover note — Jul 6, 2026

## What was wrong

- **Parallel agents, duplicate commits, overlapping sidebar fixes.** Three agents touched the same sidebar CSS within 48 hours. b02789d fixed the root cause; subsequent "fixes" were churn.
- **Boulevard screenshot chasing without a product spine.** Feature gap docs and UX audits multiplied while deploy UX still felt broken.
- **Two accent systems.** Manage nav used purple (`#7c3aed`); list pages used citrine. Team app looked like two products stitched together.
- **Doc sprawl.** DESIGN_SYSTEM, VISION, BOULEVARD_FEATURE_GAP, COMPETITOR_UX_RESEARCH, UX_AUDIT — no hierarchy, no owner.
- **Redeploy theater.** Pushing Workers constantly without a quality gate (`build:alt`, unconstrained SVG grep) meant regressions shipped faster than fixes.

## What we're doing instead

1. **Citrine is the only accent.** Manage layout, waitlist, calendar badges, focus rings — all citrine/stone tokens from `packages/theme/tokens.css`.
2. **One doc hierarchy:** `DESIGN_SYSTEM.md` (visual), `SALON_CITRINE_VISION.md` (product), `BOULEVARD_FEATURE_GAP.md` (competitive reference only).
3. **Three ROI ships this week:** Team Pulse (live counts on dashboard), embed book (`?embed=1` + `EMBED_BOOK.md`), waitlist table polish.
4. **No new sidebar refactors** unless b02789d regresses in production.
5. **Build before push:** `npm run build:alt --workspace apps/team` and `npm run build --workspace apps/web`.

## Drew: stop doing this

- Spawning multiple agents on the same surface (sidebar, nav, Manage layout).
- Writing new vision/design docs before the last one is linked or finished.
- Redeploying Workers without running both builds locally.
- Adding purple or SaaS blue "because Boulevard uses it."

## Drew: verify after deploy

1. **Team dashboard** — Team Pulse strip shows real appointment/waitlist/stock counts with citrine tiles.
2. **Manage → any section** — active nav is citrine left bar, not purple.
3. **Embed** — open `https://book.saloncitrineindy.com/book?embed=1` in an iframe; no marketing header, funnel completes.
4. **Waitlist** — table rows zebra/hover, empty state centered, no purple focus rings.

## Do not touch for one week

- Sidebar architecture (`TeamListLayout`, `team-list-sidebar.css`, `TeamSidebarNav/Filter`) — frozen unless production regression.
- Manage page inventory beyond accent token swap — no hub redesigns.
- New competitor research docs — BOULEVARD_FEATURE_GAP is enough until Phase 2.
