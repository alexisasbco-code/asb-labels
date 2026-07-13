(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))o(n);new MutationObserver(n=>{for(const s of n)if(s.type==="childList")for(const c of s.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&o(c)}).observe(document,{childList:!0,subtree:!0});function a(n){const s={};return n.integrity&&(s.integrity=n.integrity),n.referrerPolicy&&(s.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?s.credentials="include":n.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function o(n){if(n.ep)return;n.ep=!0;const s=a(n);fetch(n.href,s)}})();async function w(e,t){const o=await(await fetch("shopify:admin/api/2026-07/graphql.json",{method:"POST",body:JSON.stringify({query:e,variables:t})})).json();if(o.errors)throw new Error(o.errors.map(n=>n.message).join("; "));return o.data}async function L(){var t;const e=await w(`#graphql
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
    }`,{});return((t=e==null?void 0:e.inventoryTransfers)==null?void 0:t.nodes)||[]}async function q(e){const t=await w(`#graphql
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
    }`,{id:e});return(t==null?void 0:t.inventoryShipment)||null}function E(e){const t=document.createElement("div");t.className="label";const a=document.createElement("div");a.className="text";const o=document.createElement("div");o.className="style",o.textContent=e.style||"—",a.appendChild(o);const n=document.createElement("div");n.className="meta",n.textContent=e.meta||"",a.appendChild(n),t.appendChild(a);const s=document.createElement("div");s.className="barcode";const c=document.createElementNS("http://www.w3.org/2000/svg","svg");return s.appendChild(c),t.appendChild(s),JsBarcode(c,String(e.barcode).trim(),{format:"CODE128",width:2,height:48,margin:8,displayValue:!0,fontSize:13,textMargin:2}),c.removeAttribute("width"),c.removeAttribute("height"),c.setAttribute("preserveAspectRatio","xMidYMid meet"),t}const h=document.getElementById("app"),g=document.getElementById("print-sheet"),r={transfers:null,shipment:null,rows:[],message:"",error:""};function S(e){return((e==null?void 0:e.selectedOptions)||[]).filter(t=>t.value&&t.value!=="Default Title").map(t=>t.value).join(" · ")}function $(e){return e?new Date(e).toLocaleDateString(void 0,{month:"short",day:"numeric"}):""}function p(e){return`<span class="badge ${e==="RECEIVED"?"received":/PARTIAL/i.test(e)?"partial":""}">${(e||"").replace(/_/g," ").toLowerCase()}</span>`}async function C(){r.transfers=null,r.error="",u();try{r.transfers=await L(),r.message=r.transfers.length?"":"No transfers found."}catch(e){r.transfers=[],r.error=`Couldn't load transfers: ${e.message}`}u()}async function N(e){var t;r.message="Loading shipment…",r.error="",u();try{const a=await q(e),o=(((t=a==null?void 0:a.lineItems)==null?void 0:t.nodes)||[]).map(n=>{var c,i,d,m;const s=(c=n.inventoryItem)==null?void 0:c.variant;return{style:((i=s==null?void 0:s.product)==null?void 0:i.title)||((d=n.inventoryItem)==null?void 0:d.sku)||"Unknown item",meta:[S(s),(m=n.inventoryItem)==null?void 0:m.sku].filter(Boolean).join("  ·  "),barcode:((s==null?void 0:s.barcode)||"").trim(),accepted:n.acceptedQuantity,qty:n.acceptedQuantity}});r.shipment=a,r.rows=o,r.message=""}catch(a){r.error=`Couldn't load shipment: ${a.message}`}u()}function I(){const e=r.rows.filter(t=>t.qty>0&&t.barcode);g.innerHTML="";for(const t of e)for(let a=0;a<t.qty;a++)g.appendChild(E(t));window.print()}function f(){return r.rows.reduce((e,t)=>e+(t.barcode?t.qty:0),0)}function u(){const{transfers:e,shipment:t,rows:a,message:o,error:n}=r;let s="";if(!t)s=`
      <div class="status">Labels print from what was <b>accepted</b> on a shipment — items still incoming never print.</div>
      ${e===null?'<div class="status">Loading transfers…</div>':e.map(i=>{var y,b,v;const d=((y=i.shipments)==null?void 0:y.nodes)||[],m=d.length?d.map(l=>`
            <button class="shipment-row" data-open="${l.id}">
              <span class="name">${l.name}</span>
              ${p(l.status)}
              <span class="dim">${$(l.dateReceived||l.dateCreated)}</span>
              <span class="dim">${l.totalAcceptedQuantity}/${l.lineItemTotalQuantity} accepted</span>
            </button>`).join(""):'<div class="status">Nothing received yet — labels print once a shipment is received.</div>';return`
        <div class="card">
          <h2>${i.name} ${p(i.status)}
            <span class="dim" style="font-weight:500">&nbsp; ${((b=i.origin)==null?void 0:b.name)||"?"} → ${((v=i.destination)==null?void 0:v.name)||"?"} · ${$(i.dateCreated)}</span>
          </h2>
          ${m}
        </div>`}).join("")}
      <button class="secondary" data-refresh>Refresh</button>`;else{const c=a.map((i,d)=>`
      <tr>
        <td>${i.style}</td>
        <td>${i.meta||"—"}</td>
        <td class="num">${i.accepted}</td>
        <td class="num"><input type="number" min="0" max="999" value="${i.qty}" data-qty="${d}" ${i.barcode?"":"disabled"} /></td>
        <td>${i.barcode?i.barcode:'<span class="nobarcode">⚠ NO BARCODE</span>'}</td>
      </tr>`).join("");s=`
      <div class="card">
        <h2>${t.name} ${p(t.status)}</h2>
        <table>
          <thead><tr><th>Style</th><th>Variant · SKU</th><th class="num">Accepted</th><th class="num">Print</th><th>Barcode</th></tr></thead>
          <tbody>${c}</tbody>
        </table>
        <div class="printbar">
          <button data-print ${f()?"":"disabled"}>Print ${f()} label${f()===1?"":"s"}</button>
          <button class="secondary" data-back>← Shipments</button>
          <span class="count">3-1/2 × 1-1/8 in · Code128 · one label per unit</span>
        </div>
      </div>`}h.innerHTML=`
    <div class="topbar">
      <h1>Print Received Labels</h1>
      <span class="sub">from accepted shipment quantities — not the transfer</span>
    </div>
    <main>
      ${n?`<div class="status error">${n}</div>`:""}
      ${o?`<div class="status">${o}</div>`:""}
      ${s}
    </main>`}h.addEventListener("click",e=>{const t=e.target.closest("[data-open]");if(t)return N(t.dataset.open);if(e.target.closest("[data-refresh]"))return C();if(e.target.closest("[data-back]")){r.shipment=null,r.rows=[],u();return}if(e.target.closest("[data-print]"))return I()});h.addEventListener("input",e=>{const t=e.target.closest("[data-qty]");t&&(r.rows[Number(t.dataset.qty)].qty=Math.max(0,Number(t.value)||0))});C();
