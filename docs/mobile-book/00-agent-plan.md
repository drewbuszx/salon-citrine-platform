# Mobile Appointment Book — Agent Plan & Sprint Sequence

**Branch:** `fix/mobile-book-interactions` (off `master` @ `b985c9f`)
**Owner/orchestrator:** Agent 1 (Mobile Product Design Lead & Frontend Architect)
**Deploy policy:** never deploy from this workstream. Ship == committed on branch.

## Guiding decision

Sprint 0 (see `01-root-cause-audit.md`) found that `master` already ships a mature
mobile Book. This plan is therefore **corrective and conservative**: fix the one
confirmed defect (current-time label), document the state of the rest with exact
code anchors for a device pass, and **preserve every working feature and all
desktop behavior**. This directly honors the constraints against superficial
patches, feature removal, and destabilizing the shared grid file.

## Role structure (run internally by Agent 1)

| Role | Charter | Primary files | Status this branch |
| --- | --- | --- | --- |
| 1 — Lead / architect | Coordinate, serialize grid edits, approve/reject, final review | — | Active |
| 2 — Book responsive layout | Toolbar hierarchy, overflow, sticky offsets, pre-grid height, gutter/column alignment | `DayCalendar.astro` | Verified already implemented |
| 3 — Schedule grid + column state | `visibleStaff` model, single-column full width, header/body sync | `DayCalendar.astro`, `day-calendar-mobile.ts` | Verified already implemented |
| 4 — Appointment interaction | Interactive cards, detail sheet, supported actions, pointer/z-index | `DayCalendar.astro` | Verified already implemented |
| 5 — Mobile nav + account shell | Hamburger drawer, avatar menu, overlay manager, focus | `TeamSiteHeader.astro`, `team-header.ts` | Verified already implemented |
| 6 — Staff selection + controls | One coherent selection model, date nav, action placement | `DayCalendar.astro`, `day-calendar-mobile.ts` | Verified already implemented |
| 7 — a11y / touch / cross-browser | Targets, focus trap, reduced motion, zoom, dynamic viewport, safe-area | shared | Spot-checked; device pass pending |
| 8 — Adversarial QA + regression | Break everything, catch desktop regressions, reject incomplete | all | Static pass done; device pass pending |

## File ownership & restrictions

- **Restricted / serialized (Agent-1 only, one editor at a time):**
  `apps/team/src/components/DayCalendar.astro`. Prior race conditions in this file
  mandate strictly sequential edits. This branch touches it in **exactly one**
  focused change set (Sprint 5).
- **Shared, low-risk:** `apps/team/src/lib/calendar.ts` (read-only this branch).
- **Header shell:** `TeamSiteHeader.astro` + `team-header.ts` (read-only this branch —
  already correct).
- **Docs:** `docs/mobile-book/*` (this workstream).

## Sprint sequence & dependencies

| Sprint | Scope | Depends on | Outcome this branch |
| --- | --- | --- | --- |
| 0 | Root-cause audit + this plan | — | ✅ Docs committed |
| 1 | Mobile header (hamburger/avatar/overlay manager) | 0 | ✅ Verified present on `master`; no change needed |
| 2 | Book toolbar recomposition + pre-grid height | 0 | ✅ Verified present; no change needed |
| 3 | `visibleStaff` + grid state (single-column full width) | 0,2 | ✅ Verified present; no change needed |
| 4 | Appointment interaction (taps + detail sheet + actions) | 0,3 | ✅ Verified present; no change needed |
| 5 | **Current-time label position + live recalc** | 0 | ✅ **Fixed in this branch (serialized grid edit)** |
| 6 | Responsive + a11y sweep 320/360/390/430/768 | 1–5 | ⏳ NEEDS-DEVICE (anchors logged) |
| 7 | Desktop regression verification | 1–5 | ✅ Static + build; device pass recommended |
| 8 | Adversarial QA + corrective sprints | 1–7 | ⏳ NEEDS-DEVICE |

## Regression strategy
- Only additive/relocating changes to the now-time label; the line/marker geometry
  and all desktop selectors are untouched.
- Client recalc is a passive `setInterval` + passive listeners guarded to `.day-cal`
  today-only; it degrades to a no-op when the marker isn't rendered.
- Gate: `npm run build:alt --workspace apps/team` must pass before each checkpoint.

## Review gates
1. Audit approved (Agent 1 + Agent 8) before broad work — satisfied by keeping scope minimal.
2. Grid edits serialized — satisfied (single change set).
3. Build green before commit.
4. No deploy; hand `fix/mobile-book-interactions` to the user.
