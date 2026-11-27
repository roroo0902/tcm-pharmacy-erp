import {orderLabel,transactionLabel} from '../src/order-label.mjs';
import {isOperationalOrderQa} from '../src/orders.mjs?v=release20261120r1';
import {orderPrintControl} from './order-print.mjs';
import {receiptExplanation} from '../src/receipt-explanation.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
export function historyEntries(result){
 const entries=result.flatMap(({s,rows=[]})=>rows.filter(r=>r.some(v=>String(v??'').trim())).map((r,index)=>{
  let event;try{event=JSON.parse(r[1]);}catch{}
  const loss=s.title==='耗損',d=event?.draft,action=loss?'耗損':d?.action||r[3],type=action==='建檔'?'建帳':action==='沖銷'||action==='取消訂貨'?'沖銷':['訂貨','進貨','耗損'].includes(action)?action:'其他';
  const lines=loss?[{sheet:r[3],code:r[4],name:r[5]}]:(Array.isArray(d?.lines)?d.lines:[]);
  const note=loss?r[10]:d?.note||r[5],actor=loss?r[11]:d?.actor||r[4];
  const marked=lines.some(l=>isOperationalOrderQa(l.sheet,l.code)||(l.name==='ERP驗收專用・非藥品'&&/^QA[0-9]{8}[A-Z]$/i.test(l.code||''))||/^QA[-_]/i.test(l.code||'')||/^QA[-_]/i.test(l.name||''))||[note,actor,r[0]].some(v=>/(?:^|[\s:：·｜])QA[-_]|測試|驗收/i.test(v||''));
  return {id:r[0],date:r[2],time:loss?r[13]:r[8],actor,note,action,type,lines,marked,reverses:d?.reverses||'',rawStatus:loss?'':r[7],source:s,index,valid:loss?!!event:!!d,event,
   before:loss?number(r[6]):null,total:loss?number(r[7]):null,delta:loss?number(r[8]):null,stock:loss?number(r[9]):null,fallback:loss?[r[3],r[4],r[5]].join(' '):r[6]};
 }));
 const timestamps=new Map(entries.map(e=>[e.id,e.event?.time||e.time]));
 const reversed=new Set(entries.filter(e=>e.type==='沖銷'&&e.valid).map(e=>e.reverses).filter(Boolean));
 // A reversal inherits an explicit test mark from its original transaction.
 const testIds=new Set(entries.filter(e=>e.marked).map(e=>e.id));
 for(const e of entries){e.marked=e.marked||testIds.has(e.reverses);e.reversed=reversed.has(e.id)||e.rawStatus==='已取消・未發送';
  e.displayId=transactionLabel(e,timestamps.get(e.id));
  e.displayReverses=e.reverses&&e.action==='取消訂貨'?orderLabel(timestamps.get(e.reverses)):e.reverses;
  e.label=e.action==='取消訂貨'?'訂貨取消':e.action==='沖銷'?'進貨沖銷':e.type;
  e.status=!e.valid?'內容待核對':e.action==='訂貨'?(e.reversed?'訂貨已取消，未入庫':'訂量已登記，尚未入庫'):e.action==='取消訂貨'?'已取消訂貨，未增減庫存':e.action==='進貨'?(e.reversed?'這筆進貨已沖銷':'進貨已入帳'):e.action==='沖銷'?'已撤回原進貨的庫存異動':e.action==='建檔'?'品項與期初庫存已建立':e.type==='耗損'?(e.delta===null?'耗損差額待核對':e.delta>0?'扣除 '+e.delta+' 瓶':e.delta<0?'更正累計，加回 '+(-e.delta)+' 瓶':'累計相同，未增減庫存'):'請查看原始紀錄';
  e.canReverse=e.valid&&!e.reversed&&['進貨','訂貨'].includes(e.action)&&e.rawStatus!=='';
 }
 return entries.sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.time).localeCompare(String(a.time))||b.index-a.index);
}
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
  const lines=receipt?.lines||e.lines;
  const first=lines[0];
  const sheets=[...new Set(lines.map(l=>l.sheet).filter(Boolean))];
  const sheet=sheets.length===1?sheets[0]:sheets.length>1?'跨廠牌／類別':'';
  const total=lines.every(l=>number(l.quantity)!==null)?lines.reduce((n,l)=>n+Number(l.quantity),0):null;
  const summary=first?[sheet,first.name||first.code||'未記錄藥品'].filter(Boolean).join('・')+(lines.length>1?'等 '+lines.length+' 項':'')+(e.action==='訂貨'&&total!==null?'，共訂 '+total+' 瓶':''):e.fallback||'內容待核對';
  const stamp=orderLabel(e.event?.time||e.time).slice('訂貨登入-'.length);
  const columns=['藥品名稱','編號',...(sheets.length!==1?['廠牌／類別']:[]),'數量',...(receipt?['入庫前瓶數','入庫後瓶數','單價','小計']:[])];
  const products=lines.map(l=>{
   const cells=[l.name||'未記錄藥品',l.code||'未填編號',...(sheets.length!==1?[supplierLabel(l).join('・')]:[]),quantityLabel(e,l),...(receipt?[l.beforeText,l.afterText,l.priceText,l.amountText]:[])];
   return '<tr>'+cells.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>';
  }).join('');
  return `<details class="txn"><summary><span>${esc(stamp==='時間未記錄'?(e.date||'日期未記錄')+'（時間未記錄）':stamp.slice(0,16))}</span><strong>${esc(e.label)}${e.marked?' · 測試紀錄':''}</strong><span class="txn-product">${esc(summary)}</span><span>${esc(e.status)}</span><span>${esc(e.actor||'未記錄')}</span><span class="txn-toggle"><span>展開 ▾</span><span>收合 ▴</span></span></summary><div class="txn-detail">${products?`<div class="tablewrap"><table><thead><tr>${columns.map(c=>'<th>'+c+'</th>').join('')}</tr></thead><tbody>${products}</tbody></table></div>`:''}<p>交易編號：${esc(e.displayId)}</p>${e.reverses?`<p>對應原交易：${esc(e.displayReverses)}</p>`:''}<p>記錄時間：${esc(stamp)}</p><p>備註：${esc(e.note||'無')}</p>${e.marked?'<p>測試標記來自品項編號、備註、經手人或對應原交易；標記本身不代表已還原。</p>':''}${receipt?`<div class="history-explanation">${esc(receipt.totalText)}</div><p class="muted">入庫前後瓶數為本次交易當時的紀錄；後續進貨、耗損或沖銷會影響目前庫存。</p>`:''}${e.type==='耗損'?`<p>此筆入帳後庫存：${esc(e.stock??'待核對')} 瓶（歷史數字，不是目前庫存）</p>`:''}<p>原始狀態：${esc(e.rawStatus||(e.type==='耗損'?'耗損更正紀錄':'未記錄'))}</p><a target="_blank" rel="noopener" href="https://docs.google.com/spreadsheets/d/${esc(e.source.id)}/edit#gid=${esc(e.source.gid)}">查看原始工作表 ↗</a>${e.valid&&e.action==='訂貨'&&!e.reversed&&!e.marked?orderPrintControl(e.id):''}${e.canReverse?`<p><button type="button" class="secondary" data-reverse="${esc(e.id)}">${e.action==='訂貨'?'取消這筆訂貨':'沖銷這筆進貨'}</button></p>`:''}</div></details>`;
 }).join('');
 return `<style>
 .txn-list{border:1px solid #d5ceb4;background:#fffdf3;color:#243e56;border-radius:6px;overflow:hidden}
 .txn-head,.txn-list .txn>summary{display:grid;grid-template-columns:1.15fr .65fr 2.3fr 1.45fr .8fr .55fr;align-items:center;gap:12px;padding:12px 16px;text-align:left}
 .txn-head{background:#223c55;color:white;font-weight:bold}
 .txn-list .txn{margin:0;padding:0;border:0;border-top:1px solid #d9dacb}
 .txn-list summary{cursor:pointer;list-style:none;background:#fffcf2}.txn-list summary::-webkit-details-marker{display:none}
 .txn-list details[open]>summary,.txn-list summary:hover{background:#e8efe6}
 .txn-toggle{color:#165879}.txn-toggle span+span,.txn[open]>summary .txn-toggle span:first-child{display:none}.txn[open]>summary .txn-toggle span+span{display:inline}
 .txn-detail{padding:12px 18px}.txn-detail p{margin:5px 0}.txn-detail table{width:100%;min-width:0}.txn-detail th,.txn-detail td{text-align:left;padding:7px}
 @media(max-width:700px){.txn-head{display:none}.txn-list .txn>summary{grid-template-columns:1fr auto;gap:5px 10px}.txn-product{grid-column:1/-1}.txn-toggle{text-align:right}.txn-detail{padding:8px}.txn-detail .tablewrap{overflow-x:auto}}
 </style><p role="status">顯示 ${shown.length} 筆，共 ${entries.length} 筆；${entries.filter(e=>e.marked).length} 筆有測試標記。</p><div class="txn-list"><div class="txn-head"><span>登錄時間（台北）</span><span>類型</span><span>品項摘要</span><span>結果</span><span>經手人</span><span>明細</span></div>${rows||'<p>沒有符合條件的紀錄</p>'}</div>`;
}
