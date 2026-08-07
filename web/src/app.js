// ASB Labels — print a Code128 label per ACCEPTED unit on a received shipment.
// Runs embedded in Shopify admin. Direct API access via App Bridge — no backend.

// Shown in the topbar so it's always obvious WHICH deploy the browser loaded
// (GitHub Pages + the admin iframe cache aggressively). Bump on every deploy.
const APP_VERSION = "v9";

// ---------------------------------------------------------------------------
// Shopify Admin API (Direct API access — same helper as the bins app)
// ---------------------------------------------------------------------------
async function adminFetch(query, variables) {
  // Version pinned: field names verified against 2026-07. Bump deliberately.
  const res = await fetch("shopify:admin/api/2026-07/graphql.json", {
    method: "POST",
    body: JSON.stringify({query, variables}),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data;
}

// Recent transfers with their shipments, newest first. Labels always print
// from a SHIPMENT's accepted quantities — the transfer is just context, so
// "still incoming" items never get labels. (Requires read_inventory_transfers
// + read_inventory_shipments; missing scopes HIDE these fields from the schema.)
async function fetchTransfers(searchText) {
  const data = await adminFetch(
    `#graphql
    query RecentTransfersWithShipments($q: String) {
      inventoryTransfers(first: 50, reverse: true, query: $q) {
        nodes {
          id
          name
          status
          dateCreated
          origin { name }
          destination { name }
          shipments(first: 10) {
            nodes {
              id
              name
              status
              dateReceived
              dateCreated
              totalAcceptedQuantity
              lineItemTotalQuantity
            }
          }
        }
      }
    }`,
    {q: searchText || null}
  );
  return data?.inventoryTransfers?.nodes || [];
}

// Search transfers. Server-side query first (reaches past the recent 50);
// if the API's free-text match comes up empty, fall back to fetching recent
// and filtering by name locally so "T0541" still finds "#T0541".
async function searchTransfers(text) {
  const clean = text.replace(/^#/, "").trim();
  const hits = await fetchTransfers(clean);
  if (hits.length) return hits;
  const recent = await fetchTransfers(null);
  const needle = clean.toLowerCase();
  return recent.filter((t) => (t.name || "").toLowerCase().includes(needle));
}

// Fetches ALL line items, following pageInfo across pages. The old single
// `first: 250` call silently dropped every line past #250 — big shipments
// (400–800 units) under-printed with no warning. Returns the shipment with a
// flat `lines` array instead of the raw connection.
async function fetchShipmentLines(id) {
  let shipment = null;
  let after = null;
  do {
    const data = await adminFetch(
      `#graphql
      query ShipmentLabels($id: ID!, $after: String) {
        inventoryShipment(id: $id) {
          id
          name
          status
          lineItems(first: 250, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              quantity
              acceptedQuantity
              rejectedQuantity
              inventoryItem {
                sku
                variant {
                  id
                  title
                  barcode
                  price
                  compareAtPrice
                  selectedOptions { name value }
                  product { title vendor productType tags }
                }
              }
            }
          }
        }
      }`,
      {id, after}
    );
    const s = data?.inventoryShipment;
    if (!s) return shipment;
    if (!shipment) shipment = {id: s.id, name: s.name, status: s.status, lines: []};
    shipment.lines.push(...(s.lineItems?.nodes || []));
    const pi = s.lineItems?.pageInfo;
    after = pi?.hasNextPage ? pi.endCursor : null;
  } while (after);
  return shipment;
}

// ---------------------------------------------------------------------------
// Printed-label memory (localStorage on the label-printing Mac)
// ---------------------------------------------------------------------------
// Shipments get received in several sessions (more boxes arrive days or weeks
// apart) but acceptedQuantity is CUMULATIVE — so "print accepted" would
// re-print everything from earlier sessions. We remember how many labels were
// printed per shipment line so the Print column can default to just the delta:
// accepted − already printed. Lives in localStorage: per-browser, which is
// fine because printing only happens on the Mac wired to the Zebra.
const PRINTED_KEY = "asb-labels:printed:v1";
const PRINTED_TTL_MS = 200 * 24 * 3600 * 1000; // forget lines after ~6 months

function loadPrinted() {
  try {
    return JSON.parse(localStorage.getItem(PRINTED_KEY)) || {};
  } catch {
    return {};
  }
}
function savePrinted(map) {
  try {
    const cutoff = Date.now() - PRINTED_TTL_MS;
    for (const k of Object.keys(map)) {
      if (!map[k] || map[k].t < cutoff) delete map[k];
    }
    localStorage.setItem(PRINTED_KEY, JSON.stringify(map));
  } catch {
    // Storage unavailable (private mode / blocked iframe storage): deltas
    // just won't persist; printing still works.
  }
}
function printedCount(lineId) {
  return loadPrinted()[lineId]?.n || 0;
}
function recordPrinted(rows) {
  const map = loadPrinted();
  for (const r of rows) {
    map[r.lineId] = {n: (map[r.lineId]?.n || 0) + r.qty, t: Date.now()};
  }
  savePrinted(map);
}
function forgetPrinted(rows) {
  const map = loadPrinted();
  for (const r of rows) delete map[r.lineId];
  savePrinted(map);
}

// ---------------------------------------------------------------------------
// Label rendering (same layout as label-preview.html)
// ---------------------------------------------------------------------------
// Layout: title across the full width on top, then a row of
//   [ variant + price stacked, left ] [ barcode, right ].
// Price lives in the left column so it can never be clipped at the right edge;
// the barcode (with its quiet zone) owns the right side.
function labelCell(row) {
  const el = document.createElement("div");
  el.className = "label";

  const style = document.createElement("div");
  style.className = "style";
  style.textContent = row.style || "—";
  el.appendChild(style);

  const body = document.createElement("div");
  body.className = "body";

  // Left column: variant (1 line) then the price block under it.
  const info = document.createElement("div");
  info.className = "info";
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = row.meta || "";
  info.appendChild(meta);

  const price = document.createElement("div");
  price.className = "price";
  if (row.retail) {
    const was = document.createElement("span");
    was.className = "retail";
    was.textContent = money(row.retail);   // struck-through
    price.appendChild(was);
  }
  if (row.price != null) {
    const now = document.createElement("span");
    now.className = "now";
    now.textContent = money(row.price);     // bold
    price.appendChild(now);
  }
  info.appendChild(price);
  body.appendChild(info);

  // Right: barcode.
  const wrap = document.createElement("div");
  wrap.className = "barcode";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  wrap.appendChild(svg);
  body.appendChild(wrap);
  el.appendChild(body);

  JsBarcode(svg, String(row.barcode).trim(), {
    format: "CODE128",
    width: 2,
    height: 40,
    margin: 6,        // quiet zone around the bars — scanners need it
    displayValue: true,
    fontSize: 13,
    textMargin: 2,
  });
  // JsBarcode pins a fixed px width/height; strip so the viewBox scales it.
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  return el;
}

// ---------------------------------------------------------------------------
// Backstock tags (skis & snowboards)
// ---------------------------------------------------------------------------
// Big-text tape replacement for backstock: brand small, MODEL huge, year as
// '27, size large. No barcode, no price — readable across the backstock room.
// Fields are PARSED GUESSES from the catalog and always editable in the UI
// before printing (catalog titles carry filler the tag doesn't want).

// Rows that get a tag: product types like "Flat Skis", "System Skis",
// "Snowboards" — but not "Ski Bags" / "Ski Straps" (they don't END in the
// word) and not apparel.
function isTaggableType(ptype) {
  return /(skis|snowboards)\s*$/i.test(ptype || "");
}

// "K2 Skis" / "Salomon Snowboards" → "K2" / "Salomon".
function brandFromVendor(vendor) {
  return String(vendor || "").replace(/\s+(skis|snowboards)\s*$/i, "").trim();
}

// Model year as '27. Source: a bare "2027" product tag (the shop tags every
// product with its year); fallback to a 20xx in the title.
function yearFromProduct(p) {
  const yrs = (p?.tags || [])
    .map((t) => /^20(\d\d)$/.exec(String(t).trim()))
    .filter(Boolean)
    .map((m) => m[1]);
  if (yrs.length) return `'${yrs.sort().pop()}`;
  const m = /\b20(\d\d)\b/.exec(p?.title || "");
  return m ? `'${m[1]}` : "";
}

// Title → model: strip the vendor prefix, parentheticals ("(EL 4.5 GW
// Bindings)"), the year, and catalog filler words. "Axis Free Team (System
// Binding) Skis Kids 2023" → "Free Team". Right ~90% of the time; the field
// is editable for the rest.
const MODEL_FILLER =
  /\b(skis?|snowboards?|flat|system|w|womens|women's|mens|men's|kids|youth|junior|jr|boys|girls)\b/gi;
function modelFromTitle(title, vendor) {
  let s = String(title || "").replace(/\([^)]*\)/g, " ");
  // Prefix candidates include each slash-chunk: vendor "SMC/Axis" ships
  // titles that start with just "Axis".
  const pres = [vendor, brandFromVendor(vendor)]
    .flatMap((p) => [p, ...String(p || "").split("/")])
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);   // longest match wins
  for (const pre of pres) {
    if (s.toLowerCase().startsWith(pre.toLowerCase())) {
      s = s.slice(pre.length);
      break;
    }
  }
  return s.replace(/\b20\d\d\b/g, " ").replace(MODEL_FILLER, " ")
    .replace(/\s+/g, " ").trim();
}

// Size from the variant: prefer the option that looks like a length
// ("152cm", "119cm (4.5)" → "119cm"), else an option literally named
// size/length. Skis/boards always carry a cm option in this catalog.
function sizeFromVariant(v) {
  const opts = (v?.selectedOptions || []).filter((o) => o.value && !looksLikePrice(o.value));
  const o =
    opts.find((x) => /\d+(\.\d+)?\s*cm\b/i.test(x.value)) ||
    opts.find((x) => /size|length/i.test(x.name || ""));
  const val = (o?.value || "").replace(/\([^)]*\)/g, "").trim();
  return val === "Default Title" ? "" : val;
}

