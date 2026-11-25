const prefix='tcm-loss-slip-v1:';
export const lossSheets=draft=>[...new Set([...draft.lines.map(line=>line.sheet),...(draft.completionSheets||[])])];
export function lossSlips(storage,legacyKey){
 const unreadable=new Set();
 function read(key){
  const raw=storage.getItem(key);
  unreadable.delete(key);
  if(raw===null)return null;
  try{
   const record=JSON.parse(raw);
   if(!record?.id||!Array.isArray(record.draft?.lines))throw Error();
   // Undo the old total-only verification of a draft that was never submitted.
   if(record.phase==='draft'&&record.verified)return {...record,verified:false};
   return record;
  }catch{
   unreadable.add(key);
   return null;
  }
 }
 const get=id=>read(prefix+id);
 const save=r=>storage.setItem(prefix+r.id,JSON.stringify(r));
 const legacy=read(legacyKey);
 if(legacy){
  const key=prefix+legacy.id;
  if(storage.getItem(key)===null)save(legacy);
  if(get(legacy.id))storage.removeItem(legacyKey);
 }
 const list=()=>Object.keys(storage).filter(k=>k.startsWith(prefix)).map(read).filter(Boolean);
 return {get,save,list,unreadable,remove:id=>storage.removeItem(prefix+id)};
}

const slipStyle=`<style>
#loss-slips{width:min(680px,94vw);max-height:90dvh;box-sizing:border-box;padding:clamp(14px,3vw,28px);background:#14283f;color:#fff3d4;border:4px double #edca79;border-radius:10px}
#loss-slips header,#loss-slips .slip-meta{display:flex;align-items:center;justify-content:space-between;gap:10px}
#loss-slips header{border-bottom:1px solid #c4ab74;margin-bottom:14px}
#loss-slips h2{color:#ffe5a0;margin:0 0 10px;font-size:1.4rem}
#loss-slips .slip-list{display:grid;gap:10px;max-height:50dvh;overflow:auto}
#loss-slips article{padding:12px 16px;border:2px solid #798393;background:#172d46;border-radius:8px;overflow-wrap:anywhere;cursor:pointer}
#loss-slips article.selected{border-color:#ffd162;background:#1c354e}
#loss-slips label{display:flex;align-items:center;gap:8px;color:inherit;font-weight:bold;cursor:pointer}
#loss-slips input{width:18px;height:18px;accent-color:#efc055}
#loss-slips small{color:#ffe298}#loss-slips ul{padding-left:22px;margin:4px 0}
#loss-slips .slip-group{margin-top:8px}#loss-slips details{margin-top:8px}
#loss-slips footer{display:grid;grid-auto-columns:1fr;grid-auto-flow:column;gap:8px;margin-top:15px}
#loss-slips button{min-width:0;min-height:44px;padding:8px 5px;background:#172d46;color:#fff1d0;border:1px solid #eac474;white-space:normal}
#loss-slips button:is(:hover,:focus-visible,:active){background:#f6cc68;color:#14263c}
#loss-slips button:active{background:#e7af43;transform:translateY(1px)}
#loss-slips{background:linear-gradient(140deg,#182e47,#0e2136);border:5px double #efc767;border-radius:0;box-shadow:4px 4px 0 #081725;--corners:polygon(0 9px,4px 9px,4px 4px,9px 4px,9px 0,calc(100% - 9px) 0,calc(100% - 9px) 4px,calc(100% - 4px) 4px,calc(100% - 4px) 9px,100% 9px,100% calc(100% - 9px),calc(100% - 4px) calc(100% - 9px),calc(100% - 4px) calc(100% - 4px),calc(100% - 9px) calc(100% - 4px),calc(100% - 9px) 100%,9px 100%,9px calc(100% - 4px),4px calc(100% - 4px),4px calc(100% - 9px),0 calc(100% - 9px));clip-path:var(--corners)}
#loss-slips header{padding-bottom:10px;border-bottom:2px solid #edc77a}
#loss-slips #slip-heading{display:flex;align-items:center;gap:10px;margin:0;padding:0;border:0}
#loss-slips #slip-heading::before{content:none}
#loss-slips #slip-heading img{width:36px;height:32px;object-fit:contain;image-rendering:pixelated}
#loss-slips article{border-radius:2px;clip-path:var(--corners)}
#loss-slips article.selected{box-shadow:inset 0 0 0 1px #e1ab43;background:#19334e}
#loss-slips label{position:relative;font-size:1.16rem}
#loss-slips label:before{content:'▶';color:transparent}
#loss-slips .selected label:before{color:#ffd459}
#loss-slips label input{position:absolute;opacity:0;width:1px;height:1px}
#loss-slips label:focus-within{outline:2px solid #ffe5a0}
#loss-slips .slip-date{display:block;margin:4px 0 0 1.5em}
#loss-slips .slip-meta{flex-wrap:wrap}
#loss-slips .slip-meta small{padding:3px 8px;background:#48351e;border:1px solid #daa44e;font-weight:bold}
#loss-slips .slip-group{border-top:1px solid #bd9a54;padding-top:8px}
#loss-slips ul{padding:0}
#loss-slips li{display:flex;justify-content:space-between;gap:8px;padding:3px 0}
#loss-slips li strong{white-space:nowrap}
#loss-slips footer{border-top:1px solid #c4aa72;padding-top:12px}
#loss-slips button{border:2px solid #caa252;border-radius:3px;box-shadow:0 3px 0 #805b28}
</style>`;

