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
export function renderHistory(entries,{type='全部',test='全部'}={}){
 const shown=entries.filter(e=>(type==='全部'||e.type===type)&&(test==='全部'||(test==='測試'?e.marked:!e.marked)));
 return `<p role="status">顯示 ${shown.length} 筆，共 ${entries.length} 筆；${entries.filter(e=>e.marked).length} 筆有測試標記。</p><div class="tablewrap"><table class="history-readable"><thead><tr><th>日期</th><th>類型</th><th>品項與數量</th><th>結果</th><th>經手人</th><th>明細</th></tr></thead><tbody>${shown.map(e=>`<tr><td>${esc(e.date)}</td><td><strong>${esc(e.label)}</strong>${e.marked?'<div><span class="pill warn">測試紀錄</span></div>':''}</td><td>${e.lines.slice(0,3).map(l=>esc(lineText(e,l))).join('<br>')||esc(e.fallback||'內容待核對')}${e.lines.length>3?`<br>另有 ${e.lines.length-3} 項，請展開明細`:''}${e.type==='耗損'?`<div>當日累計：${esc(e.before??'待核對')} → ${esc(e.total??'待核對')} 瓶</div>`:''}</td><td>${esc(e.status)}</td><td>${esc(e.actor||'未記錄')}</td><td><details><summary>查看明細</summary><p>交易編號：${esc(e.id)}</p>${e.reverses?`<p>對應原交易：${esc(e.reverses)}</p>`:''}<p>記錄時間：${esc(e.time||'未記錄')}</p><p>備註：${esc(e.note||'無')}</p>${e.marked?'<p>測試標記來自品項編號、備註、經手人或對應原交易；標記本身不代表已還原。</p>':''}${e.lines.length?`<ul>${e.lines.map(l=>`<li>${esc(lineText(e,l))}</li>`).join('')}</ul>`:''}${e.type==='耗損'?`<p>此筆入帳後庫存：${esc(e.stock??'待核對')} 瓶（歷史數字，不是目前庫存）</p>`:''}<p>原始狀態：${esc(e.rawStatus||(e.type==='耗損'?'耗損更正紀錄':'未記錄'))}</p><a target="_blank" rel="noopener" href="https://docs.google.com/spreadsheets/d/${esc(e.source.id)}/edit#gid=${esc(e.source.gid)}">查看原始工作表 ↗</a>${e.canReverse?`<p><button type="button" class="secondary" data-reverse="${esc(e.id)}">${e.action==='訂貨'?'取消這筆訂貨':'沖銷這筆進貨'}</button></p>`:''}</details></td></tr>`).join('')||'<tr><td colspan="6">沒有符合條件的紀錄</td></tr>'}</tbody></table></div>`;
}
