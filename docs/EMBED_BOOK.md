# Embed booking on the marketing site

Salon Citrine booking runs at `https://book.saloncitrineindy.com/book` (Worker: `apps/web`). Embed mode strips marketing chrome so the widget feels native on `saloncitrineindy.com`.

## URL

```
https://book.saloncitrineindy.com/book?embed=1
```

Optional pre-select a stylist:

```
https://book.saloncitrineindy.com/book?embed=1&stylist=jamie-smith
```

`embed=1` is preserved through the funnel (cart → datetime → details → confirm).

## iframe snippet

Add to any page on the marketing site (Astro, WordPress, etc.):

```html
<iframe
  src="https://book.saloncitrineindy.com/book?embed=1"
  title="Book an appointment at Salon Citrine"
  style="width:100%;min-height:720px;border:0;border-radius:8px;background:#f7f2ea;"
  loading="lazy"
  allow="payment *"
></iframe>
```

**Notes:**
- `allow="payment *"` is required for Stripe card collection on the details step.
- Min-height 720px avoids clipping the service picker; increase on mobile if steps feel tight.
- Cream background matches `--color-cream` so the iframe edge blends with the site.

## What embed mode hides

- Marketing `SiteHeader` (logo nav)
- Footer phone line
- Step labels collapse to numbers on narrow viewports (compact progress strip remains)

## What embed mode keeps

- Full booking flow (services → cart → professional → datetime → pay → confirm)
- Citrine brand tokens (cream panel, gold CTAs, dusty rose labels)
- Dark mode via `localStorage.theme` (inherits parent page if same origin only)

## Test locally

```bash
npm run dev --workspace apps/web
# Open http://localhost:4321/book/?embed=1
```
