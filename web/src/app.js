// ASB Labels — print a Code128 label per ACCEPTED unit on a received shipment.
// Runs embedded in Shopify admin. Direct API access via App Bridge — no backend.

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
async function fetchTransfers() {
  const data = await adminFetch(
    `#graphql
    query RecentTransfersWithShipments {
      inventoryTransfers(first: 25, reverse: true) {
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
    {}
  );
  return data?.inventoryTransfers?.nodes || [];
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
function labelCell(row) {
  const el = document.createElement("div");
  el.className = "label";

  // Left zone: name (wraps to 2 lines) + variant/SKU (wraps to 2 lines).
  const text = document.createElement("div");
  text.className = "text";
  const style = document.createElement("div");
  style.className = "style";
  style.textContent = row.style || "—";
  text.appendChild(style);
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = row.meta || "";
  text.appendChild(meta);
  el.appendChild(text);

  // Right zone: the barcode.
  const wrap = document.createElement("div");
  wrap.className = "barcode";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  wrap.appendChild(svg);
  el.appendChild(wrap);
  JsBarcode(svg, String(row.barcode).trim(), {
    format: "CODE128",
    width: 2,
    height: 48,
    margin: 8,        // quiet zone around the bars — scanners need it
    displayValue: true,
    fontSize: 13,
    textMargin: 2,
  });
  // JsBarcode emits a valid viewBox but ALSO fixed "NNNpx" width/height
  // attributes, which pin the svg to raw pixel size (clipping in the 1.7in
  // zone). Strip them so the viewBox scales the barcode to fit.
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
  shipment: null,      // selected shipment w/ line items
  rows: [],            // [{style, meta, barcode, accepted, qty}]
  message: "",
  error: "",
};

function describeVariant(v) {
  return (v?.selectedOptions || [])
    .filter((o) => o.value && o.value !== "Default Title")
    .map((o) => o.value)
    .join(" · ");
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
    state.transfers = await fetchTransfers();
    state.message = state.transfers.length ? "" : "No transfers found.";
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
      return {
        style: v?.product?.title || li.inventoryItem?.sku || "Unknown item",
        meta: [describeVariant(v), li.inventoryItem?.sku].filter(Boolean).join("  ·  "),
        barcode: (v?.barcode || "").trim(),
        accepted: li.acceptedQuantity,
        qty: li.acceptedQuantity,   // printable count, editable per row
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
  const printable = state.rows.filter((r) => r.qty > 0 && r.barcode);
  printSheet.innerHTML = "";
  for (const row of printable) {
    for (let i = 0; i < row.qty; i++) printSheet.appendChild(labelCell(row));
  }
  window.print();
}

function labelCount() {
  return state.rows.reduce((n, r) => n + (r.barcode ? r.qty : 0), 0);
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
      <div class="status">Labels print from what was <b>accepted</b> on a shipment — items still incoming never print.</div>
      ${list}
      <button class="secondary" data-refresh>Refresh</button>`;
  } else {
    // ---- Line-item table ----
    const tr = rows
      .map(
        (r, i) => `
      <tr>
        <td>${r.style}</td>
        <td>${r.meta || "—"}</td>
        <td class="num">${r.accepted}</td>
        <td class="num"><input type="number" min="0" max="999" value="${r.qty}" data-qty="${i}" ${r.barcode ? "" : "disabled"} /></td>
        <td>${r.barcode ? r.barcode : '<span class="nobarcode">⚠ NO BARCODE</span>'}</td>
      </tr>`
      )
      .join("");
    body = `
      <div class="card">
        <h2>${shipment.name} ${statusBadge(shipment.status)}</h2>
        <table>
          <thead><tr><th>Style</th><th>Variant · SKU</th><th class="num">Accepted</th><th class="num">Print</th><th>Barcode</th></tr></thead>
          <tbody>${tr}</tbody>
        </table>
        <div class="printbar">
          <button data-print ${labelCount() ? "" : "disabled"}>Print ${labelCount()} label${labelCount() === 1 ? "" : "s"}</button>
          <button class="secondary" data-back>← Shipments</button>
          <span class="count">3-1/2 × 1-1/8 in · Code128 · one label per unit</span>
        </div>
      </div>`;
  }

  app.innerHTML = `
    <div class="topbar">
      <h1>Print Received Labels</h1>
      <span class="sub">from accepted shipment quantities — not the transfer</span>
    </div>
    <main>
      ${error ? `<div class="status error">${error}</div>` : ""}
      ${message ? `<div class="status">${message}</div>` : ""}
      ${body}
    </main>`;
}

// Event delegation for the whole app.
app.addEventListener("click", (e) => {
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
app.addEventListener("input", (e) => {
  const qty = e.target.closest("[data-qty]");
  if (qty) state.rows[Number(qty.dataset.qty)].qty = Math.max(0, Number(qty.value) || 0);
});

loadTransfers();