export function showLossSlips({records,esc,check,remove}){
 const dialog=document.createElement('dialog');
 dialog.id='loss-slips';
 dialog.setAttribute('aria-labelledby','slip-heading');
 let selected=0;
 const sheetLabel=sheet=>esc(sheet.replace(/(.+?)(單方|複方)$/,'$1｜$2'));
 function groups(draft,lines){
  return lossSheets(draft).map(sheet=>{
   const items=lines.filter(line=>line.sheet===sheet);
   const completionOnly=!draft.lines.some(line=>line.sheet===sheet);
   if(!items.length&&!completionOnly)return '';
   return '<div class="slip-group">'+(lossSheets(draft).length>1?'<b>'+sheetLabel(sheet)+'</b>':'')+
    (completionOnly?' · 正常品項完成登錄':'<ul>'+items.map(l=>'<li><span>• '+esc(l.name)+(l.code?'（'+esc(l.code)+'）':'')+'</span><strong>累計 '+esc(l.total)+' 瓶</strong></li>').join('')+'</ul>')+'</div>';
  }).join('');
 }
 function card(record,i,confirming=false){
  const d=record.draft,more=!confirming&&d.lines.length>3;
  const date=esc(d.date.replaceAll('-','/'))+' · '+d.lines.length+' 個品項';
  const sheets=lossSheets(d);
  const heading=sheets.length===1?sheetLabel(sheets[0]):sheets.map(sheetLabel).join('、');
  const label=confirming?heading:'<label><input type="radio" name="loss-slip" value="'+i+'" '+(i===selected?'checked':'')+'>'+heading+'</label>';
  return '<article data-i="'+i+'" class="'+(i===selected?'selected':'')+'"><div class="slip-meta"><div>'+label+'<span class="slip-date">'+date+'</span></div><small>'+(record.phase==='draft'?'🪶 未送出草稿':'⌛ 入帳待核對')+'</small></div>'+
   groups(d,more?d.lines.slice(0,3):d.lines)+(more?'<details><summary>展開全部 '+d.lines.length+' 項</summary>'+groups(d,d.lines.slice(3))+'</details>':'')+'</article>';
 }
 function render(confirming=false){
  const record=records[selected];
  dialog.innerHTML=slipStyle+'<header><h2 id="slip-heading"><img src="./web/assets/loss-ledger.png" alt="">'+(confirming?'確認刪除本筆耗損單？':'待處理耗損單')+'</h2><span>共 '+(confirming?1:records.length)+' 筆</span></header><div class="slip-list">'+
   (confirming?card(record,selected,true):records.map((r,i)=>card(r,i)).join(''))+'</div><p role="status"></p><footer>'+
   (confirming?'<button data-back>返回</button><button data-confirm>確認刪除草稿</button>':'<button data-check>查詢同步結果</button><button data-delete>刪除本筆耗損單</button><button data-later>稍後處理</button>')+'</footer>';
  const find=s=>dialog.querySelector(s);
  if(confirming){
   find('[data-back]').onclick=()=>render();
   find('[data-confirm]').onclick=()=>{dialog.close();remove([record]);};
   return;
  }
  function select(i){
   selected=i;
   for(const el of dialog.querySelectorAll('article'))el.classList.toggle('selected',Number(el.dataset.i)===i);
   dialog.querySelectorAll('input')[i].checked=true;
   find('[role=status]').textContent='';
  }
  for(const el of dialog.querySelectorAll('article')){
   el.onclick=()=>select(Number(el.dataset.i));
   el.onchange=()=>select(Number(el.dataset.i));
  }
  function lookup(){dialog.close();check(records[selected]);}
  find('[data-check]').onclick=()=>{
   if(records[selected].phase==='draft')find('[role=status]').textContent='這筆耗損單尚未送出。';
   else lookup();
  };
  find('[data-delete]').onclick=()=>{
   if(records[selected].phase==='draft')render(true);
   else lookup();
  };
  find('[data-later]').onclick=()=>dialog.close();
 }
 render();document.body.append(dialog);
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();return dialog;
}
