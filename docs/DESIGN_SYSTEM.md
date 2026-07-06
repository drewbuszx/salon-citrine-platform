# Salon Citrine Design System

**Brand promise:** *Warm editorial luxury for people who touch hair for a living — every screen should feel like stepping into the salon, not logging into software.*

---

## Brand story

Salon Citrine sits at the intersection of Aesop's quiet confidence and a working stylist's Saturday morning: cream walls, citrine accents catching the light, dusty rose in the details. We are not Boulevard purple. We are not generic SaaS blue. We are a boutique Indianapolis salon whose digital tools should feel as considered as the space itself — aspirational for guests booking online, calm and legible for stylists on iPad at arm's length during a rush. Restraint is the luxury: generous whitespace, intentional hierarchy, gold where it matters.

**Reference touchstones:** Aesop retail (editorial typography, muted palette), GlossGenius warmth (approachable pro tools), Boulevard structure (list layouts, sidebar filters) — synthesized into something uniquely Citrine.

---

## Color tokens

All tokens live in `packages/theme/tokens.css` and cascade via `@saloncitrine/theme`.

### Core palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-citrine` | `#e7ac46` | Primary actions, active nav, focus rings, brand accent |
| `--color-citrine-dark` | `#c9952e` | Hover states on citrine buttons |
| `--color-citrine-light` | `#f0c872` | Subtle highlights, decorative gradients |
| `--color-citrine-muted` | `rgba(231,172,70,0.12)` | Active tab backgrounds, pulse tiles |
| `--color-cream` | `#f7f2ea` | Page background (booking, marketing) |
| `--color-cream-deep` | `#efe6d8` | Background gradient depth |
| `--color-dusty-rose` | `#ae948f` | Secondary accent, badges, form labels (booking) |
| `--color-sage` | `#8d9e88` | Success, completed steps, calm UI accents |
| `--color-charcoal` | `#3c3d3c` | Secondary buttons, dense text on light |

### Stone neutrals (team UI)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-stone-50` | `#faf9f7` | Table zebra, sidebar bg |
| `--color-stone-100` | `#f3f1ec` | Hover surfaces, card placeholders |
| `--color-stone-200` | `#e8e4dc` | Borders, dividers |
| `--color-stone-300` | `#d4cfc4` | Secondary button borders |
| `--color-stone-500` | `#787068` | Muted text, table headers |
| `--color-stone-700` | `#3c3835` | Body text on team screens |
| `--color-stone-800` | `#2f2a28` | Team top bar background |

### Semantic

| Token | Usage |
|-------|-------|
| `--color-link` / `--color-link-hover` | Table links, inline anchors (warm gold-brown) |
| `--color-focus-ring` | `rgba(231,172,70,0.35)` — all focus states |
| `--color-error` | `#b42318` — form errors, destructive badges |

### Usage rules

- **One accent per view.** Citrine draws the eye; don't compete with sage or rose on the same row.
- **Team bar is stone-800**, not black — warmer, softer against cream pages.
- **Never** use saturated purple (`#7c3aed`) or SaaS blue (`#0096ff`) in Citrine UI.
- **Dark mode** inverts surfaces; citrine stays constant as the brand anchor.

---

## Typography

| Role | Family | Token | Where |
|------|--------|-------|-------|
| Display / headlines | Cormorant Garamond | `--font-display` | Page titles, stat values, booking hero |
| Body / UI | DM Sans | `--font-body` | Team app, forms, tables, nav tabs |
| Marketing nav | Serling Galleria | `--font-nav` | Public site header only |
| Marketing CTAs | Basic Title | `--font-basic-title` | Public site nav labels |
| Labels (legacy) | Oswald | `--font-sans` | Uppercase kicker text on marketing |

### Type scale

| Token | Size | Typical use |
|-------|------|-------------|
| `--text-xs` | 11px | Table headers, stat labels, pulse subtitles |
| `--text-sm` | 13px | Sidebar links, table cells, form hints |
| `--text-base` | 16px | Body default |
| `--text-lg` | 18px | Sub-headers (Clients, Stock) |
| `--text-xl` | 20px | Section titles |
| `--text-2xl` | 24px | Dashboard name |
| `--text-3xl` | 30px | Hero headlines |

**Weights:** 400 body, 500 display, 600 labels and buttons.

**Line heights:** `--leading-tight` (1.2) headlines, `--leading-normal` (1.5) body, `--leading-relaxed` (1.65) long copy.