function tagCell(t) {
  const el = document.createElement("div");
  el.className = "label tag";

  const top = document.createElement("div");
  top.className = "tag-top";
  const brand = document.createElement("span");
  brand.className = "tag-brand";
  brand.textContent = t.brand || "";
  const year = document.createElement("span");
  year.className = "tag-year";
  year.textContent = t.year || "";
  top.append(brand, year);
  el.appendChild(top);

  const model = document.createElement("div");
  model.className = "tag-model";
  model.textContent = t.model || "";
  el.appendChild(model);

  const size = document.createElement("div");
  size.className = "tag-size";
  size.textContent = t.size || "";
  el.appendChild(size);
  return el;
}

// Shrink long model names until they fit the stock width. The print sheet is
// display:none on screen, so it's made measurable (offscreen) for the loop —
// the inline style MUST be cleared before window.print() or the print-media
// positioning would break.
function fitTagModels(sheet) {
  sheet.style.cssText = "display:block;position:absolute;left:-9999px;top:0;";
  for (const m of sheet.querySelectorAll(".tag-model")) {
    let pt = 30;
    m.style.fontSize = pt + "pt";
    while (pt > 12 && m.scrollWidth > m.clientWidth + 1) {
      pt -= 2;
      m.style.fontSize = pt + "pt";
    }
  }
  sheet.style.cssText = "";
}

