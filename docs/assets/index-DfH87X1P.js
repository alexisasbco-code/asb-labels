(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))o(a);new MutationObserver(a=>{for(const n of a)if(n.type==="childList")for(const d of n.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&o(d)}).observe(document,{childList:!0,subtree:!0});function r(a){const n={};return a.integrity&&(n.integrity=a.integrity),a.referrerPolicy&&(n.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?n.credentials="include":a.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function o(a){if(a.ep)return;a.ep=!0;const n=r(a);fetch(a.href,n)}})();async function C(e,t){const o=await(await fetch("shopify:admin/api/2026-07/graphql.json",{method:"POST",body:JSON.stringify({query:e,variables:t})})).json();if(o.errors)throw new Error(o.errors.map(a=>a.message).join("; "));return o.data}async function E(){var t;const e=await C(`#graphql
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
    }`,{});return((t=e==null?void 0:e.inventoryTransfers)==null?void 0:t.nodes)||[]}async function L(e){const t=await C(`#graphql
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
    }`,{id:e});return(t==null?void 0:t.inventoryShipment)||null}function q(e){const t=document.createElement("div");t.className="label";const r=document.createElement("div");r.className="style",r.textContent=e.style||"—",t.appendChild(r);const o=document.createElement("div");o.className="mid";const a=document.createElement("div");a.className="meta",a.textContent=e.meta||"",o.appendChild(a);const n=document.createElement("div");if(n.className="price",e.retail){const c=document.createElement("span");c.className="retail",c.textContent=v(e.retail),n.appendChild(c)}if(e.price!=null){const c=document.createElement("span");c.className="now",c.textContent=v(e.price),n.appendChild(c)}o.appendChild(n),t.appendChild(o);const d=document.createElement("div");d.className="barcode";const s=document.createElementNS("http://www.w3.org/2000/svg","svg");return d.appendChild(s),t.appendChild(d),JsBarcode(s,String(e.barcode).trim(),{format:"CODE128",width:2,height:40,margin:6,displayValue:!0,fontSize:13,textMargin:2}),s.removeAttribute("width"),s.removeAttribute("height"),s.setAttribute("preserveAspectRatio","xMidYMid meet"),t}const y=document.getElementById("app"),$=document.getElementById("print-sheet"),i={transfers:null,shipment:null,rows:[],message:"",error:""};function S(e){return/\$/.test(e)||/\d\.\d{2}\b/.test(e)||/retail/i.test(e)}function I(e){return((e==null?void 0:e.selectedOptions)||[]).filter(t=>t.value&&t.value!=="Default Title"&&!/retail|price/i.test(t.name)&&!S(t.value)).map(t=>t.value).join(" · ")}function v(e){return`$${Number(e).toFixed(2)}`}function A(e){const t=parseFloat(e==null?void 0:e.price);let r=(e==null?void 0:e.compareAtPrice)!=null?parseFloat(e.compareAtPrice):NaN;if(!(r>0)){const a=((e==null?void 0:e.selectedOptions)||[]).find(n=>/retail/i.test(n.name));if(a){const n=parseFloat(String(a.value).replace(/[^0-9.]/g,""));n>0&&(r=n)}}const o=t>0&&r>t+.001;return{price:t>0?t:null,retail:o?r:null}}function w(e){return e?new Date(e).toLocaleDateString(void 0,{month:"short",day:"numeric"}):""}function f(e){return`<span class="badge ${e==="RECEIVED"?"received":/PARTIAL/i.test(e)?"partial":""}">${(e||"").replace(/_/g," ").toLowerCase()}</span>`}async function N(){i.transfers=null,i.error="",p();try{i.transfers=await E(),i.message=i.transfers.length?"":"No transfers found."}catch(e){i.transfers=[],i.error=`Couldn't load transfers: ${e.message}`}p()}async function O(e){var t;i.message="Loading shipment…",i.error="",p();try{const r=await L(e),o=(((t=r==null?void 0:r.lineItems)==null?void 0:t.nodes)||[]).map(a=>{var s,c,m,u;const n=(s=a.inventoryItem)==null?void 0:s.variant,d=A(n);return{style:((c=n==null?void 0:n.product)==null?void 0:c.title)||((m=a.inventoryItem)==null?void 0:m.sku)||"Unknown item",meta:I(n),sku:((u=a.inventoryItem)==null?void 0:u.sku)||"",barcode:((n==null?void 0:n.barcode)||"").trim(),price:d.price,retail:d.retail,accepted:a.acceptedQuantity,qty:a.acceptedQuantity}});i.shipment=r,i.rows=o,i.message=""}catch(r){i.error=`Couldn't load shipment: ${r.message}`}p()}function P(){const e=i.rows.filter(t=>t.qty>0&&t.barcode);$.innerHTML="";for(const t of e)for(let r=0;r<t.qty;r++)$.appendChild(q(t));window.print()}function h(){return i.rows.reduce((e,t)=>e+(t.barcode?t.qty:0),0)}function p(){const{transfers:e,shipment:t,rows:r,message:o,error:a}=i;let n="";if(!t)n=`
      <div class="status">Labels print from what was <b>accepted</b> on a shipment — items still incoming never print.</div>
      ${e===null?'<div class="status">Loading transfers…</div>':e.map(s=>{var u,b,g;const c=((u=s.shipments)==null?void 0:u.nodes)||[],m=c.length?c.map(l=>`
            <button class="shipment-row" data-open="${l.id}">
              <span class="name">${l.name}</span>
              ${f(l.status)}
              <span class="dim">${w(l.dateReceived||l.dateCreated)}</span>
              <span class="dim">${l.totalAcceptedQuantity}/${l.lineItemTotalQuantity} accepted</span>
            </button>`).join(""):'<div class="status">Nothing received yet — labels print once a shipment is received.</div>';return`
        <div class="card">
          <h2>${s.name} ${f(s.status)}
            <span class="dim" style="font-weight:500">&nbsp; ${((b=s.origin)==null?void 0:b.name)||"?"} → ${((g=s.destination)==null?void 0:g.name)||"?"} · ${w(s.dateCreated)}</span>
          </h2>
          ${m}
        </div>`}).join("")}
      <button class="secondary" data-refresh>Refresh</button>`;else{const d=r.map((s,c)=>`
      <tr>
        <td>${s.style}</td>
        <td>${[s.meta,s.sku].filter(Boolean).join(" · ")||"—"}</td>
        <td class="num">${s.accepted}</td>
        <td class="num"><input type="number" min="0" max="999" value="${s.qty}" data-qty="${c}" ${s.barcode?"":"disabled"} /></td>
        <td>${s.barcode?s.barcode:'<span class="nobarcode">⚠ NO BARCODE</span>'}</td>
      </tr>`).join("");n=`
      <div class="card">
        <h2>${t.name} ${f(t.status)}</h2>
        <table>
          <thead><tr><th>Style</th><th>Variant · SKU</th><th class="num">Accepted</th><th class="num">Print</th><th>Barcode</th></tr></thead>
          <tbody>${d}</tbody>
        </table>
        <div class="printbar">
          <button data-print ${h()?"":"disabled"}>Print ${h()} label${h()===1?"":"s"}</button>
          <button class="secondary" data-back>← Shipments</button>
          <span class="count">3-1/2 × 1-1/8 in · Code128 · one label per unit</span>
        </div>
      </div>`}y.innerHTML=`
    <div class="topbar">
      <h1>Print Received Labels</h1>
      <span class="sub">from accepted shipment quantities — not the transfer</span>
    </div>
    <main>
      ${a?`<div class="status error">${a}</div>`:""}
      ${o?`<div class="status">${o}</div>`:""}
      ${n}
    </main>`}y.addEventListener("click",e=>{const t=e.target.closest("[data-open]");if(t)return O(t.dataset.open);if(e.target.closest("[data-refresh]"))return N();if(e.target.closest("[data-back]")){i.shipment=null,i.rows=[],p();return}if(e.target.closest("[data-print]"))return P()});y.addEventListener("input",e=>{const t=e.target.closest("[data-qty]");t&&(i.rows[Number(t.dataset.qty)].qty=Math.max(0,Number(t.value)||0))});N();
