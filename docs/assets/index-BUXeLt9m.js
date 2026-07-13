(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))o(n);new MutationObserver(n=>{for(const a of n)if(a.type==="childList")for(const c of a.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&o(c)}).observe(document,{childList:!0,subtree:!0});function s(n){const a={};return n.integrity&&(a.integrity=n.integrity),n.referrerPolicy&&(a.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?a.credentials="include":n.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function o(n){if(n.ep)return;n.ep=!0;const a=s(n);fetch(n.href,a)}})();async function C(e,t){const o=await(await fetch("shopify:admin/api/2026-07/graphql.json",{method:"POST",body:JSON.stringify({query:e,variables:t})})).json();if(o.errors)throw new Error(o.errors.map(n=>n.message).join("; "));return o.data}async function E(){var t;const e=await C(`#graphql
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
    }`,{id:e});return(t==null?void 0:t.inventoryShipment)||null}function q(e){const t=document.createElement("div");t.className="label";const s=document.createElement("div");s.className="style",s.textContent=e.style||"—",t.appendChild(s);const o=document.createElement("div");o.className="body";const n=document.createElement("div");n.className="info";const a=document.createElement("div");a.className="meta",a.textContent=e.meta||"",n.appendChild(a);const c=document.createElement("div");if(c.className="price",e.retail){const l=document.createElement("span");l.className="retail",l.textContent=v(e.retail),c.appendChild(l)}if(e.price!=null){const l=document.createElement("span");l.className="now",l.textContent=v(e.price),c.appendChild(l)}n.appendChild(c),o.appendChild(n);const r=document.createElement("div");r.className="barcode";const d=document.createElementNS("http://www.w3.org/2000/svg","svg");return r.appendChild(d),o.appendChild(r),t.appendChild(o),JsBarcode(d,String(e.barcode).trim(),{format:"CODE128",width:2,height:40,margin:6,displayValue:!0,fontSize:13,textMargin:2}),d.removeAttribute("width"),d.removeAttribute("height"),d.setAttribute("preserveAspectRatio","xMidYMid meet"),t}const y=document.getElementById("app"),$=document.getElementById("print-sheet"),i={transfers:null,shipment:null,rows:[],message:"",error:""};function S(e){return/\$/.test(e)||/\d\.\d{2}\b/.test(e)||/retail/i.test(e)}function I(e){return((e==null?void 0:e.selectedOptions)||[]).filter(t=>t.value&&t.value!=="Default Title"&&!/retail|price/i.test(t.name)&&!S(t.value)).map(t=>t.value).join(" · ")}function v(e){return`$${Number(e).toFixed(2)}`}function A(e){const t=parseFloat(e==null?void 0:e.price);let s=(e==null?void 0:e.compareAtPrice)!=null?parseFloat(e.compareAtPrice):NaN;if(!(s>0)){const n=((e==null?void 0:e.selectedOptions)||[]).find(a=>/retail/i.test(a.name));if(n){const a=parseFloat(String(n.value).replace(/[^0-9.]/g,""));a>0&&(s=a)}}const o=t>0&&s>t+.001;return{price:t>0?t:null,retail:o?s:null}}function w(e){return e?new Date(e).toLocaleDateString(void 0,{month:"short",day:"numeric"}):""}function f(e){return`<span class="badge ${e==="RECEIVED"?"received":/PARTIAL/i.test(e)?"partial":""}">${(e||"").replace(/_/g," ").toLowerCase()}</span>`}async function N(){i.transfers=null,i.error="",m();try{i.transfers=await E(),i.message=i.transfers.length?"":"No transfers found."}catch(e){i.transfers=[],i.error=`Couldn't load transfers: ${e.message}`}m()}async function O(e){var t;i.message="Loading shipment…",i.error="",m();try{const s=await L(e),o=(((t=s==null?void 0:s.lineItems)==null?void 0:t.nodes)||[]).map(n=>{var r,d,l,u;const a=(r=n.inventoryItem)==null?void 0:r.variant,c=A(a);return{style:((d=a==null?void 0:a.product)==null?void 0:d.title)||((l=n.inventoryItem)==null?void 0:l.sku)||"Unknown item",meta:I(a),sku:((u=n.inventoryItem)==null?void 0:u.sku)||"",barcode:((a==null?void 0:a.barcode)||"").trim(),price:c.price,retail:c.retail,accepted:n.acceptedQuantity,qty:n.acceptedQuantity}});i.shipment=s,i.rows=o,i.message=""}catch(s){i.error=`Couldn't load shipment: ${s.message}`}m()}function P(){const e=i.rows.filter(t=>t.qty>0&&t.barcode);$.innerHTML="";for(const t of e)for(let s=0;s<t.qty;s++)$.appendChild(q(t));window.print()}function h(){return i.rows.reduce((e,t)=>e+(t.barcode?t.qty:0),0)}function m(){const{transfers:e,shipment:t,rows:s,message:o,error:n}=i;let a="";if(!t)a=`
      <div class="status">Labels print from what was <b>accepted</b> on a shipment — items still incoming never print.</div>
      ${e===null?'<div class="status">Loading transfers…</div>':e.map(r=>{var u,b,g;const d=((u=r.shipments)==null?void 0:u.nodes)||[],l=d.length?d.map(p=>`
            <button class="shipment-row" data-open="${p.id}">
              <span class="name">${p.name}</span>
              ${f(p.status)}
              <span class="dim">${w(p.dateReceived||p.dateCreated)}</span>
              <span class="dim">${p.totalAcceptedQuantity}/${p.lineItemTotalQuantity} accepted</span>
            </button>`).join(""):'<div class="status">Nothing received yet — labels print once a shipment is received.</div>';return`
        <div class="card">
          <h2>${r.name} ${f(r.status)}
            <span class="dim" style="font-weight:500">&nbsp; ${((b=r.origin)==null?void 0:b.name)||"?"} → ${((g=r.destination)==null?void 0:g.name)||"?"} · ${w(r.dateCreated)}</span>
          </h2>
          ${l}
        </div>`}).join("")}
      <button class="secondary" data-refresh>Refresh</button>`;else{const c=s.map((r,d)=>`
      <tr>
        <td>${r.style}</td>
        <td>${[r.meta,r.sku].filter(Boolean).join(" · ")||"—"}</td>
        <td class="num">${r.accepted}</td>
        <td class="num"><input type="number" min="0" max="999" value="${r.qty}" data-qty="${d}" ${r.barcode?"":"disabled"} /></td>
        <td>${r.barcode?r.barcode:'<span class="nobarcode">⚠ NO BARCODE</span>'}</td>
      </tr>`).join("");a=`
      <div class="card">
        <h2>${t.name} ${f(t.status)}</h2>
        <table>
          <thead><tr><th>Style</th><th>Variant · SKU</th><th class="num">Accepted</th><th class="num">Print</th><th>Barcode</th></tr></thead>
          <tbody>${c}</tbody>
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
      ${n?`<div class="status error">${n}</div>`:""}
      ${o?`<div class="status">${o}</div>`:""}
      ${a}
    </main>`}y.addEventListener("click",e=>{const t=e.target.closest("[data-open]");if(t)return O(t.dataset.open);if(e.target.closest("[data-refresh]"))return N();if(e.target.closest("[data-back]")){i.shipment=null,i.rows=[],m();return}if(e.target.closest("[data-print]"))return P()});y.addEventListener("input",e=>{const t=e.target.closest("[data-qty]");t&&(i.rows[Number(t.dataset.qty)].qty=Math.max(0,Number(t.value)||0))});N();