// ---------------------------------------------------------------------------
// App state + rendering
// ---------------------------------------------------------------------------
const app = document.getElementById("app");
const printSheet = document.getElementById("print-sheet");

const state = {
  transfers: null,     // null = loading
  search: "",          // transfer search text
  shipment: null,      // selected shipment w/ line items
  rows: [],            // [{style, meta, barcode, accepted, qty, selected}]
  tags: null,          // backstock tag rows, built on first expand
  tagsOpen: false,     // tags section expanded? (collapsed 9 months a year)
  message: "",
  error: "",
};

// Escape text that gets interpolated into innerHTML (titles come from the catalog).
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Real variant descriptors only (color · size). Excludes "Default Title" and
// any legacy MSRP that some products carry as an option — whether it's the
// option NAME ("Retail") or the VALUE ("Retail: $280.00" / "$280.00"). Price
// belongs in the price block, not the variant line. A money value = has a "$"
// or a .dd decimal; bare sizes like "90mm", "155", "27.5" are kept.
function looksLikePrice(s) {
  return /\$/.test(s) || /\d\.\d{2}\b/.test(s) || /retail/i.test(s);
}
function describeVariant(v) {
  return (v?.selectedOptions || [])
    .filter((o) =>
      o.value &&
      o.value !== "Default Title" &&
      !/retail|price/i.test(o.name) &&
      !looksLikePrice(o.value)
    )
    .map((o) => o.value)
    .join(" · ");
}

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

