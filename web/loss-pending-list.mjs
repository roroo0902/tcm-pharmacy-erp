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
export function showLossSlips({records,esc,review,check,remove}){
 const dialog=document.createElement('dialog');
 const title=r=>esc(r.draft.date)+' · '+lossSheets(r.draft).map(esc).join('、')+' · '+r.draft.lines.length+' 項';
 dialog.setAttribute('aria-label','尚未完成的耗損單');
 dialog.style.cssText='width:min(600px,92vw);max-height:82vh;overflow:auto';
 const rows=records.map((r,i)=>'<li style="margin:12px 0"><label><input type="checkbox" data-select="'+i+'" '+(r.phase==='draft'?'':'disabled')+'> '+title(r)+'</label> · '+(r.phase==='draft'?'未送出':'入帳結果待核對')+' <button data-review="'+i+'">'+(r.phase==='draft'?'繼續預覽':'查詢同步結果')+'</button></li>').join('');
 function list(){
 dialog.innerHTML='<h2>這筆耗損尚未確認完成</h2><p>本機待處理耗損單共 '+records.length+' 筆。請勾選要移除的未送出草稿。</p><ul>'+rows+'</ul><button data-delete disabled>刪除本筆耗損單</button> <button data-later>稍後處理</button>';
 const selected=()=>Array.from(dialog.querySelectorAll('[data-select]:checked'),el=>records[Number(el.dataset.select)]);
 const del=dialog.querySelector('[data-delete]');
 dialog.onchange=()=>{const n=selected().length;del.disabled=!n;del.textContent=n>1?'刪除所選耗損單（'+n+' 筆）':'刪除本筆耗損單';};
 dialog.querySelector('[data-later]').onclick=()=>dialog.close();
 for(const b of dialog.querySelectorAll('[data-review]'))b.onclick=()=>{const r=records[Number(b.dataset.review)];dialog.close();(r.phase==='draft'?review:check)(r);};
 del.onclick=()=>{const picked=selected();dialog.innerHTML='<h2>確認刪除耗損單？</h2><ul>'+picked.map(r=>'<li>'+title(r)+'</li>').join('')+'</ul><p>只移除勾選的本機草稿。</p><button data-back>返回</button> <button data-confirm>確認刪除</button>';dialog.querySelector('[data-back]').onclick=list;dialog.querySelector('[data-confirm]').onclick=()=>{dialog.close();remove(picked);};};
 }
 list();document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();return dialog;
}
