import {priceCents,money,pricingTotal} from './receipt-pricing.mjs?v=compact20261030';
import {quantitySteppers} from './quantity-stepper.mjs?v=stepper20261029';
import {directEnabled,directReview,directSheet,directLog,runDirect} from './direct-sync.mjs?v=compact20261030';
import {SOURCES,parseSheet,exportUrl,csvRows,sheetUrl} from './sheets-data.mjs?v=compact20261030';
import {cloudDraft} from '../src/cloud-transaction.mjs?v=compact20261030';
import {receiptKey,receiptLines,sortReceiptRows,receiptPrice} from './receive-grid-data.mjs?v=compact20261030';
import {today} from './store.mjs';
import {LOSS_ENDPOINT} from './loss-cloud.mjs';
const KEY='tcm-cloud-pending-v1';

export function mountReceiptGrid({esc,fmt,ask}){
 const c=document.querySelector('#content'),$=s=>c.querySelector(s),abort=new AbortController(),quantities=new Map(),prices=new Map();
 let rows=[],source=SOURCES[0],sort='code',direction='asc',alive=true,ticket=0,reuseId='',pending=null;
 const status=text=>{if(alive)$('#receipt-state').textContent=text;};
 c.innerHTML=`<section class="panel"><div class="panelhead"><div><h2>登錄本次進貨</h2><span class="muted">依工作表列出全部品項 · 留白不進貨 · 可跨廠牌整批入帳</span></div><a class="secondary" href="#items">＋ 新增品項</a></div><div class="order-tabs" id="receipt-tabs"></div><form id="receipt-form"><div class="grid"><label>進貨日期<input id="receipt-date" type="date" value="${today()}" max="${today()}" required></label><label>經手人<select id="receipt-actor" data-staff required disabled><option value="">正在讀取員工名冊…</option></select></label><label class="full">備註<input id="receipt-note" maxlength="500"></label></div><div class="panelhead receive-tools"><input id="receipt-search" aria-label="搜尋進貨品項" placeholder="搜尋藥品名稱或編號"><button type="button" id="receipt-refresh" class="secondary">重新讀取工作表</button></div><p id="receipt-state" role="status">正在讀取六個工作表…</p><div class="tablewrap"><table id="receipt-grid"><thead><tr><th><button type="button" class="sort-heading" data-sort="code">藥品／編號 ↑</button></th><th>廠牌／類別</th><th class="num"><button type="button" class="sort-heading" data-sort="bottles">未拆封瓶數 ↕</button></th><th class="receipt-quantity"><button type="button" class="sort-heading" data-sort="quantity">進貨數量 ↕</button></th><th class="receipt-price-cell">單價（元／瓶）</th><th class="num">進貨小計（元）</th><th class="num">入庫後瓶數</th><th><button type="button" class="sort-heading" data-sort="updated">原表更新欄 ↕</button></th><th>缺藥標記／率</th><th>原表</th></tr></thead><tbody></tbody></table></div><div class="actions"><span id="receipt-summary" role="status"></span><button type="button" class="secondary" id="receipt-clear">清除本次輸入</button><button id="receipt-submit" disabled>確認並預覽整批進貨</button></div></form><div id="receipt-pending"></div><p class="muted">先在站內核對各品項原庫存、進貨量與入庫後瓶數，再按「確認入帳」。進貨只增加本次填入數量。單價由原表 E 欄帶入；確認入帳後，有填單價的進貨品項會同步更新 E 欄。留白不清除原表價格，0 為零元。金額依輸入單價計算，未另計稅額、折扣或運費。</p></section>`;
 function draw(){
  if(!alive)return;
  $('#receipt-tabs').innerHTML=SOURCES.map(s=>`<button type="button" class="secondary ${s.gid===source.gid?'selected':''}" data-gid="${s.gid}" aria-pressed="${s.gid===source.gid}">${esc(s.brand)}｜${esc(s.category)}</button>`).join('');
  const query=$('#receipt-search').value.trim().toLowerCase(),list=sortReceiptRows(rows.filter(r=>r.name===source.name&&`${r.drug} ${r.code}`.toLowerCase().includes(query)),quantities,sort,direction);
  $('#receipt-grid tbody').innerHTML=list.map(r=>`<tr data-category="${esc(r.category)}"><td><b>${esc(r.drug)}</b><div class="muted">${esc(r.code)}</div>${r.warning?`<div class="muted">${esc(r.warning)}</div>`:''}</td><td>${esc(r.brand)}<div class="muted">${esc(r.category)}</div></td><td class="num">${r.bottles===null?'待核對':fmt(r.bottles)+' 瓶'}</td><td class="receipt-quantity"><input class="receipt-qty" data-key="${esc(receiptKey(r))}" aria-label="${esc(r.code)} ${esc(r.drug)} 進貨數量" type="number" min="1" max="1000000" step="1" inputmode="numeric" value="${esc(quantities.get(receiptKey(r))??'')}" placeholder="未進貨"></td><td class="receipt-price-cell"><input class="receipt-price" data-price-key="${esc(receiptKey(r))}" aria-label="${esc(r.code)} ${esc(r.drug)} 單價" type="number" min="0" max="1000000" step="0.01" inputmode="decimal" value="${esc(receiptPrice(r,prices))}" placeholder="未提供"><small>${esc(prices.has(receiptKey(r))?'本次輸入':r.priceWarning||'原表 E 欄')}</small></td><td class="num receipt-amount" data-amount="${esc(receiptKey(r))}">—</td><td class="num" data-after="${esc(receiptKey(r))}">—</td><td>${esc(r.updated||'—')}</td><td>${esc([r.stockout,r.shortage].filter(Boolean).join('／')||'—')}</td><td><a href="${sheetUrl(r)}" target="_blank" rel="noopener">查看 ↗</a></td></tr>`).join('')||'<tr><td colspan="10">沒有符合的品項</td></tr>';
  c.querySelectorAll('[data-sort]').forEach(b=>{const active=b.dataset.sort===sort;b.parentElement.setAttribute('aria-sort',active?(direction==='asc'?'ascending':'descending'):'none');b.textContent=b.textContent.replace(/[↑↓↕]$/,active?(direction==='asc'?'↑':'↓'):'↕');});
  c.querySelectorAll('.receipt-qty').forEach(el=>el.oninput=()=>{if(el.value==='')quantities.delete(el.dataset.key);else quantities.set(el.dataset.key,el.value);summary();});
  c.querySelectorAll('.receipt-price').forEach(el=>el.oninput=()=>{prices.set(el.dataset.priceKey,el.value);el.nextElementSibling.textContent='本次輸入';summary();});
  quantitySteppers(c,'.receipt-qty');
  summary();
 }
 function summary(){
  let count=0,total=0,invalid=false;
  for(const v of quantities.values()){if(v==='')continue;count++;const n=Number(v);if(!Number.isInteger(n)||n<1||n>1000000)invalid=true;else total+=n;}
  $('#receipt-summary').textContent=`已填 ${count} 項（含其他分頁） · ${invalid?'請核對數量':fmt(total)+' 瓶'}`;
  const current=[];let priceInvalid=false;
  for(const [key,q] of quantities){const r=rows.find(x=>receiptKey(x)===key);if(!r||!Number.isInteger(Number(q))||Number(q)<1)continue;try{if(r.priceWarning&&!prices.has(key))throw Error();current.push({quantity:Number(q),unitPriceCents:priceCents(receiptPrice(r,prices))});}catch{priceInvalid=true;}}
  try{const cost=pricingTotal(current);$('#receipt-summary').textContent+=' · '+(priceInvalid?'請核對單價':(cost.missing?'已填單價小計 ':'進貨合計 ')+money(cost.cents)+(cost.missing?'（'+cost.missing+' 項未填單價）':''));}catch(e){$('#receipt-summary').textContent+=' · '+e.message;}
  c.querySelectorAll('[data-amount]').forEach(el=>{const key=el.dataset.amount,q=quantities.get(key),r=rows.find(x=>receiptKey(x)===key);el.textContent='—';if(!q||!r)return;try{const cents=priceCents(receiptPrice(r,prices));el.textContent=cents===undefined?'未提供':Number.isInteger(Number(q))&&Number(q)>0?money(cents*Number(q)):'數量無效';}catch{el.textContent='單價待核對';}});
  c.querySelectorAll('[data-after]').forEach(el=>{const v=quantities.get(el.dataset.after),r=rows.find(x=>receiptKey(x)===el.dataset.after),n=Number(v);el.textContent=v==null||v===''?'—':!Number.isInteger(n)||n<1||n>1000000?'數量無效':!Number.isInteger(r?.bottles)||r.bottles<0?'待核對':fmt(r.bottles+n)+' 瓶';});
 }
 async function load(){
  const run=++ticket;status('正在讀取六個工作表…');$('#receipt-submit').disabled=true;
  try{const results=await Promise.all(SOURCES.map(async s=>{const res=directEnabled()?await directSheet(s,abort.signal):await fetch(exportUrl(s),{cache:'no-store',signal:abort.signal});if(!res.ok||!res.headers.get('content-type')?.includes('text/csv'))throw Error('Google 品項讀取失敗');return parseSheet(await res.text(),s);}));if(!alive||run!==ticket)return;rows=results.flat();draw();status(`${source.name} · ${rows.filter(r=>r.name===source.name).length} 項 · 以確認視窗的最新庫存為準`);}
  catch(e){status(e.message+'；已填數量仍保留');}
  finally{if(alive&&run===ticket)$('#receipt-submit').disabled=!rows.length;}
 }
 function showPending(){
  try{pending=JSON.parse(localStorage.getItem(KEY)||'null');}catch{pending=null;}
  $('#receipt-pending').innerHTML=pending?`<h3>${pending.verified?'上次已核對交易':'上次待核對交易'}</h3><p>${esc(pending.action)} · ${esc(pending.id)} · ${esc(pending.lines.map(l=>l.code+' '+l.quantity+'瓶').join('；'))}</p><div class="actions">${!pending.verified&&pending.action==='進貨'?'<button type="button" id="receipt-edit" class="secondary">修改未入帳內容（沿用編號）</button>':''}<button type="button" id="receipt-check" class="secondary">讀回工作表核對結果</button><button type="button" id="receipt-resume">以同一交易重新核對</button></div>`:'';
  if(!pending)return;
  $('#receipt-resume').onclick=()=>send(cloudDraft(pending));
  $('#receipt-check').onclick=async()=>{try{const d=cloudDraft(pending),res=await directLog(['訂貨','取消訂貨'].includes(d.action)?'orders':'inventory'),found=csvRows(await res.text()).slice(1).find(r=>r[0]===d.id);if(!found)throw Error('尚未查到入帳紀錄，請使用同一交易重新核對');const posted=JSON.parse(found[1]).draft;localStorage.setItem(KEY,JSON.stringify({...posted,verified:true}));reuseId='';showPending();status('已讀回原交易；如有未送出的數量，請核對後再建立新單。');}catch(e){status(e.message);}};
  if($('#receipt-edit'))$('#receipt-edit').onclick=()=>{reuseId=pending.id;quantities.clear();prices.clear();for(const l of pending.lines){const key=receiptKey({name:l.sheet,code:l.code,drug:l.name});quantities.set(key,String(l.quantity));prices.set(key,l.unitPriceCents===undefined?'':String(l.unitPriceCents/100));}$('#receipt-date').value=pending.date;$('#receipt-actor').value=pending.actor;$('#receipt-note').value=pending.note;draw();status('已載入待核對內容，修改後會沿用原交易編號。');};
 }
 function send(d){
  if(directEnabled())return directReview(d,ask,async()=>{localStorage.setItem(KEY,JSON.stringify({...d,verified:true}));reuseId='';if(alive){quantities.clear();prices.clear();showPending();await load();}},status);
  const form=document.createElement('form');form.method='POST';form.action=LOSS_ENDPOINT;form.target='_blank';const input=document.createElement('input');input.type='hidden';input.name='payload';input.value=JSON.stringify(d);form.append(input);document.body.append(form);form.submit();form.remove();status('已開啟 Google 核對頁，請以同一交易核對結果。');
 }
 $('#receipt-tabs').onclick=e=>{const b=e.target.closest('[data-gid]');if(!b)return;source=SOURCES.find(s=>String(s.gid)===b.dataset.gid);draw();status(`${source.name} · ${rows.filter(r=>r.name===source.name).length} 項 · 已填數量保留`);};
 $('#receipt-search').oninput=draw;$('#receipt-refresh').onclick=()=>{load();};
 $('#receipt-clear').onclick=()=>{quantities.clear();prices.clear();draw();status('已清除本次輸入，未修改工作表。');};
 c.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{direction=sort===b.dataset.sort&&direction==='asc'?'desc':'asc';sort=b.dataset.sort;draw();});
 $('#receipt-form').onsubmit=e=>{e.preventDefault();try{const prior=JSON.parse(localStorage.getItem(KEY)||'null');if(prior&&!prior.verified&&reuseId!==prior.id)throw Error('上一筆尚未核對，請先讀回結果或按「修改未入帳內容」，避免重複入帳');const lines=receiptLines(rows,quantities,prices),priced=lines.some(l=>l.unitPriceCents!==undefined);const d=cloudDraft({kind:'tcm-cloud',version:priced?2:1,...(priced?{currency:'TWD'}:{}),id:reuseId||'ERP-'+crypto.randomUUID(),action:'進貨',date:$('#receipt-date').value,actor:$('#receipt-actor').value,note:$('#receipt-note').value,lines});localStorage.setItem(KEY,JSON.stringify(d));showPending();send(d);}catch(e){status(e.message);}};
 const sync=()=>{load();};draw();showPending();window.addEventListener('erp-synced',sync);sync();return()=>{alive=false;ticket++;abort.abort();window.removeEventListener('erp-synced',sync);};
}