// Price + markdown for a variant. Source of truth is Shopify's price /
// compareAtPrice. Fallback: a legacy option named "Retail" holding "$xx.xx".
// Marked down = a retail value strictly greater than the selling price.
function priceInfo(v) {
  const price = parseFloat(v?.price);
  let retail = v?.compareAtPrice != null ? parseFloat(v.compareAtPrice) : NaN;
  if (!(retail > 0)) {
    const opt = (v?.selectedOptions || []).find((o) => /retail/i.test(o.name));
    if (opt) {
      const n = parseFloat(String(opt.value).replace(/[^0-9.]/g, ""));
      if (n > 0) retail = n;
    }
  }
  const markedDown = price > 0 && retail > price + 0.001;
  return {
    price: price > 0 ? price : null,
    retail: markedDown ? retail : null,
  };
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {month: "short", day: "numeric"});
}

function statusBadge(s) {
  const cls = s === "RECEIVED" ? "received" : /PARTIAL/i.test(s) ? "partial" : "";
  return `<span class="badge ${cls}">${(s || "").replace(/_/g, " ").toLowerCase()}</span>`;
}

async function loadTransfers() {
  state.transfers = null;
  state.error = "";
  render();
  try {
    state.transfers = state.search
      ? await searchTransfers(state.search)
      : await fetchTransfers(null);
    state.message = state.transfers.length
      ? ""
      : (state.search ? `No transfers matching “${state.search}”.` : "No transfers found.");
  } catch (err) {
    state.transfers = [];
    state.error = `Couldn't load transfers: ${err.message}`;
  }
  render();
}

// One table row per shipment line. Print qty defaults to the DELTA
// (accepted − already printed here) so a second receive session prints only
// what was just scanned — not duplicates of the first session's labels.
function lineToRow(li, shipName) {
  const v = li.inventoryItem?.variant;
  const p = priceInfo(v);
  const accepted = li.acceptedQuantity;
  const printed = printedCount(li.id);
  return {
    lineId: li.id,
    ship: shipName || "",
    style: v?.product?.title || li.inventoryItem?.sku || "Unknown item",
    // Label variant line = color · size only. The SKU/barcode number
    // already prints under the barcode, so don't repeat it here.
    meta: describeVariant(v),
    sku: li.inventoryItem?.sku || "",   // shown in the on-screen table only
    barcode: (v?.barcode || "").trim(),
    price: p.price,
    retail: p.retail,
    accepted,
    printed,
    qty: Math.max(0, accepted - printed),  // editable per row
    selected: true,             // checkbox: include this row when printing
    // Backstock-tag source data (skis & snowboards only).
    taggable: isTaggableType(v?.product?.productType),
    vendor: v?.product?.vendor || "",
    year: yearFromProduct(v?.product),
    size: sizeFromVariant(v),
  };
}

