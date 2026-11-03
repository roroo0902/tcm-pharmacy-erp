const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Display state only: never delete the shared transaction or change its payload.
export function registrationResult(p,hiddenId=''){
 const empty='<h3>最近建帳結果</h3><p>目前沒有待確認的建帳操作。</p>';
 if(!p)return empty;
 if(p.action!=='建檔')return p.verified?empty:'<h3>其他操作尚待確認</h3><p>其他頁面有一筆操作尚未確認完成，請先查詢結果，避免重複送出。</p><button id="entry-check" type="button">查詢待確認操作</button><a href="#history">查看交易紀錄</a>';
 if(p.verified&&hiddenId===p.id)return empty;
 const lines=(p.lines||[]).map(l=>`<li>${escape(l.sheet)}｜${escape(l.name)} ${escape(l.code)} · 期初 ${escape(l.quantity)} 瓶</li>`).join('');
 return `<h3>${p.verified?'藥品建帳完成':'這筆建帳尚未確認完成'}</h3><p>${p.verified?'工作表已核對；可在訂貨、進貨及每日耗損頁重新讀取品項。':'請先查詢同步結果；若尚未完成，可沿用這筆操作重新預覽，避免重複新增。'}</p><ul>${lines}</ul><details><summary>查看交易明細</summary><p>日期：${escape(p.date)} · 經手人：${escape(p.actor)}</p><p>交易編號：${escape(p.id)}</p>${p.note?`<p>備註：${escape(p.note)}</p>`:''}</details><div class="actions"><button id="entry-check" type="button">${p.verified?'重新核對同步結果':'查詢同步結果'}</button>${p.verified?'<button id="entry-hide" type="button" class="secondary">隱藏此提示</button>':'<button id="entry-resume" type="button">重新確認這筆操作</button><button id="entry-edit" type="button" class="secondary">修改尚未入帳內容</button>'}</div>`;
}
