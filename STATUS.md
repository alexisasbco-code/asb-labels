# asb-labels — build status

Replacing Yannit with our own Shopify label printer. Print a Code128 label for
each **accepted** unit on a received **shipment** (not the whole transfer).

## Decisions (2026-07-12)
- **Separate app**, not a screen bolted onto `asb-bins`. Bins is POS-only; this
  needs an **Admin** surface — different worlds.
- **Embedded Admin App Home**, delivered as a static bundle on a **free static
  host** (Cloudflare Pages / Netlify / GitHub Pages). Direct API access (session
  token) → no backend, no CORS, no token to manage. Print via `window.print()`
  → macOS dialog → Zebra @ 2×1".
- **Why not the purpose-built Admin Print Action extension?** Two dealbreakers:
  it only attaches to order/product pages (no shipment/transfer target), and its
  print doc must be *static HTML with no scripts* — so JsBarcode can't run in it.
- **Why not POS (like bins)?** POS runs on the iPad; the ZD421 has no AirPrint,
  so a POS surface physically can't reach the Zebra.
- Correction to the original plan: Shopify hosts *extensions* for free, but **not**
  an App Home frontend. A free static deploy closes that gap at $0 cost.

## Label stock (corrected 2026-07-12)
**1-1/8" × 3-1/2"** (3.5in wide × 1.125in tall, landscape) — not 2×1. Prototype
and app print CSS both default to this.

## Label template v2 (2026-07-12, after first in-admin print preview)
Two zones side by side: **text left** (name clamps to 2 lines, variants+SKU
clamp to 2 lines — catalog has long names and 2–3 long variant values),
**barcode right** (fixed 1.7in zone ≈ 15mil Code128 modules — easy scanning).
Root cause of the v1 overlap: JsBarcode emits fixed px width/height and no
viewBox, so CSS stretching distorted it — `labelCell()` now converts to a
viewBox. Keep `label-preview.html` and `web/src/{app.js,styles.css}` in sync.

## Working in dev store ✅ (2026-07-12)
App linked (client_id 50edfaf...), scopes restored + `read_inventory_shipments`
added (missing scopes HIDE fields from the schema — that was the
"inventoryShipments doesn't exist" error). Picker = transfers → shipments;
labels only from shipment acceptedQuantity.

## Done
- ✅ `label-preview.html` — standalone 2×1" Code128 label sheet. Verified in a
  browser: JsBarcode draws, qty expands to one label per unit, blank barcodes are
  flagged, print CSS locks each label to the stock size. **This is the reusable
  label renderer** — the real app wraps Shopify data around `labelCell()`.
- ✅ JsBarcode vendored at `src/vendor/JsBarcode.all.min.js` (offline / CSP-safe).

## Field names — VERIFIED (2026-07 API, via shopify.dev docs)
- `InventoryShipmentLineItem.acceptedQuantity: Int!` ✅ (also `quantity`,
  `rejectedQuantity`, `unreceivedQuantity`)
- Top-level `inventoryShipments` list query exists — no need to walk transfers.
- `InventoryShipment`: `name`, `status`, `dateReceived`, `totalAcceptedQuantity`,
  `lineItemTotalQuantity`, `lineItems` connection.

## App scaffolded (full build, ready for dev store)
- `shopify.app.toml` — embedded, Direct API (online), same scopes as bins.
  No client_id yet; written by first `shopify app dev`.
- `web/` — Vite frontend: `index.html` (App Bridge + api-key injection via
  SHOPIFY_API_KEY env → `%SHOPIFY_API_KEY%`), `src/app.js` (shipment picker →
  line-item table w/ editable print qty → print), `src/styles.css` (print CSS
  locks stock size), `public/vendor/JsBarcode.all.min.js`.
- Verified standalone in a browser: shell renders, no JS errors ("Failed to
  fetch" outside admin is expected — `shopify:` protocol needs App Bridge).

## Next
1. **One-time interactive link (needs Alexis' terminal):**
   `cd ~/Desktop/asb-labels/asb-labels && npm run dev -- --store=asb-bins-dev.myshopify.com`
   → pick org → create as new app "asb-labels" → CLI writes client_id.
   (Non-interactive runs fail on the org prompt — already tried.)
2. Open the app in the dev store admin, verify shipments load, print preview.
3. Dev store (from bins): **asb-bins-dev.myshopify.com** — needs transfers +
   shipments with accepted quantities to test against (create test data if bare).
4. **Deploy** static bundle to free host; set `application_url`.

## Phase 5 (do before trusting a full run)
Print label #1 on the ZD421, scan it with the POS put-away screen, confirm it
reads back. Tune `Bar width` in the prototype if the scanner struggles.