// One editable tag row per taggable shipment line. Tag qty starts at the
// row's Print count — the accepted-minus-printed delta — so repeat receive
// sessions default to tagging only the new pairs. `src` remembers the source
// row so "Use print counts" can re-sync after edits (null = manual row).
function buildTagRows() {
  return state.rows
    .map((r, i) => ({r, i}))
    .filter(({r}) => r.taggable)
    .map(({r, i}) => ({
      src: i,
      brand: brandFromVendor(r.vendor),
      model: modelFromTitle(r.style, r.vendor),
      year: r.year,
      size: r.size,
      qty: r.qty,
    }));
}

async function openShipment(id) {
  state.message = "Loading shipment…";
  state.error = "";
  render();
  try {
    const s = await fetchShipmentLines(id);
    state.shipment = s;
    state.rows = (s?.lines || []).map((li) => lineToRow(li));
    state.tags = null;
    state.tagsOpen = false;
    state.message = "";
  } catch (err) {
    state.error = `Couldn't load shipment: ${err.message}`;
  }
  render();
}

// "All shipments" safety net: one combined table for every shipment on the
// transfer, so nothing is missed when a transfer arrived as several
// shipments. Rows keep their shipment name for the on-screen table.
async function openTransfer(id) {
  const t = (state.transfers || []).find((x) => x.id === id);
  const ships = t?.shipments?.nodes || [];
  state.message = `Loading ${ships.length} shipment${ships.length === 1 ? "" : "s"}…`;
  state.error = "";
  render();
  try {
    const rows = [];
    for (const sh of ships) {
      const s = await fetchShipmentLines(sh.id);
      for (const li of s?.lines || []) rows.push(lineToRow(li, s.name));
    }
    state.shipment = {name: `${t?.name || "Transfer"} — all shipments`, status: t?.status || ""};
    state.rows = rows;
    state.tags = null;
    state.tagsOpen = false;
    state.message = "";
  } catch (err) {
    state.error = `Couldn't load transfer: ${err.message}`;
  }
  render();
}

function printLabels() {
  const printable = state.rows.filter((r) => r.selected && r.qty > 0 && r.barcode);
  printSheet.innerHTML = "";
  const bad = [];
  for (const row of printable) {
    try {
      // Render the first label OUTSIDE the per-unit loop so a barcode
      // JsBarcode can't encode skips just that row (and gets reported)
      // instead of aborting the whole print run mid-sheet.
      const first = labelCell(row);
      printSheet.appendChild(first);
      for (let i = 1; i < row.qty; i++) printSheet.appendChild(labelCell(row));
    } catch (err) {
      bad.push(row);
      continue;
    }
  }
  const ok = printable.filter((r) => !bad.includes(r));
  const total = ok.reduce((n, r) => n + r.qty, 0);  // before qty resets to the new delta
  recordPrinted(ok);   // remember so next session's default is just the delta
  for (const r of ok) {
    r.printed = printedCount(r.lineId);
    r.qty = Math.max(0, r.accepted - r.printed);  // table now shows the new delta
  }
  window.print();
  state.message = `Sent ${total} label${total === 1 ? "" : "s"} (${ok.length} item${ok.length === 1 ? "" : "s"}) to the printer.`;
  state.error = bad.length
    ? `⚠ ${bad.length} item${bad.length === 1 ? "" : "s"} SKIPPED — barcode couldn't be encoded: ${bad.map((r) => r.sku || r.style).join(", ")}`
    : "";
  render();
}

function labelCount() {
  return state.rows.reduce((n, r) => n + (r.selected && r.barcode ? r.qty : 0), 0);
}

function tagCount() {
  return (state.tags || []).reduce((n, t) => n + t.qty, 0);
}

