import "@shopify/ui-extensions/preact";
import {render} from 'preact';
import {useState, useEffect, useCallback, useRef} from 'preact/hooks';

// ---------------------------------------------------------------------------
// PrintNode config — the relay that gets a job from the iPad to the Zebra.
//   iPad → api.printnode.com → PrintNode client on the always-on Mac → ZD421.
// Fill these in and redeploy (`npm run deploy`). The API key is visible to
// staff devices; use a dedicated key that can only print.
// ---------------------------------------------------------------------------
const PRINTNODE_API_KEY = "";   // <- PrintNode API key
const PRINTNODE_PRINTER_ID = 0; // <- numeric printer id of the ZD421

// ---------------------------------------------------------------------------
// Shopify Admin API (Direct API access — same helper as the bins app)
// ---------------------------------------------------------------------------
async function adminFetch(query, variables) {
  const res = await fetch('shopify:admin/api/2026-07/graphql.json', {
    method: 'POST',
    body: JSON.stringify({query, variables}),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data;
}

// Look up a variant by barcode or SKU (scan the shelf tag or the product tag).
async function findVariant(code) {
  const data = await adminFetch(
    `#graphql
    query FindVariant($q: String!) {
      productVariants(first: 5, query: $q) {
        nodes {
          id
          title
          sku
          barcode
          selectedOptions { name value }
          product { title }
        }
      }
    }`,
    {q: `barcode:${code} OR sku:${code}`}
  );
  const nodes = data?.productVariants?.nodes || [];
  // Exact match wins (the query filter is fuzzy on some shops).
  return (
    nodes.find((v) => v.barcode === code) ||
    nodes.find((v) => v.sku === code) ||
    nodes[0] ||
    null
  );
}

// ---------------------------------------------------------------------------
// ZPL — the ZD421 draws the label itself. Mirrors the admin app's layout:
// text left (2-line name + variant/SKU), Code128 right. 203dpi, 3.5×1.125in
// stock = 710×228 dots.
// ---------------------------------------------------------------------------
function zplEscape(s) {
  // ^ ~ and backslash are ZPL control chars; strip rather than risk a
  // runaway command. Also collapse whitespace.
  return String(s || '').replace(/[\^~\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildZpl({title, meta, barcode, copies}) {
  return [
    '^XA',
    '^CI28',                 // UTF-8 text
    '^PW710',                // print width: 3.5in @ 203dpi
    '^LL228',                // label length: 1.125in @ 203dpi
    '^LH0,0',
    // Product name — up to 2 lines in a 380-dot-wide block.
    '^CF0,32,32',
    `^FO16,26^FB380,2,2,L,0^FD${zplEscape(title)}^FS`,
    // Variant / SKU — up to 2 lines, smaller.
    '^CF0,22,22',
    `^FO16,110^FB380,2,2,L,0^FD${zplEscape(meta)}^FS`,
    // Code128, right zone. BY2 = 2-dot modules (~10mil). Interpretation line on.
    '^BY2,3,120',
    `^FO420,34^BCN,120,Y,N,N^FD${zplEscape(barcode)}^FS`,
    `^PQ${Math.max(1, copies | 0)}`,   // copies
    '^XZ',
  ].join('\n');
}

// Send raw ZPL through PrintNode to the Zebra.
async function printViaPrintNode(zpl, jobTitle) {
  const res = await fetch('https://api.printnode.com/printjobs', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${PRINTNODE_API_KEY}:`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      printerId: PRINTNODE_PRINTER_ID,
      title: jobTitle,
      contentType: 'raw_base64',
      content: btoa(unescape(encodeURIComponent(zpl))),  // utf8-safe base64
      source: 'asb-labels-pos',
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`PrintNode ${res.status}: ${body.slice(0, 140)}`);
  }
  return res.json(); // job id
}

// ---------------------------------------------------------------------------
// UI — scan an item, pick a quantity, print.
// ---------------------------------------------------------------------------
export default async () => {
  render(<App />, document.body);
};

function describe(variant) {
  return (variant?.selectedOptions || [])
    .filter((o) => o.value && o.value !== 'Default Title')
    .map((o) => o.value)
    .join(' · ');
}

function App() {
  const configured = PRINTNODE_API_KEY && PRINTNODE_PRINTER_ID;

  const [item, setItem] = useState(null);
  const [input, setInput] = useState('');
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Scan an item (or type its barcode/SKU).');
  const [hasCamera, setHasCamera] = useState(false);
  const [hasHardware, setHasHardware] = useState(false);

  const route = useCallback(async (value) => {
    const raw = (value || '').trim();
    if (!raw) return;
    try { shopify.scanner.hideCameraScanner(); } catch (e) {}
    setBusy(true);
    setMessage(`Looking up ${raw}…`);
    try {
      const found = await findVariant(raw);
      if (found) {
        setItem(found);
        setQty(1);
        setMessage(found.barcode ? '' : 'This variant has NO barcode — fix it in admin first.');
      } else {
        setItem(null);
        setMessage(`No item found for ${raw}.`);
      }
    } catch (err) {
      setMessage(`Lookup failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }, []);

  // Subscribe to the scanner stream ONCE (bins-app pattern: re-subscribing
  // can replay the previous scan).
  const routeRef = useRef(route);
  routeRef.current = route;
  useEffect(() => {
    let unsubData, unsubSources;
    try {
      unsubData = shopify.scanner.scannerData.current.subscribe((result) => {
        if (result?.data) routeRef.current(result.data);
      });
    } catch (e) {}
    try {
      unsubSources = shopify.scanner.sources.current.subscribe((sources) => {
        const list = sources || [];
        setHasCamera(list.includes('camera'));
        setHasHardware(list.includes('external') || list.includes('embedded'));
      });
    } catch (e) {}
    return () => {
      try { unsubData && unsubData(); } catch (e) {}
      try { unsubSources && unsubSources(); } catch (e) {}
    };
  }, []);

  const submitInput = () => { route(input); setInput(''); };
  const openCamera = () => { try { shopify.scanner.showCameraScanner(); } catch (e) {} };

  const doPrint = async () => {
    if (!item?.barcode) return;
    setBusy(true);
    try {
      const zpl = buildZpl({
        title: item.product?.title || item.title,
        meta: [describe(item), item.sku].filter(Boolean).join(' · '),
        barcode: item.barcode,
        copies: qty,
      });
      await printViaPrintNode(zpl, `${item.product?.title || 'label'} ×${qty}`);
      shopify.toast.show(`Sent ${qty} label${qty === 1 ? '' : 's'} to the Zebra`);
      setMessage(`Printed ×${qty}. Scan the next item.`);
      setItem(null);
    } catch (err) {
      shopify.toast.show(`Print failed: ${err.message}`);
      setMessage(`Print failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <s-page heading="Print Label">
      <s-scroll-box>
        <s-box padding="base">

          {!configured ? (
            <s-section heading="Not configured">
              <s-text>
                PrintNode API key / printer id are not set. Edit
                extensions/asb-labels-pos/src/Modal.jsx and redeploy.
              </s-text>
            </s-section>
          ) : null}

          <s-text>Prints to the Zebra at the receiving Mac — no dialog, no AirPrint.</s-text>
          {hasHardware
            ? <s-text>Hardware scanner connected — just scan.</s-text>
            : (hasCamera ? <s-text>No hardware scanner — tap “Scan with camera”.</s-text> : null)}

          <s-section heading="Scan or type">
            <s-text-field
              label="Item barcode or SKU"
              value={input}
              onInput={(e) => setInput(e.currentTarget.value)}
            />
            <s-stack direction="inline" gap="large">
              <s-button onClick={submitInput} disabled={busy}>Enter</s-button>
              <s-button onClick={openCamera} disabled={busy}>Scan with camera</s-button>
            </s-stack>
            {message ? <s-text>{message}</s-text> : null}
          </s-section>

          {item ? (
            <s-section heading={item.product?.title || item.title}>
              <s-text>{describe(item) || item.title}</s-text>
              <s-text>SKU: {item.sku || '—'} · Barcode: {item.barcode || '⚠ NONE'}</s-text>

              <s-stack direction="inline" gap="large">
                <s-button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={busy || qty <= 1}>−</s-button>
                <s-badge>{qty}</s-badge>
                <s-button onClick={() => setQty((q) => Math.min(99, q + 1))} disabled={busy}>+</s-button>
              </s-stack>

              <s-button
                variant="primary"
                onClick={doPrint}
                disabled={busy || !configured || !item.barcode}
              >
                Print {qty} label{qty === 1 ? '' : 's'}
              </s-button>
            </s-section>
          ) : null}

        </s-box>
      </s-scroll-box>
    </s-page>
  );
}
