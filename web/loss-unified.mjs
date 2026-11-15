const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function assertLossCompletion(draft,states,completed){
 if(!Array.isArray(states)||states.length!==draft.completionSheets.length||draft.completionSheets.some(sheet=>states.filter(s=>s.sheet===sheet&&s.date===draft.date&&!s.error&&(!completed||s.eligibleComplete)).length!==1))throw Error(completed?'耗損完成狀態尚未核對一致，請查詢原操作；不要另建重送':'雲端尚未提供完整的完成預覽，停止入帳，請重新載入最新版');
}
export function lossCompletionPreview(draft,states,completed=false){
 if(!draft.completionSheets)return '';
 return '<section class="loss-completion-preview"><h3>'+ (completed?'正常品項完成狀態':'一併確認正常品項登錄')+'</h3><p>範圍為目前分類及本次有填數量的分類，包含搜尋未顯示的品項。未填且尚無紀錄的正常品項視為零耗損；已有累計保留原值，待核對品項不當作零。</p><ul>'+states.map(s=>'<li><strong>'+esc(s.sheet)+'：正常 '+esc(s.eligibleCount)+' 項'+(completed?'已完成':'')+'</strong>；未填且尚無紀錄 '+esc(s.blankZeroCount)+' 項；保留原累計 '+esc(s.retainedCount)+' 項；待核對 '+esc(s.pendingCount)+' 項'+(s.pendingCount?'<details><summary>查看保留的待核對品項</summary><ul>'+s.pendingItems.map(p=>'<li>'+esc(p.code)+' '+esc(p.name)+'：'+esc(p.reason)+'</li>').join('')+'</ul></details>':'')+'</li>').join('')+'</ul><p>耗損差額與完成狀態一次儲存；相同累計不會重複扣庫存。</p></section>';
}