// One tag per PAIR (a shipment unit = one pair of skis / one board), so no
// per-unit expansion beyond qty. No printed-memory here: tag qty inherits the
// delta by defaulting from the Print column, and tags are cheap to reprint.
function printTags() {
  const printable = (state.tags || []).filter(
    (t) => t.qty > 0 && (t.model || t.brand || t.size)
  );
  printSheet.innerHTML = "";
  for (const t of printable) {
    for (let i = 0; i < t.qty; i++) printSheet.appendChild(tagCell(t));
  }
  fitTagModels(printSheet);
  window.print();
  const total = printable.reduce((n, t) => n + t.qty, 0);
  state.message = `Sent ${total} backstock tag${total === 1 ? "" : "s"} to the printer.`;
  state.error = "";
  render();
}

// Backstock tags section, under the barcode table. Collapsed to one button
// (backstock taping is seasonal — early fall + closeout, otherwise noise).
// Only appears when the shipment actually has skis/boards on it.
function tagsSection(rows) {
  const taggable = rows.filter((r) => r.taggable).length;
  if (!taggable && !(state.tags || []).length) return "";
  if (!state.tagsOpen) {
    return `<button class="secondary" data-tagstoggle>Backstock tags (${taggable} ski/board item${taggable === 1 ? "" : "s"}) ▸</button>`;
  }
  const tr = (state.tags || [])
    .map(
      (t, i) => `
      <tr>
        <td><input type="text" class="tag-in brand" data-tagfield="brand" data-tagidx="${i}" value="${esc(t.brand)}" /></td>
        <td><input type="text" class="tag-in model" data-tagfield="model" data-tagidx="${i}" value="${esc(t.model)}" /></td>
        <td><input type="text" class="tag-in year" data-tagfield="year" data-tagidx="${i}" value="${esc(t.year)}" placeholder="'27" /></td>
        <td><input type="text" class="tag-in size" data-tagfield="size" data-tagidx="${i}" value="${esc(t.size)}" /></td>
        <td class="num"><input type="number" min="0" max="999" value="${t.qty}" data-tagqty="${i}" /></td>
      </tr>`
    )
    .join("");
  const n = tagCount();
  return `
    <div class="card">
      <h2>Backstock tags <button class="secondary tags-collapse" data-tagstoggle>▴ hide</button></h2>
      <div class="status">Big-text tape replacement — one tag per <b>pair</b>. Fields are parsed guesses: fix the model here (or shorten it — “BP88” prints just as big). Tag counts started from the Print column.</div>
      <table>
        <thead><tr>
          <th>Brand</th><th>Model</th><th>Year</th><th>Size</th><th class="num">Tags</th>
        </tr></thead>
        <tbody>${tr}</tbody>
      </table>
      <div class="printbar">
        <button data-printtags ${n ? "" : "disabled"}>Print ${n} tag${n === 1 ? "" : "s"}</button>
        <button class="secondary" data-tagadd>+ Add tag</button>
        <button class="secondary" data-tagsync title="Reset every tag count to its row's current Print count">Use print counts</button>
        <span class="count">same 3-1/2 × 1-1/8 in stock · no barcode</span>
      </div>
    </div>`;
}

