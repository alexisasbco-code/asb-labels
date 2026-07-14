(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))i(n);new MutationObserver(n=>{for(const a of n)if(a.type==="childList")for(const o of a.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&i(o)}).observe(document,{childList:!0,subtree:!0});function s(n){const a={};return n.integrity&&(a.integrity=n.integrity),n.referrerPolicy&&(a.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?a.credentials="include":n.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function i(n){if(n.ep)return;n.ep=!0;const a=s(n);fetch(n.href,a)}})();const q="v6";async function S(e,t){const i=await(await fetch("shopify:admin/api/2026-07/graphql.json",{method:"POST",body:JSON.stringify({query:e,variables:t})})).json();if(i.errors)throw new Error(i.errors.map(n=>n.message).join("; "));return i.data}async function $(e){var s;const t=await S(`#graphql
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
    }`,{q:e||null});return((s=t==null?void 0:t.inventoryTransfers)==null?void 0:s.nodes)||[]}async function L(e){const t=e.replace(/^#/,"").trim(),s=await $(t);if(s.length)return s;const i=await $(null),n=t.toLowerCase();return i.filter(a=>(a.name||"").toLowerCase().includes(n))}async function k(e){const t=await S(`#graphql
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
    }`,{id:e});return(t==null?void 0:t.inventoryShipment)||null}function I(e){const t=document.createElement("div");t.className="label";const s=document.createElement("div");s.className="style",s.textContent=e.style||"—",t.appendChild(s);const i=document.createElement("div");i.className="body";const n=document.createElement("div");n.className="info";const a=document.createElement("div");a.className="meta",a.textContent=e.meta||"",n.appendChild(a);const o=document.createElement("div");if(o.className="price",e.retail){const c=document.createElement("span");c.className="retail",c.textContent=E(e.retail),o.appendChild(c)}if(e.price!=null){const c=document.createElement("span");c.className="now",c.textContent=E(e.price),o.appendChild(c)}n.appendChild(o),i.appendChild(n);const l=document.createElement("div");l.className="barcode";const d=document.createElementNS("http://www.w3.org/2000/svg","svg");return l.appendChild(d),i.appendChild(l),t.appendChild(i),JsBarcode(d,String(e.barcode).trim(),{format:"CODE128",width:2,height:40,margin:6,displayValue:!0,fontSize:13,textMargin:2}),d.removeAttribute("width"),d.removeAttribute("height"),d.setAttribute("preserveAspectRatio","xMidYMid meet"),t}const y=document.getElementById("app"),C=document.getElementById("print-sheet"),r={transfers:null,search:"",shipment:null,rows:[],message:"",error:""};function h(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function A(e){return/\$/.test(e)||/\d\.\d{2}\b/.test(e)||/retail/i.test(e)}function O(e){return((e==null?void 0:e.selectedOptions)||[]).filter(t=>t.value&&t.value!=="Default Title"&&!/retail|price/i.test(t.name)&&!A(t.value)).map(t=>t.value).join(" · ")}function E(e){return`$${Number(e).toFixed(2)}`}function P(e){const t=parseFloat(e==null?void 0:e.price);let s=(e==null?void 0:e.compareAtPrice)!=null?parseFloat(e.compareAtPrice):NaN;if(!(s>0)){const n=((e==null?void 0:e.selectedOptions)||[]).find(a=>/retail/i.test(a.name));if(n){const a=parseFloat(String(n.value).replace(/[^0-9.]/g,""));a>0&&(s=a)}}const i=t>0&&s>t+.001;return{price:t>0?t:null,retail:i?s:null}}function N(e){return e?new Date(e).toLocaleDateString(void 0,{month:"short",day:"numeric"}):""}function b(e){return`<span class="badge ${e==="RECEIVED"?"received":/PARTIAL/i.test(e)?"partial":""}">${(e||"").replace(/_/g," ").toLowerCase()}</span>`}async function f(){r.transfers=null,r.error="",m();try{r.transfers=r.search?await L(r.search):await $(null),r.message=r.transfers.length?"":r.search?`No transfers matching “${r.search}”.`:"No transfers found."}catch(e){r.transfers=[],r.error=`Couldn't load transfers: ${e.message}`}m()}async function T(e){var t;r.message="Loading shipment…",r.error="",m();try{const s=await k(e),i=(((t=s==null?void 0:s.lineItems)==null?void 0:t.nodes)||[]).map(n=>{var l,d,c,u;const a=(l=n.inventoryItem)==null?void 0:l.variant,o=P(a);return{style:((d=a==null?void 0:a.product)==null?void 0:d.title)||((c=n.inventoryItem)==null?void 0:c.sku)||"Unknown item",meta:O(a),sku:((u=n.inventoryItem)==null?void 0:u.sku)||"",barcode:((a==null?void 0:a.barcode)||"").trim(),price:o.price,retail:o.retail,accepted:n.acceptedQuantity,qty:n.acceptedQuantity,selected:!0}});r.shipment=s,r.rows=i,r.message=""}catch(s){r.error=`Couldn't load shipment: ${s.message}`}m()}function x(){const e=r.rows.filter(t=>t.selected&&t.qty>0&&t.barcode);C.innerHTML="";for(const t of e)for(let s=0;s<t.qty;s++)C.appendChild(I(t));window.print()}function g(){return r.rows.reduce((e,t)=>e+(t.selected&&t.barcode?t.qty:0),0)}function m(){const{transfers:e,shipment:t,rows:s,message:i,error:n}=r;let a="";if(t){const o=s.length>0&&s.every(c=>c.selected),l=s.filter(c=>c.selected).length,d=s.map((c,u)=>`
      <tr class="${c.selected?"":"unselected"}">
        <td class="chk"><input type="checkbox" data-check="${u}" ${c.selected?"checked":""} /></td>
        <td>${h(c.style)}</td>
        <td>${h([c.meta,c.sku].filter(Boolean).join(" · "))||"—"}</td>
        <td class="num">${c.accepted}</td>
        <td class="num"><input type="number" min="0" max="999" value="${c.qty}" data-qty="${u}" ${c.barcode&&c.selected?"":"disabled"} /></td>
        <td>${c.barcode?h(c.barcode):'<span class="nobarcode">⚠ NO BARCODE</span>'}</td>
      </tr>`).join("");a=`
      <div class="card">
        <h2>${h(t.name)} ${b(t.status)}</h2>
        <table>
          <thead><tr>
            <th class="chk"><input type="checkbox" data-checkall ${o?"checked":""} title="Select all / none" /></th>
            <th>Style</th><th>Variant · SKU</th><th class="num">Accepted</th><th class="num">Print</th><th>Barcode</th>
          </tr></thead>
          <tbody>${d}</tbody>
        </table>
        <div class="printbar">
          <button data-print ${g()?"":"disabled"}>Print ${g()} label${g()===1?"":"s"}</button>
          <button class="secondary" data-back>← Shipments</button>
          <span class="count">${l} of ${s.length} items selected · 3-1/2 × 1-1/8 in · Code128</span>
        </div>
      </div>`}else{const o=e===null?'<div class="status">Loading transfers…</div>':e.map(l=>{var u,v,w;const d=((u=l.shipments)==null?void 0:u.nodes)||[],c=d.length?d.map(p=>`
            <button class="shipment-row" data-open="${p.id}">
              <span class="name">${p.name}</span>
              ${b(p.status)}
              <span class="dim">${N(p.dateReceived||p.dateCreated)}</span>
              <span class="dim">${p.totalAcceptedQuantity}/${p.lineItemTotalQuantity} accepted</span>
            </button>`).join(""):'<div class="status">Nothing received yet — labels print once a shipment is received.</div>';return`
        <div class="card">
          <h2>${l.name} ${b(l.status)}
            <span class="dim" style="font-weight:500">&nbsp; ${((v=l.origin)==null?void 0:v.name)||"?"} → ${((w=l.destination)==null?void 0:w.name)||"?"} · ${N(l.dateCreated)}</span>
          </h2>
          ${c}
        </div>`}).join("");a=`
      <form class="searchbar" data-searchform>
        <input id="tsearch" type="search" placeholder="Search transfer # (e.g. T0541)" value="${h(r.search)}" />
        <button type="submit">Search</button>
        ${r.search?'<button type="button" class="secondary" data-clearsearch>Clear</button>':""}
      </form>
      <div class="status">Labels print from what was <b>accepted</b> on a shipment — items still incoming never print.</div>
      ${o}
      <button class="secondary" data-refresh>Refresh</button>`}y.innerHTML=`
    <div class="topbar">
      <h1>Print Received Labels</h1>
      <span class="sub">from accepted shipment quantities — not the transfer</span>
      <span class="version">${q}</span>
    </div>
    <main>
      ${n?`<div class="status error">${n}</div>`:""}
      ${i?`<div class="status">${i}</div>`:""}
      ${a}
    </main>`}y.addEventListener("click",e=>{const t=e.target.closest("[data-check]");if(t){r.rows[Number(t.dataset.check)].selected=t.checked,m();return}const s=e.target.closest("[data-checkall]");if(s){const n=s.checked;r.rows.forEach(a=>{a.selected=n}),m();return}if(e.target.closest("[data-clearsearch]"))return r.search="",f();const i=e.target.closest("[data-open]");if(i)return T(i.dataset.open);if(e.target.closest("[data-refresh]"))return f();if(e.target.closest("[data-back]")){r.shipment=null,r.rows=[],m();return}if(e.target.closest("[data-print]"))return x()});y.addEventListener("submit",e=>{var t;e.target.closest("[data-searchform]")&&(e.preventDefault(),r.search=(((t=document.getElementById("tsearch"))==null?void 0:t.value)||"").trim(),f())});y.addEventListener("input",e=>{const t=e.target.closest("[data-qty]");t&&(r.rows[Number(t.dataset.qty)].qty=Math.max(0,Number(t.value)||0))});f();
