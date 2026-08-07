# asb-labels — build status

## v9 (2026-08-06) — backstock tags (skis & snowboards)
Big-text tags that replace hand-written masking tape on backstock skis/boards,
printed in the same receive session as the barcode labels (tag + sticker each
pair once). Same 3.5×1.125 stock, no barcode: brand small + year ('27) big on
top, MODEL huge (shrink-to-fit, never wraps), size large below.
- Shipment view gains a collapsed "Backstock tags (N ski/board items) ▸"
  button — only for rows whose productType ends in "Skis"/"Snowboards"
  (excludes Ski Bags/Straps); jackets etc. never show it. Seasonal feature,
  stays out of the way the rest of the year.
- Fields are PARSED GUESSES, all editable before printing: brand = vendor
  minus " Skis/Snowboards"; year = bare 20xx product tag (fallback title);
  size = the cm variant option; model = title minus vendor (incl. slash-chunk
  vendors like SMC/Axis), parentheticals, year, and filler words. Shorten
  model to "BP88" by hand if wanted — no abbreviation dictionary.
- One tag per PAIR: tag qty defaults from the row's Print column, so it
  inherits the accepted−printed delta. No separate printed-memory for tags
  ("Use print counts" re-syncs; tags are cheap to reprint). "+ Add tag" =
  blank manual row (year sticky) for anything the type filter misses.
- fitTagModels() measures offscreen (print sheet is display:none) and MUST
  clear its inline style before window.print().
- Query change: product { title vendor productType tags } — no new scopes.
- Tag template mirrored into label-preview.html ("Backstock tags" checkbox);
  keep in sync with styles.css (.label.tag).
Verified against a stubbed Admin API (parse fields, per-row edit, print 5
tags, add-row, count re-sync, barcode-flow regression). NOT yet printed on
the real Zebra — test one tag before a full run.

## v8 (2026-07-31) — under-printing fixes (T0602 / T0586 incident)
Two shipments (400 & 800 units) under-printed. Root causes + fixes:
1. **`lineItems(first: 250)` silently truncated big shipments** — every line
   past #250 never appeared. Now paginates via `pageInfo` until exhausted.
2. **Repeat receive sessions had no delta** — `acceptedQuantity` is cumulative,
   so reprint sessions showed the full total, and staff hand-computing the
   delta missed items. Now the app remembers labels printed per shipment line
   (localStorage on the printing Mac, ~6-month TTL) and the Print column
   defaults to accepted − already printed. "Forget printed" button resets.
   Caveat: memory is per-browser — print from the same Mac/browser (the one
   wired to the Zebra), and counts record even if the print dialog is
   cancelled (use Forget printed to redo).
3. New **"All N shipments combined"** button per transfer — safety net that
   prints every shipment on a transfer in one table.
4. A barcode JsBarcode can't encode now skips just that row (reported in an
   error banner) instead of aborting the whole print run.
Verified against a stubbed Admin API (300-line shipment → 2 pages, delta
session, forget-reset, combined view).

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

## Label template v3 (2026-07-13, after first Zebra prints)
Stacked layout: name full-width (up to 2 lines) → variant/SKU + price row →
full-width barcode. Fixes long-name clipping (old half-width split starved the
text). Price: reads `price` + `compareAtPrice`; marked down (compareAt > price)
= struck retail + bold price, else price only. Fallback to a legacy "Retail"
variant option if compareAtPrice is empty. "Retail" option excluded from the
variant line. **UNVERIFIED against real data** — connector was down; confirm
whether ASB retail lives in compareAtPrice or the Retail option on first real
print, and consider migrating to compareAtPrice.

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

## DEPLOYED ✅ (2026-07-12)
- **Production URL:** https://alexisasbco-code.github.io/asb-labels/
  (GitHub Pages, repo https://github.com/alexisasbco-code/asb-labels,
  branch main, folder /docs — uploaded via web drag-and-drop, no local git creds)
- `application_url` + `redirect_urls` point there; version "asb-labels-2"
  released via `shopify app deploy --allow-updates`.
- `automatically_update_urls_on_dev = false` — dev sessions must NOT overwrite
  the prod URL (answer NO if the CLI asks to update URLs).
- Direct API pinned to **2026-07** in `adminFetch`. Client_id baked into the
  build via `web/.env` (public value, safe).

## Release process (app updates)
1. Edit code → `npm run build:web` (outputs to repo-root `docs/`)
2. Push `docs/` to GitHub (drag-and-drop upload or `git push` once creds exist)
3. Page updates in ~1 min. `shopify app deploy` only needed for config/scope changes.

## POS tile — single-item reprint (built 2026-07-12, awaiting PrintNode creds)
`extensions/asb-labels-pos/` — scan/type barcode or SKU → variant lookup
(Direct API) → qty stepper → native **ZPL** (Code128, mirrors label layout,
710×228 dots @203dpi) → POST api.printnode.com `raw_base64` → PrintNode client
on the Mac → ZD421. CORS verified open. To finish:
1. Get a dedicated PrintNode API key + the ZD421's numeric printer id
   (PrintNode client must run on the Mac the Zebra is attached to).
2. Paste into the constants at the top of `src/Modal.jsx`, `npm run deploy`.
3. ZPL positions (^FO/^FB/^BY) may need one tuning pass on real stock.

## Remaining
1. Reload app in dev-store admin with `npm run dev` STOPPED — confirms prod hosting.
2. Install on the REAL store: dev.shopify.com dashboard → asb-labels →
   Distribution → Custom distribution → enter store domain → install link.
3. **Zebra test:** print label #1, scan it back (put-away screen). Tune barcode
   zone (`flex: 0 0 1.7in`) if needed.
4. Real catalog: watch for ⚠ NO BARCODE rows (variants missing UPCs).

## Phase 5 (do before trusting a full run)
Print label #1 on the ZD421, scan it with the POS put-away screen, confirm it
reads back. Tune `Bar width` in the prototype if the scanner struggles.
