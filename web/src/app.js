// ASB Labels — print a Code128 label per ACCEPTED unit on a received shipment.
// Runs embedded in Shopify admin. Direct API access via App Bridge — no backend.

// Shown in the topbar so it's always obvious WHICH deploy the browser loaded
// (GitHub Pages + the admin iframe cache aggressively). Bump on every deploy.
const APP_VERSION = "v6";

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

async function fetchShipmentLines(id) {
  const data = await adminFetch(
    `#graphql
    query ShipmentLabels($id: ID!) {
      inventoryShipment(id: $id) {
        id
        name
        status
        lineItems(first: 250) {
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
                product { title }
              }
            }
          }
        }
      }
    }`,
    {id}
  );
  return data?.inventoryShipment || null;
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
// App state + rendering
// ---------------------------------------------------------------------------
const app = document.getElementById("app");
const printSheet = document.getElementById("print-sheet");

const state = {
  transfers: null,     // null = loading
  search: "",          // transfer search text
  shipment: null,      // selected shipment w/ line items
  rows: [],            // [{style, meta, barcode, accepted, qty, selected}]
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

async function openShipment(id) {
  state.message = "Loading shipment…";
  state.error = "";
  render();
  try {
    const s = await fetchShipmentLines(id);
    const rows = (s?.lineItems?.nodes || []).map((li) => {
      const v = li.inventoryItem?.variant;
      const p = priceInfo(v);
      return {
        style: v?.product?.title || li.inventoryItem?.sku || "Unknown item",
        // Label variant line = color · size only. The SKU/barcode number
        // already prints under the barcode, so don't repeat it here.
        meta: describeVariant(v),
        sku: li.inventoryItem?.sku || "",   // shown in the on-screen table only
        barcode: (v?.barcode || "").trim(),
        price: p.price,
        retail: p.retail,
        accepted: li.acceptedQuantity,
        qty: li.acceptedQuantity,   // printable count, editable per row
        selected: true,             // checkbox: include this row when printing
      };
    });
    state.shipment = s;
    state.rows = rows;
    state.message = "";
  } catch (err) {
    state.error = `Couldn't load shipment: ${err.message}`;
  }
  render();
}

function printLabels() {
  const printable = state.rows.filter((r) => r.selected && r.qty > 0 && r.barcode);
  printSheet.innerHTML = "";
  for (const row of printable) {
    for (let i = 0; i < row.qty; i++) printSheet.appendChild(labelCell(row));
  }
  window.print();
}

function labelCount() {
  return state.rows.reduce((n, r) => n + (r.selected && r.barcode ? r.qty : 0), 0);
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
              return `
        <div class="card">
          <h2>${t.name} ${statusBadge(t.status)}
            <span class="dim" style="font-weight:500">&nbsp; ${t.origin?.name || "?"} → ${t.destination?.name || "?"} · ${fmtDate(t.dateCreated)}</span>
          </h2>
          ${shipRows}
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
    const tr = rows
      .map(
        (r, i) => `
      <tr class="${r.selected ? "" : "unselected"}">
        <td class="chk"><input type="checkbox" data-check="${i}" ${r.selected ? "checked" : ""} /></td>
        <td>${esc(r.style)}</td>
        <td>${esc([r.meta, r.sku].filter(Boolean).join(" · ")) || "—"}</td>
        <td class="num">${r.accepted}</td>
        <td class="num"><input type="number" min="0" max="999" value="${r.qty}" data-qty="${i}" ${r.barcode && r.selected ? "" : "disabled"} /></td>
        <td>${r.barcode ? esc(r.barcode) : '<span class="nobarcode">⚠ NO BARCODE</span>'}</td>
      </tr>`
      )
      .join("");
    body = `
      <div class="card">
        <h2>${esc(shipment.name)} ${statusBadge(shipment.status)}</h2>
        <table>
          <thead><tr>
            <th class="chk"><input type="checkbox" data-checkall ${allSelected ? "checked" : ""} title="Select all / none" /></th>
            <th>Style</th><th>Variant · SKU</th><th class="num">Accepted</th><th class="num">Print</th><th>Barcode</th>
          </tr></thead>
          <tbody>${tr}</tbody>
        </table>
        <div class="printbar">
          <button data-print ${labelCount() ? "" : "disabled"}>Print ${labelCount()} label${labelCount() === 1 ? "" : "s"}</button>
          <button class="secondary" data-back>← Shipments</button>
          <span class="count">${selectedCount} of ${rows.length} items selected · 3-1/2 × 1-1/8 in · Code128</span>
        </div>
      </div>`;
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
  if (e.target.closest("[data-refresh]")) return loadTransfers();
  if (e.target.closest("[data-back]")) {
    state.shipment = null;
    state.rows = [];
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
  if (qty) state.rows[Number(qty.dataset.qty)].qty = Math.max(0, Number(qty.value) || 0);
});

loadTransfers();
