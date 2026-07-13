(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))c(n);new MutationObserver(n=>{for(const s of n)if(s.type==="childList")for(const o of s.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&c(o)}).observe(document,{childList:!0,subtree:!0});function r(n){const s={};return n.integrity&&(s.integrity=n.integrity),n.referrerPolicy&&(s.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?s.credentials="include":n.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function c(n){if(n.ep)return;n.ep=!0;const s=r(n);fetch(n.href,s)}})();async function w(e,t){const c=await(await fetch("shopify:admin/api/2026-07/graphql.json",{method:"POST",body:JSON.stringify({query:e,variables:t})})).json();if(c.errors)throw new Error(c.errors.map(n=>n.message).join("; "));return c.data}async function L(){var t;const e=await w(`#graphql
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
    }`,{id:e});return(t==null?void 0:t.inventoryShipment)||null}function E(e){const t=document.createElement("div");t.className="label";const r=document.createElement("div");r.className="text";const c=document.createElement("div");c.className="style",c.textContent=e.style||"—",r.appendChild(c);const n=document.createElement("div");n.className="meta",n.textContent=e.meta||"",r.appendChild(n),t.appendChild(r);const s=document.createElement("div");s.className="barcode";const o=document.createElementNS("http://www.w3.org/2000/svg","svg");s.appendChild(o),t.appendChild(s),JsBarcode(o,String(e.barcode).trim(),{format:"CODE128",width:2,height:48,margin:0,displayValue:!0,fontSize:13,textMargin:2});const a=o.getAttribute("width"),d=o.getAttribute("height");return a&&d&&(o.setAttribute("viewBox",`0 0 ${a} ${d}`),o.removeAttribute("width"),o.removeAttribute("height"),o.setAttribute("preserveAspectRatio","xMidYMid meet")),t}const f=document.getElementById("app"),v=document.getElementById("print-sheet"),i={transfers:null,shipment:null,rows:[],message:"",error:""};function S(e){return((e==null?void 0:e.selectedOptions)||[]).filter(t=>t.value&&t.value!=="Default Title").map(t=>t.value).join(" · ")}function $(e){return e?new Date(e).toLocaleDateString(void 0,{month:"short",day:"numeric"}):""}function p(e){return`<span class="badge ${e==="RECEIVED"?"received":/PARTIAL/i.test(e)?"partial":""}">${(e||"").replace(/_/g," ").toLowerCase()}</span>`}async function C(){i.transfers=null,i.error="",u();try{i.transfers=await L(),i.message=i.transfers.length?"":"No transfers found."}catch(e){i.transfers=[],i.error=`Couldn't load transfers: ${e.message}`}u()}async function N(e){var t;i.message="Loading shipment…",i.error="",u();try{const r=await q(e),c=(((t=r==null?void 0:r.lineItems)==null?void 0:t.nodes)||[]).map(n=>{var o,a,d,m;const s=(o=n.inventoryItem)==null?void 0:o.variant;return{style:((a=s==null?void 0:s.product)==null?void 0:a.title)||((d=n.inventoryItem)==null?void 0:d.sku)||"Unknown item",meta:[S(s),(m=n.inventoryItem)==null?void 0:m.sku].filter(Boolean).join("  ·  "),barcode:((s==null?void 0:s.barcode)||"").trim(),accepted:n.acceptedQuantity,qty:n.acceptedQuantity}});i.shipment=r,i.rows=c,i.message=""}catch(r){i.error=`Couldn't load shipment: ${r.message}`}u()}function A(){const e=i.rows.filter(t=>t.qty>0&&t.barcode);v.innerHTML="";for(const t of e)for(let r=0;r<t.qty;r++)v.appendChild(E(t));window.print()}function h(){return i.rows.reduce((e,t)=>e+(t.barcode?t.qty:0),0)}function u(){const{transfers:e,shipment:t,rows:r,message:c,error:n}=i;let s="";if(!t)s=`
      <div class="status">Labels print from what was <b>accepted</b> on a shipment — items still incoming never print.</div>
      ${e===null?'<div class="status">Loading transfers…</div>':e.map(a=>{var y,b,g;const d=((y=a.shipments)==null?void 0:y.nodes)||[],m=d.length?d.map(l=>`
            <button class="shipment-row" data-open="${l.id}">
              <span class="name">${l.name}</span>
              ${p(l.status)}
              <span class="dim">${$(l.dateReceived||l.dateCreated)}</span>
              <span class="dim">${l.totalAcceptedQuantity}/${l.lineItemTotalQuantity} accepted</span>
            </button>`).join(""):'<div class="status">Nothing received yet — labels print once a shipment is received.</div>';return`
        <div class="card">
          <h2>${a.name} ${p(a.status)}
            <span class="dim" style="font-weight:500">&nbsp; ${((b=a.origin)==null?void 0:b.name)||"?"} → ${((g=a.destination)==null?void 0:g.name)||"?"} · ${$(a.dateCreated)}</span>
          </h2>
          ${m}
        </div>`}).join("")}
      <button class="secondary" data-refresh>Refresh</button>`;else{const o=r.map((a,d)=>`
      <tr>
        <td>${a.style}</td>
        <td>${a.meta||"—"}</td>
        <td class="num">${a.accepted}</td>
        <td class="num"><input type="number" min="0" max="999" value="${a.qty}" data-qty="${d}" ${a.barcode?"":"disabled"} /></td>
        <td>${a.barcode?a.barcode:'<span class="nobarcode">⚠ NO BARCODE</span>'}</td>
      </tr>`).join("");s=`
      <div class="card">
        <h2>${t.name} ${p(t.status)}</h2>
        <table>
          <thead><tr><th>Style</th><th>Variant · SKU</th><th class="num">Accepted</th><th class="num">Print</th><th>Barcode</th></tr></thead>
          <tbody>${o}</tbody>
        </table>
        <div class="printbar">
          <button data-print ${h()?"":"disabled"}>Print ${h()} label${h()===1?"":"s"}</button>
          <button class="secondary" data-back>← Shipments</button>
          <span class="count">3-1/2 × 1-1/8 in · Code128 · one label per unit</span>
        </div>
      </div>`}f.innerHTML=`
    <div class="topbar">
      <h1>Print Received Labels</h1>
      <span class="sub">from accepted shipment quantities — not the transfer</span>
    </div>
    <main>
      ${n?`<div class="status error">${n}</div>`:""}
      ${c?`<div class="status">${c}</div>`:""}
      ${s}
    </main>`}f.addEventListener("click",e=>{const t=e.target.closest("[data-open]");if(t)return N(t.dataset.open);if(e.target.closest("[data-refresh]"))return C();if(e.target.closest("[data-back]")){i.shipment=null,i.rows=[],u();return}if(e.target.closest("[data-print]"))return A()});f.addEventListener("input",e=>{const t=e.target.closest("[data-qty]");t&&(i.rows[Number(t.dataset.qty)].qty=Math.max(0,Number(t.value)||0))});C();