**Letter-spacing:** Uppercase labels use `--tracking-wide` (0.06em) to `--tracking-widest` (0.14em). Display headlines stay tight.

---

## Spacing rhythm

Built on a **4/8px grid** via `--space-*` tokens:

```
--space-1: 4px    --space-2: 8px    --space-3: 12px
--space-4: 16px   --space-5: 20px   --space-6: 24px
--space-8: 32px   --space-10: 40px  --space-12: 48px
```

**Rules:**
- Section padding: `--section-padding` (clamp 20–40px)
- Card internal padding: `--space-4` to `--space-5`
- Stack gaps: `--space-3` within components, `--space-6` between sections
- Team list sub-header: fixed `min-height: 3.25rem` aligned to top bar

---

## Component patterns

### Buttons

| Variant | Style |
|---------|-------|
| **Primary** | Citrine fill, black text, uppercase DM Sans, `--radius-sm` |
| **Secondary** | Stone-300 outline, transparent bg, darkens on hover |
| **Accent** | Charcoal fill — destructive or secondary-emphasis actions |
| **Ghost** | No border; opacity hover (header links, icon buttons) |

Team list pages use `.team-list-layout__btn-primary` / `__btn-secondary`. Global forms use `.btn-primary` / `.btn-secondary`.

### Tables

- Header row: `--text-xs`, uppercase, `--color-stone-500`, `--color-stone-50` bg
- Zebra: even rows `--color-stone-50`
- Hover: `--color-sage-muted`
- Links: `--color-link` → `--color-link-hover`
- Wrap in `.team-list-layout__table-wrap` with `--radius-md` border

### Cards

- Border: `--color-stone-200`, radius `--radius-md`
- Shadow: `--shadow-sm` default, `--shadow-card-hover` on hover
- Stock product cards: **1:1 aspect ratio** thumb, lift on hover
- Stat cards: editorial tile — display font for values, uppercase label

### Modals

- White/`--color-bg` panel, `--shadow-lg`
- Backdrop: semi-transparent (handled per component)
- Primary action: citrine button, right-aligned

### Navigation

**Team top bar (`TeamSiteHeader`):**
- Stone-800 bar, horizontal scroll tabs
- Active tab: citrine text + muted bg + **2px citrine bottom inset**
- Letter-spacing 0.08em uppercase

**Sidebar (`TeamListLayout`):**
- 3px left border active indicator in citrine
- Stone-50 sidebar bg
- Collapsible filter sections with chevron rotation

### Motion

| Token | Duration | Use |
|-------|----------|-----|
| `--transition-fast` | 0.15s ease | Hovers, focus, chevrons |
| `--transition-base` | 0.2s ease | Cards, dropdowns |
| `--transition-slow` | 0.25s ease | Mobile nav overlay |

**Rules:** Subtle only. No bounce, no slide-in theatrics. Transform `translateY(-1px)` max on card hover. Team Pulse live dot uses a gentle pulse animation — the one exception.

---

## Do / Don't

### Do

- Use citrine sparingly — one primary CTA per screen region
- Keep team UI on DM Sans for iPad readability
- Use cream gradient backgrounds on guest-facing flows
- Give stat numbers room to breathe (display font, large size)
- Maintain consistent sub-header height across list pages

### Don't

- Don't use purple or blue accent colors anywhere in platform UI
- Don't set body text below 13px on team screens
- Don't remove the sidebar left-border active state (regression from b02789d)
- Don't use harsh circular crop on stylist photos — use soft citrine ring
- Don't add drop shadows to every element; reserve for cards and modals

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/theme/tokens.css` | Source of truth for all CSS custom properties |
| `packages/theme/fonts.css` | Google Fonts + licensed local fonts |
| `apps/team/src/styles/global.css` | Team shell, buttons, forms, stat cards, tables |
| `apps/team/src/styles/team-list-sidebar.css` | List layout sidebar, tables, buttons (global) |
| `apps/team/src/components/TeamSiteHeader.astro` | Top bar chrome |
| `apps/team/src/components/TeamListLayout.astro` | List page shell |
| `apps/web/src/styles/global.css` | Booking shell + shared form styles |
| `apps/web/src/components/BookingSteps.astro` | Progress indicator |

---

## Headline

**Salon Citrine — warm gold clarity for stylists, editorial trust for every guest who books.**