function render() {
  const {transfers, shipment, rows, message, error} = state;

  let body = "";
  if (!shipment) {
    // ---- Transfer → shipment picker ----
    // One card per transfer; its shipments are the clickable (printable) rows.
    const list =
      transfers === null
        ? `<div class="status">Loading transfers…</div>`
        : transfers
            .map((t) => {
              const ships = t.shipments?.nodes || [];
              const shipRows = ships.length
                ? ships
                    .map(
                      (s) => `
            <button class="shipment-row" data-open="${s.id}">
              <span class="name">${s.name}</span>
              ${statusBadge(s.status)}
              <span class="dim">${fmtDate(s.dateReceived || s.dateCreated)}</span>
              <span class="dim">${s.totalAcceptedQuantity}/${s.lineItemTotalQuantity} accepted</span>
            </button>`
                    )
                    .join("")
                : `<div class="status">Nothing received yet — labels print once a shipment is received.</div>`;
              const allBtn =
                ships.length > 1
                  ? `<button class="secondary allships" data-opentransfer="${t.id}">All ${ships.length} shipments combined</button>`
                  : "";
              return `
        <div class="card">
          <h2>${t.name} ${statusBadge(t.status)}
            <span class="dim" style="font-weight:500">&nbsp; ${t.origin?.name || "?"} → ${t.destination?.name || "?"} · ${fmtDate(t.dateCreated)}</span>
          </h2>
          ${shipRows}
          ${allBtn}
        </div>`;
            })
            .join("");
    body = `
      <form class="searchbar" data-searchform>
        <input id="tsearch" type="search" placeholder="Search transfer # (e.g. T0541)" value="${esc(state.search)}" />
        <button type="submit">Search</button>
        ${state.search ? `<button type="button" class="secondary" data-clearsearch>Clear</button>` : ""}
      </form>
      <div class="status">Labels print from what was <b>accepted</b> on a shipment — items still incoming never print.</div>
      ${list}
      <button class="secondary" data-refresh>Refresh</button>`;
  } else {
    // ---- Line-item table (checkbox column: print only what's selected) ----
    const allSelected = rows.length > 0 && rows.every((r) => r.selected);
    const selectedCount = rows.filter((r) => r.selected).length;
    const showShip = rows.some((r) => r.ship);   // combined all-shipments view
    const anyPrinted = rows.some((r) => r.printed > 0);
    const tr = rows
      .map(
        (r, i) => `
      <tr class="${r.selected ? "" : "unselected"}">
        <td class="chk"><input type="checkbox" data-check="${i}" ${r.selected ? "checked" : ""} /></td>
        <td>${esc(r.style)}</td>
        <td>${esc([showShip ? r.ship : "", r.meta, r.sku].filter(Boolean).join(" · ")) || "—"}</td>
        <td class="num">${r.accepted}</td>
        <td class="num${r.printed ? "" : " dim"}">${r.printed}</td>
        <td class="num"><input type="number" min="0" max="999" value="${r.qty}" data-qty="${i}" ${r.barcode && r.selected ? "" : "disabled"} /></td>
        <td>${r.barcode ? esc(r.barcode) : '<span class="nobarcode">⚠ NO BARCODE</span>'}</td>
      </tr>`
      )
      .join("");
    body = `
      <div class="card">
        <h2>${esc(shipment.name)} ${statusBadge(shipment.status)}</h2>
        ${anyPrinted ? `<div class="status">Print counts default to <b>accepted − already printed</b>, so a repeat receive session only prints the new units. Use “Forget printed” to reprint everything.</div>` : ""}
        <table>
          <thead><tr>
            <th class="chk"><input type="checkbox" data-checkall ${allSelected ? "checked" : ""} title="Select all / none" /></th>
            <th>Style</th><th>${showShip ? "Shipment · " : ""}Variant · SKU</th><th class="num">Accepted</th><th class="num">Printed</th><th class="num">Print</th><th>Barcode</th>
          </tr></thead>
          <tbody>${tr}</tbody>
        </table>
        <div class="printbar">
          <button data-print ${labelCount() ? "" : "disabled"}>Print ${labelCount()} label${labelCount() === 1 ? "" : "s"}</button>
          <button class="secondary" data-back>← Shipments</button>
          ${anyPrinted ? `<button class="secondary" data-resetprinted title="Clear the printed-label memory for these rows so Print resets to the full accepted count">Forget printed</button>` : ""}
          <span class="count">${selectedCount} of ${rows.length} items selected · 3-1/2 × 1-1/8 in · Code128</span>
        </div>
      </div>
      ${tagsSection(rows)}`;
  }

  app.innerHTML = `
    <div class="topbar">
      <h1>Print Received Labels</h1>
      <span class="sub">from accepted shipment quantities — not the transfer</span>
      <span class="version">${APP_VERSION}</span>
    </div>
    <main>
      ${error ? `<div class="status error">${error}</div>` : ""}
      ${message ? `<div class="status">${message}</div>` : ""}
      ${body}
    </main>`;
}

