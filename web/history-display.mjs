import {receiptExplanation} from '../src/receipt-explanation.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
export function historyEntries(result){
 const entries=result.flatMap(({s,rows=[]})=>rows.filter(r=>r.some(v=>String(v??'').trim())).map((r,index)=>{
  let event;try{event=JSON.parse(r[1]);}catch{}
  const loss=s.title==='耗損',d=event?.draft,action=loss?'耗損':d?.action||r[3],type=action==='建檔'?'建帳':action==='沖銷'||action==='取消訂貨'?'沖銷':['訂貨','進貨','耗損'].includes(action)?action:'其他';
  const lines=loss?[{sheet:r[3],code:r[4],name:r[5]}]:(Array.isArray(d?.lines)?d.lines:[]);
  const note=loss?r[10]:d?.note||r[5],actor=loss?r[11]:d?.actor||r[4];
  const marked=lines.some(l=>/^QA[-_]/i.test(l.code||'')||/^QA[-_]/i.test(l.name||''))||[note,actor,r[0]].some(v=>/(?:^|[\s:：·｜])QA[-_]|測試|驗收/i.test(v||''));
  return {id:r[0],date:r[2],time:loss?r[13]:r[8],actor,note,action,type,lines,marked,reverses:d?.reverses||'',rawStatus:loss?'':r[7],source:s,index,valid:loss?!!event:!!d,event,
   before:loss?number(r[6]):null,total:loss?number(r[7]):null,delta:loss?number(r[8]):null,stock:loss?number(r[9]):null,fallback:loss?[r[3],r[4],r[5]].join(' '):r[6]};
 }));
 const reversed=new Set(entries.filter(e=>e.type==='沖銷'&&e.valid).map(e=>e.reverses).filter(Boolean));
 // A reversal inherits an explicit test mark from its original transaction.
 const testIds=new Set(entries.filter(e=>e.marked).map(e=>e.id));
 for(const e of entries){e.marked=e.marked||testIds.has(e.reverses);e.reversed=reversed.has(e.id)||e.rawStatus==='已取消・未發送';
  e.label=e.action==='取消訂貨'?'訂貨取消':e.action==='沖銷'?'進貨沖銷':e.type;
  e.status=!e.valid?'內容待核對':e.action==='訂貨'?(e.reversed?'訂貨已取消，未入庫':'訂量已登記，尚未入庫'):e.action==='取消訂貨'?'已取消訂貨，未增減庫存':e.action==='進貨'?(e.reversed?'這筆進貨已沖銷':'進貨已入帳'):e.action==='沖銷'?'已撤回原進貨的庫存異動':e.action==='建檔'?'品項與期初庫存已建立':e.type==='耗損'?(e.delta===null?'耗損差額待核對':e.delta>0?'扣除 '+e.delta+' 瓶':e.delta<0?'更正累計，加回 '+(-e.delta)+' 瓶':'累計相同，未增減庫存'):'請查看原始紀錄';
  e.canReverse=e.valid&&!e.reversed&&['進貨','訂貨'].includes(e.action)&&e.rawStatus!=='';
 }
 return entries.sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.time).localeCompare(String(a.time))||b.index-a.index);
}
function lineText(e,l){return [l.sheet,l.name,l.code,e.type==='耗損'?'':(e.type==='建帳'?'期初 ':e.action==='取消訂貨'?'取消訂貨 ':e.action==='訂貨'?'訂貨 ':e.action==='沖銷'?'沖銷 ':'進貨 ')+String(l.quantity??'待核對')+' 瓶'].filter(Boolean).join(' · ');}
const searchText=v=>String(v??'').normalize('NFKC').trim().toLocaleLowerCase('zh-TW');
function historyDate(value){const m=String(value??'').match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);if(!m)return '';const d=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');return Number.isNaN(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d?'':d;}
export function filterHistoryEntries(entries,{type='全部',test='全部',from='',to='',drug='',actor=''}={}){
 const start=historyDate(from),end=historyDate(to);if((from&&!start)||(to&&!end))throw Error('請輸入有效的起訖日期');if(start&&end&&start>end)throw Error('開始日期不能晚於結束日期，請調整日期區間');
 const terms=searchText(drug).split(/\s+/).filter(Boolean),person=searchText(actor);
 return entries.filter(e=>{const date=historyDate(e.date);return (type==='全部'||e.type===type)&&(test==='全部'||(test==='測試'?e.marked:!e.marked))&&(!start||date&&date>=start)&&(!end||date&&date<=end)&&(!person||searchText(e.actor).includes(person))&&(!terms.length||(e.lines.length?e.lines.some(l=>{const text=searchText([l.name,l.code].join(' '));return terms.every(t=>text.includes(t));}):terms.every(t=>searchText(e.fallback).includes(t))));});
}
function supplierLabel(line){
 const sheet=String(line.sheet??'').trim(),match=sheet.match(/^(.*?)\s*(單方|複方)$/);
 return match?[match[1]||'未記錄',match[2]]:[sheet||'未記錄','未記錄'];
}
function quantityLabel(entry,line){
 if(entry.type==='耗損')return '當日累計：'+(entry.before??'待核對')+' → '+(entry.total??'待核對')+' 瓶';
 const prefix=entry.type==='建帳'?'期初 ':entry.action==='取消訂貨'?'取消訂貨 ':entry.action==='沖銷'?'沖銷 ':entry.action==='訂貨'?'訂貨 ':'進貨 ';
 return prefix+(line.quantity??'待核對')+' 瓶';
}
export function renderHistory(entries,filters={}){
 let shown;try{shown=filterHistoryEntries(entries,filters);}catch(e){return '<p role="alert">'+esc(e.message)+'</p>';}
 const rows=shown.map(e=>{
  const receipt=e.action==='進貨'&&e.valid?receiptExplanation(e.event):null;
  const lines=e.lines.length?(receipt?receipt.lines:e.lines).slice(0,3):[null],span=lines.length;
  return lines.map((line,index)=>{
   const [brand,category]=supplierLabel(line||{});
   const product=line?'<b>'+esc(line.name||'未記錄藥品')+'</b><div class="muted">'+esc(line.code||'未填編號')+'</div>':esc(e.fallback||'內容待核對');
   const more=index===span-1&&e.lines.length>3?'<div class="muted">另有 '+(e.lines.length-3)+' 項，請展開明細</div>':'';
   return `<tr class="history-item-row">${index===0?`<td rowspan="${span}">${esc(e.date)}</td><td rowspan="${span}"><strong>${esc(e.label)}</strong>${e.marked?'<div><span class="pill warn">測試紀錄</span></div>':''}</td>`:''}<td class="history-product">${product}${more}</td><td class="history-supplier">${esc(brand)}<div class="muted">${esc(category)}</div></td><td class="history-quantity">${line?esc(quantityLabel(e,line)):'待核對'}</td><td>${receipt?esc(line.beforeText):'—'}</td><td>${receipt?esc(line.afterText):'—'}</td><td>${receipt?esc(line.priceText):'—'}</td><td>${receipt?esc(line.amountText):'—'}</td>${index===0?`<td rowspan="${span}">${esc(e.status)}</td><td rowspan="${span}">${esc(e.actor||'未記錄')}</td><td rowspan="${span}"><details><summary>查看明細</summary><p>交易編號：${esc(e.id)}</p>${e.reverses?`<p>對應原交易：${esc(e.reverses)}</p>`:''}<p>記錄時間：${esc(e.time||'未記錄')}</p><p>備註：${esc(e.note||'無')}</p>${e.marked?'<p>測試標記來自品項編號、備註、經手人或對應原交易；標記本身不代表已還原。</p>':''}${receipt?`<div class="history-explanation">${esc(receipt.text).replaceAll('\n','<br>')}</div><p class="muted">入庫前後瓶數為本次交易當時的紀錄；後續進貨、耗損或沖銷會影響目前庫存。</p>`:''}${!receipt&&e.lines.length?`<ul>${e.lines.map(l=>`<li>${esc(lineText(e,l))}</li>`).join('')}</ul>`:''}${e.type==='耗損'?`<p>此筆入帳後庫存：${esc(e.stock??'待核對')} 瓶（歷史數字，不是目前庫存）</p>`:''}<p>原始狀態：${esc(e.rawStatus||(e.type==='耗損'?'耗損更正紀錄':'未記錄'))}</p><a target="_blank" rel="noopener" href="https://docs.google.com/spreadsheets/d/${esc(e.source.id)}/edit#gid=${esc(e.source.gid)}">查看原始工作表 ↗</a>${e.canReverse?`<p><button type="button" class="secondary" data-reverse="${esc(e.id)}">${e.action==='訂貨'?'取消這筆訂貨':'沖銷這筆進貨'}</button></p>`:''}</details></td>`:''}</tr>`;
  }).join('');
 }).join('');
 return `<p role="status">顯示 ${shown.length} 筆，共 ${entries.length} 筆；${entries.filter(e=>e.marked).length} 筆有測試標記。</p><div class="tablewrap"><table class="history-readable"><thead><tr><th>日期</th><th>類型</th><th class="history-product">藥品／編號</th><th class="history-supplier">廠牌／類別</th><th>數量／本次進貨</th><th>入庫前瓶數</th><th>入庫後瓶數</th><th>單價</th><th>小計</th><th>結果</th><th>經手人</th><th>明細</th></tr></thead><tbody>${rows||'<tr><td colspan="12">沒有符合條件的紀錄</td></tr>'}</tbody></table></div>`;
}
