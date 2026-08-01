(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))r(n);new MutationObserver(n=>{for(const a of n)if(a.type==="childList")for(const c of a.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&r(c)}).observe(document,{childList:!0,subtree:!0});function s(n){const a={};return n.integrity&&(a.integrity=n.integrity),n.referrerPolicy&&(a.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?a.credentials="include":n.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function r(n){if(n.ep)return;n.ep=!0;const a=s(n);fetch(n.href,a)}})();const x="v8";async function q(e,t){const r=await(await fetch("shopify:admin/api/2026-07/graphql.json",{method:"POST",body:JSON.stringify({query:e,variables:t})})).json();if(r.errors)throw new Error(r.errors.map(n=>n.message).join("; "));return r.data}async function C(e){var s;const t=await q(`#graphql
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
    }`,{q:e||null});return((s=t==null?void 0:t.inventoryTransfers)==null?void 0:s.nodes)||[]}async function D(e){const t=e.replace(/^#/,"").trim(),s=await C(t);if(s.length)return s;const r=await C(null),n=t.toLowerCase();return r.filter(a=>(a.name||"").toLowerCase().includes(n))}async function k(e){var r,n;let t=null,s=null;do{const a=await q(`#graphql
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
                  product { title }
                }
              }
            }
          }
        }
      }`,{id:e,after:s}),c=a==null?void 0:a.inventoryShipment;if(!c)return t;t||(t={id:c.id,name:c.name,status:c.status,lines:[]}),t.lines.push(...((r=c.lineItems)==null?void 0:r.nodes)||[]);const l=(n=c.lineItems)==null?void 0:n.pageInfo;s=l!=null&&l.hasNextPage?l.endCursor:null}while(s);return t}const L="asb-labels:printed:v1",R=4800*3600*1e3;function S(){try{return JSON.parse(localStorage.getItem(L))||{}}catch{return{}}}function T(e){try{const t=Date.now()-R;for(const s of Object.keys(e))(!e[s]||e[s].t<t)&&delete e[s];localStorage.setItem(L,JSON.stringify(e))}catch{}}function A(e){var t;return((t=S()[e])==null?void 0:t.n)||0}function j(e){var s;const t=S();for(const r of e)t[r.lineId]={n:(((s=t[r.lineId])==null?void 0:s.n)||0)+r.qty,t:Date.now()};T(t)}function M(e){const t=S();for(const s of e)delete t[s.lineId];T(t)}function E(e){const t=document.createElement("div");t.className="label";const s=document.createElement("div");s.className="style",s.textContent=e.style||"—",t.appendChild(s);const r=document.createElement("div");r.className="body";const n=document.createElement("div");n.className="info";const a=document.createElement("div");a.className="meta",a.textContent=e.meta||"",n.appendChild(a);const c=document.createElement("div");if(c.className="price",e.retail){const u=document.createElement("span");u.className="retail",u.textContent=I(e.retail),c.appendChild(u)}if(e.price!=null){const u=document.createElement("span");u.className="now",u.textContent=I(e.price),c.appendChild(u)}n.appendChild(c),r.appendChild(n);const l=document.createElement("div");l.className="barcode";const d=document.createElementNS("http://www.w3.org/2000/svg","svg");return l.appendChild(d),r.appendChild(l),t.appendChild(r),JsBarcode(d,String(e.barcode).trim(),{format:"CODE128",width:2,height:40,margin:6,displayValue:!0,fontSize:13,textMargin:2}),d.removeAttribute("width"),d.removeAttribute("height"),d.setAttribute("preserveAspectRatio","xMidYMid meet"),t}const y=document.getElementById("app"),v=document.getElementById("print-sheet"),i={transfers:null,search:"",shipment:null,rows:[],message:"",error:""};function f(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function B(e){return/\$/.test(e)||/\d\.\d{2}\b/.test(e)||/retail/i.test(e)}function F(e){return((e==null?void 0:e.selectedOptions)||[]).filter(t=>t.value&&t.value!=="Default Title"&&!/retail|price/i.test(t.name)&&!B(t.value)).map(t=>t.value).join(" · ")}function I(e){return`$${Number(e).toFixed(2)}`}function Q(e){const t=parseFloat(e==null?void 0:e.price);let s=(e==null?void 0:e.compareAtPrice)!=null?parseFloat(e.compareAtPrice):NaN;if(!(s>0)){const n=((e==null?void 0:e.selectedOptions)||[]).find(a=>/retail/i.test(a.name));if(n){const a=parseFloat(String(n.value).replace(/[^0-9.]/g,""));a>0&&(s=a)}}const r=t>0&&s>t+.001;return{price:t>0?t:null,retail:r?s:null}}function P(e){return e?new Date(e).toLocaleDateString(void 0,{month:"short",day:"numeric"}):""}function w(e){return`<span class="badge ${e==="RECEIVED"?"received":/PARTIAL/i.test(e)?"partial":""}">${(e||"").replace(/_/g," ").toLowerCase()}</span>`}async function b(){i.transfers=null,i.error="",p();try{i.transfers=i.search?await D(i.search):await C(null),i.message=i.transfers.length?"":i.search?`No transfers matching “${i.search}”.`:"No transfers found."}catch(e){i.transfers=[],i.error=`Couldn't load transfers: ${e.message}`}p()}function O(e,t){var c,l,d,u;const s=(c=e.inventoryItem)==null?void 0:c.variant,r=Q(s),n=e.acceptedQuantity,a=A(e.id);return{lineId:e.id,ship:t||"",style:((l=s==null?void 0:s.product)==null?void 0:l.title)||((d=e.inventoryItem)==null?void 0:d.sku)||"Unknown item",meta:F(s),sku:((u=e.inventoryItem)==null?void 0:u.sku)||"",barcode:((s==null?void 0:s.barcode)||"").trim(),price:r.price,retail:r.retail,accepted:n,printed:a,qty:Math.max(0,n-a),selected:!0}}async function V(e){i.message="Loading shipment…",i.error="",p();try{const t=await k(e);i.shipment=t,i.rows=((t==null?void 0:t.lines)||[]).map(s=>O(s)),i.message=""}catch(t){i.error=`Couldn't load shipment: ${t.message}`}p()}async function _(e){var r;const t=(i.transfers||[]).find(n=>n.id===e),s=((r=t==null?void 0:t.shipments)==null?void 0:r.nodes)||[];i.message=`Loading ${s.length} shipment${s.length===1?"":"s"}…`,i.error="",p();try{const n=[];for(const a of s){const c=await k(a.id);for(const l of(c==null?void 0:c.lines)||[])n.push(O(l,c.name))}i.shipment={name:`${(t==null?void 0:t.name)||"Transfer"} — all shipments`,status:(t==null?void 0:t.status)||""},i.rows=n,i.message=""}catch(n){i.error=`Couldn't load transfer: ${n.message}`}p()}function J(){const e=i.rows.filter(n=>n.selected&&n.qty>0&&n.barcode);v.innerHTML="";const t=[];for(const n of e)try{const a=E(n);v.appendChild(a);for(let c=1;c<n.qty;c++)v.appendChild(E(n))}catch{t.push(n);continue}const s=e.filter(n=>!t.includes(n)),r=s.reduce((n,a)=>n+a.qty,0);j(s);for(const n of s)n.printed=A(n.lineId),n.qty=Math.max(0,n.accepted-n.printed);window.print(),i.message=`Sent ${r} label${r===1?"":"s"} (${s.length} item${s.length===1?"":"s"}) to the printer.`,i.error=t.length?`⚠ ${t.length} item${t.length===1?"":"s"} SKIPPED — barcode couldn't be encoded: ${t.map(n=>n.sku||n.style).join(", ")}`:"",p()}function g(){return i.rows.reduce((e,t)=>e+(t.selected&&t.barcode?t.qty:0),0)}function p(){const{transfers:e,shipment:t,rows:s,message:r,error:n}=i;let a="";if(t){const c=s.length>0&&s.every(o=>o.selected),l=s.filter(o=>o.selected).length,d=s.some(o=>o.ship),u=s.some(o=>o.printed>0),$=s.map((o,h)=>`
      <tr class="${o.selected?"":"unselected"}">
        <td class="chk"><input type="checkbox" data-check="${h}" ${o.selected?"checked":""} /></td>
        <td>${f(o.style)}</td>
        <td>${f([d?o.ship:"",o.meta,o.sku].filter(Boolean).join(" · "))||"—"}</td>
        <td class="num">${o.accepted}</td>
        <td class="num${o.printed?"":" dim"}">${o.printed}</td>
        <td class="num"><input type="number" min="0" max="999" value="${o.qty}" data-qty="${h}" ${o.barcode&&o.selected?"":"disabled"} /></td>
        <td>${o.barcode?f(o.barcode):'<span class="nobarcode">⚠ NO BARCODE</span>'}</td>
      </tr>`).join("");a=`
      <div class="card">
        <h2>${f(t.name)} ${w(t.status)}</h2>
        ${u?'<div class="status">Print counts default to <b>accepted − already printed</b>, so a repeat receive session only prints the new units. Use “Forget printed” to reprint everything.</div>':""}
        <table>
          <thead><tr>
            <th class="chk"><input type="checkbox" data-checkall ${c?"checked":""} title="Select all / none" /></th>
            <th>Style</th><th>${d?"Shipment · ":""}Variant · SKU</th><th class="num">Accepted</th><th class="num">Printed</th><th class="num">Print</th><th>Barcode</th>
          </tr></thead>
          <tbody>${$}</tbody>
        </table>
        <div class="printbar">
          <button data-print ${g()?"":"disabled"}>Print ${g()} label${g()===1?"":"s"}</button>
          <button class="secondary" data-back>← Shipments</button>
          ${u?'<button class="secondary" data-resetprinted title="Clear the printed-label memory for these rows so Print resets to the full accepted count">Forget printed</button>':""}
          <span class="count">${l} of ${s.length} items selected · 3-1/2 × 1-1/8 in · Code128</span>
        </div>
      </div>`}else{const c=e===null?'<div class="status">Loading transfers…</div>':e.map(l=>{var o,h,N;const d=((o=l.shipments)==null?void 0:o.nodes)||[],u=d.length?d.map(m=>`
            <button class="shipment-row" data-open="${m.id}">
              <span class="name">${m.name}</span>
              ${w(m.status)}
              <span class="dim">${P(m.dateReceived||m.dateCreated)}</span>
              <span class="dim">${m.totalAcceptedQuantity}/${m.lineItemTotalQuantity} accepted</span>
            </button>`).join(""):'<div class="status">Nothing received yet — labels print once a shipment is received.</div>',$=d.length>1?`<button class="secondary allships" data-opentransfer="${l.id}">All ${d.length} shipments combined</button>`:"";return`
        <div class="card">
          <h2>${l.name} ${w(l.status)}
            <span class="dim" style="font-weight:500">&nbsp; ${((h=l.origin)==null?void 0:h.name)||"?"} → ${((N=l.destination)==null?void 0:N.name)||"?"} · ${P(l.dateCreated)}</span>
          </h2>
          ${u}
          ${$}
        </div>`}).join("");a=`
      <form class="searchbar" data-searchform>
        <input id="tsearch" type="search" placeholder="Search transfer # (e.g. T0541)" value="${f(i.search)}" />
        <button type="submit">Search</button>
        ${i.search?'<button type="button" class="secondary" data-clearsearch>Clear</button>':""}
      </form>
      <div class="status">Labels print from what was <b>accepted</b> on a shipment — items still incoming never print.</div>
      ${c}
      <button class="secondary" data-refresh>Refresh</button>`}y.innerHTML=`
    <div class="topbar">
      <h1>Print Received Labels</h1>
      <span class="sub">from accepted shipment quantities — not the transfer</span>
      <span class="version">${x}</span>
    </div>
    <main>
      ${n?`<div class="status error">${n}</div>`:""}
      ${r?`<div class="status">${r}</div>`:""}
      ${a}
    </main>`}y.addEventListener("click",e=>{const t=e.target.closest("[data-check]");if(t){i.rows[Number(t.dataset.check)].selected=t.checked,p();return}const s=e.target.closest("[data-checkall]");if(s){const a=s.checked;i.rows.forEach(c=>{c.selected=a}),p();return}if(e.target.closest("[data-clearsearch]"))return i.search="",b();const r=e.target.closest("[data-open]");if(r)return V(r.dataset.open);const n=e.target.closest("[data-opentransfer]");if(n)return _(n.dataset.opentransfer);if(e.target.closest("[data-resetprinted]")){M(i.rows),i.rows.forEach(a=>{a.printed=0,a.qty=a.accepted}),p();return}if(e.target.closest("[data-refresh]"))return b();if(e.target.closest("[data-back]")){i.shipment=null,i.rows=[],p();return}if(e.target.closest("[data-print]"))return J()});y.addEventListener("submit",e=>{var t;e.target.closest("[data-searchform]")&&(e.preventDefault(),i.search=(((t=document.getElementById("tsearch"))==null?void 0:t.value)||"").trim(),b())});y.addEventListener("input",e=>{const t=e.target.closest("[data-qty]");if(t){i.rows[Number(t.dataset.qty)].qty=Math.max(0,Number(t.value)||0);const s=y.querySelector("[data-print]");if(s){const r=g();s.textContent=`Print ${r} label${r===1?"":"s"}`,s.disabled=!r}}});b();