// Event delegation for the whole app.
app.addEventListener("click", (e) => {
  const check = e.target.closest("[data-check]");
  if (check) {
    state.rows[Number(check.dataset.check)].selected = check.checked;
    render();
    return;
  }
  const checkAll = e.target.closest("[data-checkall]");
  if (checkAll) {
    const on = checkAll.checked;
    state.rows.forEach((r) => { r.selected = on; });
    render();
    return;
  }
  if (e.target.closest("[data-clearsearch]")) {
    state.search = "";
    return loadTransfers();
  }
  const open = e.target.closest("[data-open]");
  if (open) return openShipment(open.dataset.open);
  const openAll = e.target.closest("[data-opentransfer]");
  if (openAll) return openTransfer(openAll.dataset.opentransfer);
  if (e.target.closest("[data-resetprinted]")) {
    forgetPrinted(state.rows);
    state.rows.forEach((r) => {
      r.printed = 0;
      r.qty = r.accepted;
    });
    render();
    return;
  }
  if (e.target.closest("[data-tagstoggle]")) {
    state.tagsOpen = !state.tagsOpen;
    if (state.tagsOpen && !state.tags) state.tags = buildTagRows();
    render();
    return;
  }
  if (e.target.closest("[data-tagadd]")) {
    // Blank manual row — covers anything the type filter missed. Year is
    // sticky from the rows above (it's '27 for weeks at a time).
    state.tags = state.tags || [];
    state.tags.push({
      src: null, brand: "", model: "",
      year: state.tags.find((t) => t.year)?.year || "",
      size: "", qty: 1,
    });
    render();
    return;
  }
  if (e.target.closest("[data-tagsync]")) {
    for (const t of state.tags || []) {
      if (t.src != null && state.rows[t.src]) t.qty = state.rows[t.src].qty;
    }
    render();
    return;
  }
  if (e.target.closest("[data-printtags]")) return printTags();
  if (e.target.closest("[data-refresh]")) return loadTransfers();
  if (e.target.closest("[data-back]")) {
    state.shipment = null;
    state.rows = [];
    state.tags = null;
    state.tagsOpen = false;
    render();
    return;
  }
  if (e.target.closest("[data-print]")) return printLabels();
});
// Search submits on Enter or the Search button.
app.addEventListener("submit", (e) => {
  if (e.target.closest("[data-searchform]")) {
    e.preventDefault();
    state.search = (document.getElementById("tsearch")?.value || "").trim();
    loadTransfers();
  }
});
app.addEventListener("input", (e) => {
  const qty = e.target.closest("[data-qty]");
  if (qty) {
    state.rows[Number(qty.dataset.qty)].qty = Math.max(0, Number(qty.value) || 0);
    // Refresh the print button in place (a full render() would steal focus
    // from the input mid-typing).
    const btn = app.querySelector("[data-print]");
    if (btn) {
      const n = labelCount();
      btn.textContent = `Print ${n} label${n === 1 ? "" : "s"}`;
      btn.disabled = !n;
    }
    return;
  }
  // Tag edits update state in place (no render — it would steal focus).
  const tf = e.target.closest("[data-tagfield]");
  if (tf) {
    state.tags[Number(tf.dataset.tagidx)][tf.dataset.tagfield] = tf.value;
    return;
  }
  const tq = e.target.closest("[data-tagqty]");
  if (tq) {
    state.tags[Number(tq.dataset.tagqty)].qty = Math.max(0, Number(tq.value) || 0);
    const btn = app.querySelector("[data-printtags]");
    if (btn) {
      const n = tagCount();
      btn.textContent = `Print ${n} tag${n === 1 ? "" : "s"}`;
      btn.disabled = !n;
    }
  }
});

loadTransfers();
