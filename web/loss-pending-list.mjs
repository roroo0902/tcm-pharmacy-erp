const prefix='tcm-loss-slip-v1:';
export const lossSheets=draft=>[...new Set([...draft.lines.map(line=>line.sheet),...(draft.completionSheets||[])])];
export function lossSlips(storage,legacyKey){
 const get=id=>JSON.parse(storage.getItem(prefix+id)||'null');
 const save=r=>storage.setItem(prefix+r.id,JSON.stringify(r));
 const legacy=JSON.parse(storage.getItem(legacyKey)||'null');
 if(legacy?.id){if(!get(legacy.id))save(legacy);storage.removeItem(legacyKey);}
 const list=()=>Object.keys(storage).filter(k=>k.startsWith(prefix)).map(k=>get(k.slice(prefix.length))).filter(Boolean);
 return {get,save,list,remove:id=>storage.removeItem(prefix+id)};
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
   return '<div class="slip-group"><b>'+sheetLabel(sheet)+'</b>'+
    (completionOnly?' · 正常品項完成登錄':'<ul>'+items.map(l=>'<li>'+esc(l.name)+(l.code?'（'+esc(l.code)+'）':'')+'　累計 '+esc(l.total)+' 瓶</li>').join('')+'</ul>')+'</div>';
  }).join('');
 }
 function card(record,i,confirming=false){
  const d=record.draft,more=!confirming&&d.lines.length>3;
  const date=esc(d.date.replaceAll('-','/'))+' · '+d.lines.length+' 個品項';
  const label=confirming?date:'<label><input type="radio" name="loss-slip" value="'+i+'" '+(i===selected?'checked':'')+'>'+date+'</label>';
  return '<article data-i="'+i+'" class="'+(i===selected?'selected':'')+'"><div class="slip-meta">'+label+'<small>'+(record.phase==='draft'?'未送出草稿':'入帳待核對')+'</small></div>'+
   groups(d,more?d.lines.slice(0,3):d.lines)+(more?'<details><summary>展開全部 '+d.lines.length+' 項</summary>'+groups(d,d.lines.slice(3))+'</details>':'')+'</article>';
 }
 function render(confirming=false){
  const record=records[selected];
  dialog.innerHTML=slipStyle+'<header><h2 id="slip-heading">'+(confirming?'確認刪除本筆耗損單？':'待處理耗損單')+'</h2><span>共 '+(confirming?1:records.length)+' 筆</span></header><div class="slip-list">'+
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
