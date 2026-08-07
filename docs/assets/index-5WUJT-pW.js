(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))r(a);new MutationObserver(a=>{for(const o of a)if(o.type==="childList")for(const i of o.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&r(i)}).observe(document,{childList:!0,subtree:!0});function n(a){const o={};return a.integrity&&(o.integrity=a.integrity),a.referrerPolicy&&(o.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?o.credentials="include":a.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function r(a){if(a.ep)return;a.ep=!0;const o=n(a);fetch(a.href,o)}})();const R="v9";async function E(t,e){const r=await(await fetch("shopify:admin/api/2026-07/graphql.json",{method:"POST",body:JSON.stringify({query:t,variables:e})})).json();if(r.errors)throw new Error(r.errors.map(a=>a.message).join("; "));return r.data}async function C(t){var n;const e=await E(`#graphql
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
    }`,{q:t||null});return((n=e==null?void 0:e.inventoryTransfers)==null?void 0:n.nodes)||[]}async function j(t){const e=t.replace(/^#/,"").trim(),n=await C(e);if(n.length)return n;const r=await C(null),a=e.toLowerCase();return r.filter(o=>(o.name||"").toLowerCase().includes(a))}async function P(t){var r,a;let e=null,n=null;do{const o=await E(`#graphql
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
      }`,{id:t,after:n}),i=o==null?void 0:o.inventoryShipment;if(!i)return e;e||(e={id:i.id,name:i.name,status:i.status,lines:[]}),e.lines.push(...((r=i.lineItems)==null?void 0:r.nodes)||[]);const l=(a=i.lineItems)==null?void 0:a.pageInfo;n=l!=null&&l.hasNextPage?l.endCursor:null}while(n);return e}const T="asb-labels:printed:v1",B=4800*3600*1e3;function S(){try{return JSON.parse(localStorage.getItem(T))||{}}catch{return{}}}function I(t){try{const e=Date.now()-B;for(const n of Object.keys(t))(!t[n]||t[n].t<e)&&delete t[n];localStorage.setItem(T,JSON.stringify(t))}catch{}}function L(t){var e;return((e=S()[t])==null?void 0:e.n)||0}function M(t){var n;const e=S();for(const r of t)e[r.lineId]={n:(((n=e[r.lineId])==null?void 0:n.n)||0)+r.qty,t:Date.now()};I(e)}function F(t){const e=S();for(const n of t)delete e[n.lineId];I(e)}function k(t){const e=document.createElement("div");e.className="label";const n=document.createElement("div");n.className="style",n.textContent=t.style||"—",e.appendChild(n);const r=document.createElement("div");r.className="body";const a=document.createElement("div");a.className="info";const o=document.createElement("div");o.className="meta",o.textContent=t.meta||"",a.appendChild(o);const i=document.createElement("div");if(i.className="price",t.retail){const u=document.createElement("span");u.className="retail",u.textContent=N(t.retail),i.appendChild(u)}if(t.price!=null){const u=document.createElement("span");u.className="now",u.textContent=N(t.price),i.appendChild(u)}a.appendChild(i),r.appendChild(a);const l=document.createElement("div");l.className="barcode";const d=document.createElementNS("http://www.w3.org/2000/svg","svg");return l.appendChild(d),r.appendChild(l),e.appendChild(r),JsBarcode(d,String(t.barcode).trim(),{format:"CODE128",width:2,height:40,margin:6,displayValue:!0,fontSize:13,textMargin:2}),d.removeAttribute("width"),d.removeAttribute("height"),d.setAttribute("preserveAspectRatio","xMidYMid meet"),e}function Q(t){return/(skis|snowboards)\s*$/i.test(t||"")}function O(t){return String(t||"").replace(/\s+(skis|snowboards)\s*$/i,"").trim()}function V(t){const e=((t==null?void 0:t.tags)||[]).map(r=>/^20(\d\d)$/.exec(String(r).trim())).filter(Boolean).map(r=>r[1]);if(e.length)return`'${e.sort().pop()}`;const n=/\b20(\d\d)\b/.exec((t==null?void 0:t.title)||"");return n?`'${n[1]}`:""}const _=/\b(skis?|snowboards?|flat|system|w|womens|women's|mens|men's|kids|youth|junior|jr|boys|girls)\b/gi;function J(t,e){let n=String(t||"").replace(/\([^)]*\)/g," ");const r=[e,O(e)].flatMap(a=>[a,...String(a||"").split("/")]).map(a=>String(a||"").trim()).filter(Boolean).sort((a,o)=>o.length-a.length);for(const a of r)if(n.toLowerCase().startsWith(a.toLowerCase())){n=n.slice(a.length);break}return n.replace(/\b20\d\d\b/g," ").replace(_," ").replace(/\s+/g," ").trim()}function K(t){const e=((t==null?void 0:t.selectedOptions)||[]).filter(a=>a.value&&!A(a.value)),n=e.find(a=>/\d+(\.\d+)?\s*cm\b/i.test(a.value))||e.find(a=>/size|length/i.test(a.name||"")),r=((n==null?void 0:n.value)||"").replace(/\([^)]*\)/g,"").trim();return r==="Default Title"?"":r}function U(t){const e=document.createElement("div");e.className="label tag";const n=document.createElement("div");n.className="tag-top";const r=document.createElement("span");r.className="tag-brand",r.textContent=t.brand||"";const a=document.createElement("span");a.className="tag-year",a.textContent=t.year||"",n.append(r,a),e.appendChild(n);const o=document.createElement("div");o.className="tag-model",o.textContent=t.model||"",e.appendChild(o);const i=document.createElement("div");return i.className="tag-size",i.textContent=t.size||"",e.appendChild(i),e}function W(t){t.style.cssText="display:block;position:absolute;left:-9999px;top:0;";for(const e of t.querySelectorAll(".tag-model")){let n=30;for(e.style.fontSize=n+"pt";n>12&&e.scrollWidth>e.clientWidth+1;)n-=2,e.style.fontSize=n+"pt"}t.style.cssText=""}const h=document.getElementById("app"),y=document.getElementById("print-sheet"),s={transfers:null,search:"",shipment:null,rows:[],tags:null,tagsOpen:!1,message:"",error:""};function m(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function A(t){return/\$/.test(t)||/\d\.\d{2}\b/.test(t)||/retail/i.test(t)}function H(t){return((t==null?void 0:t.selectedOptions)||[]).filter(e=>e.value&&e.value!=="Default Title"&&!/retail|price/i.test(e.name)&&!A(e.value)).map(e=>e.value).join(" · ")}function N(t){return`$${Number(t).toFixed(2)}`}function Y(t){const e=parseFloat(t==null?void 0:t.price);let n=(t==null?void 0:t.compareAtPrice)!=null?parseFloat(t.compareAtPrice):NaN;if(!(n>0)){const a=((t==null?void 0:t.selectedOptions)||[]).find(o=>/retail/i.test(o.name));if(a){const o=parseFloat(String(a.value).replace(/[^0-9.]/g,""));o>0&&(n=o)}}const r=e>0&&n>e+.001;return{price:e>0?e:null,retail:r?n:null}}function x(t){return t?new Date(t).toLocaleDateString(void 0,{month:"short",day:"numeric"}):""}function w(t){return`<span class="badge ${t==="RECEIVED"?"received":/PARTIAL/i.test(t)?"partial":""}">${(t||"").replace(/_/g," ").toLowerCase()}</span>`}async function v(){s.transfers=null,s.error="",p();try{s.transfers=s.search?await j(s.search):await C(null),s.message=s.transfers.length?"":s.search?`No transfers matching “${s.search}”.`:"No transfers found."}catch(t){s.transfers=[],s.error=`Couldn't load transfers: ${t.message}`}p()}function z(t,e){var i,l,d,u,g,c;const n=(i=t.inventoryItem)==null?void 0:i.variant,r=Y(n),a=t.acceptedQuantity,o=L(t.id);return{lineId:t.id,ship:e||"",style:((l=n==null?void 0:n.product)==null?void 0:l.title)||((d=t.inventoryItem)==null?void 0:d.sku)||"Unknown item",meta:H(n),sku:((u=t.inventoryItem)==null?void 0:u.sku)||"",barcode:((n==null?void 0:n.barcode)||"").trim(),price:r.price,retail:r.retail,accepted:a,printed:o,qty:Math.max(0,a-o),selected:!0,taggable:Q((g=n==null?void 0:n.product)==null?void 0:g.productType),vendor:((c=n==null?void 0:n.product)==null?void 0:c.vendor)||"",year:V(n==null?void 0:n.product),size:K(n)}}function G(){return s.rows.map((t,e)=>({r:t,i:e})).filter(({r:t})=>t.taggable).map(({r:t,i:e})=>({src:e,brand:O(t.vendor),model:J(t.style,t.vendor),year:t.year,size:t.size,qty:t.qty}))}async function X(t){s.message="Loading shipment…",s.error="",p();try{const e=await P(t);s.shipment=e,s.rows=((e==null?void 0:e.lines)||[]).map(n=>z(n)),s.tags=null,s.tagsOpen=!1,s.message=""}catch(e){s.error=`Couldn't load shipment: ${e.message}`}p()}async function Z(t){var r;const e=(s.transfers||[]).find(a=>a.id===t),n=((r=e==null?void 0:e.shipments)==null?void 0:r.nodes)||[];s.message=`Loading ${n.length} shipment${n.length===1?"":"s"}…`,s.error="",p();try{const a=[];for(const o of n){const i=await P(o.id);for(const l of(i==null?void 0:i.lines)||[])a.push(z(l,i.name))}s.shipment={name:`${(e==null?void 0:e.name)||"Transfer"} — all shipments`,status:(e==null?void 0:e.status)||""},s.rows=a,s.tags=null,s.tagsOpen=!1,s.message=""}catch(a){s.error=`Couldn't load transfer: ${a.message}`}p()}function tt(){const t=s.rows.filter(a=>a.selected&&a.qty>0&&a.barcode);y.innerHTML="";const e=[];for(const a of t)try{const o=k(a);y.appendChild(o);for(let i=1;i<a.qty;i++)y.appendChild(k(a))}catch{e.push(a);continue}const n=t.filter(a=>!e.includes(a)),r=n.reduce((a,o)=>a+o.qty,0);M(n);for(const a of n)a.printed=L(a.lineId),a.qty=Math.max(0,a.accepted-a.printed);window.print(),s.message=`Sent ${r} label${r===1?"":"s"} (${n.length} item${n.length===1?"":"s"}) to the printer.`,s.error=e.length?`⚠ ${e.length} item${e.length===1?"":"s"} SKIPPED — barcode couldn't be encoded: ${e.map(a=>a.sku||a.style).join(", ")}`:"",p()}function $(){return s.rows.reduce((t,e)=>t+(e.selected&&e.barcode?e.qty:0),0)}function D(){return(s.tags||[]).reduce((t,e)=>t+e.qty,0)}function et(){const t=(s.tags||[]).filter(n=>n.qty>0&&(n.model||n.brand||n.size));y.innerHTML="";for(const n of t)for(let r=0;r<n.qty;r++)y.appendChild(U(n));W(y),window.print();const e=t.reduce((n,r)=>n+r.qty,0);s.message=`Sent ${e} backstock tag${e===1?"":"s"} to the printer.`,s.error="",p()}function nt(t){const e=t.filter(a=>a.taggable).length;if(!e&&!(s.tags||[]).length)return"";if(!s.tagsOpen)return`<button class="secondary" data-tagstoggle>Backstock tags (${e} ski/board item${e===1?"":"s"}) ▸</button>`;const n=(s.tags||[]).map((a,o)=>`
      <tr>
        <td><input type="text" class="tag-in brand" data-tagfield="brand" data-tagidx="${o}" value="${m(a.brand)}" /></td>
        <td><input type="text" class="tag-in model" data-tagfield="model" data-tagidx="${o}" value="${m(a.model)}" /></td>
        <td><input type="text" class="tag-in year" data-tagfield="year" data-tagidx="${o}" value="${m(a.year)}" placeholder="'27" /></td>
        <td><input type="text" class="tag-in size" data-tagfield="size" data-tagidx="${o}" value="${m(a.size)}" /></td>
        <td class="num"><input type="number" min="0" max="999" value="${a.qty}" data-tagqty="${o}" /></td>
      </tr>`).join(""),r=D();return`
    <div class="card">
      <h2>Backstock tags <button class="secondary tags-collapse" data-tagstoggle>▴ hide</button></h2>
      <div class="status">Big-text tape replacement — one tag per <b>pair</b>. Fields are parsed guesses: fix the model here (or shorten it — “BP88” prints just as big). Tag counts started from the Print column.</div>
      <table>
        <thead><tr>
          <th>Brand</th><th>Model</th><th>Year</th><th>Size</th><th class="num">Tags</th>
        </tr></thead>
        <tbody>${n}</tbody>
      </table>
      <div class="printbar">
        <button data-printtags ${r?"":"disabled"}>Print ${r} tag${r===1?"":"s"}</button>
        <button class="secondary" data-tagadd>+ Add tag</button>
        <button class="secondary" data-tagsync title="Reset every tag count to its row's current Print count">Use print counts</button>
        <span class="count">same 3-1/2 × 1-1/8 in stock · no barcode</span>
      </div>
    </div>`}function p(){const{transfers:t,shipment:e,rows:n,message:r,error:a}=s;let o="";if(e){const i=n.length>0&&n.every(c=>c.selected),l=n.filter(c=>c.selected).length,d=n.some(c=>c.ship),u=n.some(c=>c.printed>0),g=n.map((c,b)=>`
      <tr class="${c.selected?"":"unselected"}">
        <td class="chk"><input type="checkbox" data-check="${b}" ${c.selected?"checked":""} /></td>
        <td>${m(c.style)}</td>
        <td>${m([d?c.ship:"",c.meta,c.sku].filter(Boolean).join(" · "))||"—"}</td>
        <td class="num">${c.accepted}</td>
        <td class="num${c.printed?"":" dim"}">${c.printed}</td>
        <td class="num"><input type="number" min="0" max="999" value="${c.qty}" data-qty="${b}" ${c.barcode&&c.selected?"":"disabled"} /></td>
        <td>${c.barcode?m(c.barcode):'<span class="nobarcode">⚠ NO BARCODE</span>'}</td>
      </tr>`).join("");o=`
      <div class="card">
        <h2>${m(e.name)} ${w(e.status)}</h2>
        ${u?'<div class="status">Print counts default to <b>accepted − already printed</b>, so a repeat receive session only prints the new units. Use “Forget printed” to reprint everything.</div>':""}
        <table>
          <thead><tr>
            <th class="chk"><input type="checkbox" data-checkall ${i?"checked":""} title="Select all / none" /></th>
            <th>Style</th><th>${d?"Shipment · ":""}Variant · SKU</th><th class="num">Accepted</th><th class="num">Printed</th><th class="num">Print</th><th>Barcode</th>
          </tr></thead>
          <tbody>${g}</tbody>
        </table>
        <div class="printbar">
          <button data-print ${$()?"":"disabled"}>Print ${$()} label${$()===1?"":"s"}</button>
          <button class="secondary" data-back>← Shipments</button>
          ${u?'<button class="secondary" data-resetprinted title="Clear the printed-label memory for these rows so Print resets to the full accepted count">Forget printed</button>':""}
          <span class="count">${l} of ${n.length} items selected · 3-1/2 × 1-1/8 in · Code128</span>
        </div>
      </div>
      ${nt(n)}`}else{const i=t===null?'<div class="status">Loading transfers…</div>':t.map(l=>{var c,b,q;const d=((c=l.shipments)==null?void 0:c.nodes)||[],u=d.length?d.map(f=>`
            <button class="shipment-row" data-open="${f.id}">
              <span class="name">${f.name}</span>
              ${w(f.status)}
              <span class="dim">${x(f.dateReceived||f.dateCreated)}</span>
              <span class="dim">${f.totalAcceptedQuantity}/${f.lineItemTotalQuantity} accepted</span>
            </button>`).join(""):'<div class="status">Nothing received yet — labels print once a shipment is received.</div>',g=d.length>1?`<button class="secondary allships" data-opentransfer="${l.id}">All ${d.length} shipments combined</button>`:"";return`
        <div class="card">
          <h2>${l.name} ${w(l.status)}
            <span class="dim" style="font-weight:500">&nbsp; ${((b=l.origin)==null?void 0:b.name)||"?"} → ${((q=l.destination)==null?void 0:q.name)||"?"} · ${x(l.dateCreated)}</span>
          </h2>
          ${u}
          ${g}
        </div>`}).join("");o=`
      <form class="searchbar" data-searchform>
        <input id="tsearch" type="search" placeholder="Search transfer # (e.g. T0541)" value="${m(s.search)}" />
        <button type="submit">Search</button>
        ${s.search?'<button type="button" class="secondary" data-clearsearch>Clear</button>':""}
      </form>
      <div class="status">Labels print from what was <b>accepted</b> on a shipment — items still incoming never print.</div>
      ${i}
      <button class="secondary" data-refresh>Refresh</button>`}h.innerHTML=`
    <div class="topbar">
      <h1>Print Received Labels</h1>
      <span class="sub">from accepted shipment quantities — not the transfer</span>
      <span class="version">${R}</span>
    </div>
    <main>
      ${a?`<div class="status error">${a}</div>`:""}
      ${r?`<div class="status">${r}</div>`:""}
      ${o}
    </main>`}h.addEventListener("click",t=>{var o;const e=t.target.closest("[data-check]");if(e){s.rows[Number(e.dataset.check)].selected=e.checked,p();return}const n=t.target.closest("[data-checkall]");if(n){const i=n.checked;s.rows.forEach(l=>{l.selected=i}),p();return}if(t.target.closest("[data-clearsearch]"))return s.search="",v();const r=t.target.closest("[data-open]");if(r)return X(r.dataset.open);const a=t.target.closest("[data-opentransfer]");if(a)return Z(a.dataset.opentransfer);if(t.target.closest("[data-resetprinted]")){F(s.rows),s.rows.forEach(i=>{i.printed=0,i.qty=i.accepted}),p();return}if(t.target.closest("[data-tagstoggle]")){s.tagsOpen=!s.tagsOpen,s.tagsOpen&&!s.tags&&(s.tags=G()),p();return}if(t.target.closest("[data-tagadd]")){s.tags=s.tags||[],s.tags.push({src:null,brand:"",model:"",year:((o=s.tags.find(i=>i.year))==null?void 0:o.year)||"",size:"",qty:1}),p();return}if(t.target.closest("[data-tagsync]")){for(const i of s.tags||[])i.src!=null&&s.rows[i.src]&&(i.qty=s.rows[i.src].qty);p();return}if(t.target.closest("[data-printtags]"))return et();if(t.target.closest("[data-refresh]"))return v();if(t.target.closest("[data-back]")){s.shipment=null,s.rows=[],s.tags=null,s.tagsOpen=!1,p();return}if(t.target.closest("[data-print]"))return tt()});h.addEventListener("submit",t=>{var e;t.target.closest("[data-searchform]")&&(t.preventDefault(),s.search=(((e=document.getElementById("tsearch"))==null?void 0:e.value)||"").trim(),v())});h.addEventListener("input",t=>{const e=t.target.closest("[data-qty]");if(e){s.rows[Number(e.dataset.qty)].qty=Math.max(0,Number(e.value)||0);const a=h.querySelector("[data-print]");if(a){const o=$();a.textContent=`Print ${o} label${o===1?"":"s"}`,a.disabled=!o}return}const n=t.target.closest("[data-tagfield]");if(n){s.tags[Number(n.dataset.tagidx)][n.dataset.tagfield]=n.value;return}const r=t.target.closest("[data-tagqty]");if(r){s.tags[Number(r.dataset.tagqty)].qty=Math.max(0,Number(r.value)||0);const a=h.querySelector("[data-printtags]");if(a){const o=D();a.textContent=`Print ${o} tag${o===1?"":"s"}`,a.disabled=!o}}});v();
