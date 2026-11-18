const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function openMailProgress({name,files,onLeave}){
 const d=document.createElement('dialog');d.className='mail-parchment';d.setAttribute('aria-label','訂藥 PDF 寄送狀態');
 d.innerHTML=`<h2>訂藥 PDF 寄送中</h2><div class="postbird-scene"><img src="./web/assets/postbird-running.svg" alt="路行鳥郵差叼信奔跑" class="postbird-running"></div><div role="status" aria-live="polite"><strong data-heading>郵差正在傳遞信件…</strong><p data-message>請稍候，請勿重複寄送。</p></div><div class="mail-parchment-summary">收件人：${esc(name)}<br>附件：${files.map(f=>esc(f.name)).join('<br>')}</div><p data-wait>處理完成後即可離開</p><button type="button" data-leave hidden>完成並離開</button>`;
 let pending=true;d.addEventListener('cancel',e=>{e.preventDefault();if(!pending)leave();});
 const leave=()=>{d.close();d.remove();if(d.dataset.state==='success')onLeave?.();};d.querySelector('[data-leave]').onclick=leave;document.body.append(d);d.showModal();
 const finish=(ok,message)=>{pending=false;d.dataset.state=ok?'success':'uncertain';d.querySelector('h2').textContent=ok?'訂藥 PDF 已交付寄送':'寄送狀態待確認';const img=d.querySelector('img');img.classList.remove('postbird-running');img.src=ok?'./web/assets/postbird-complete.svg':'./web/assets/postbird-running.svg';img.alt=ok?'路行鳥郵差在郵筒旁揮手，顯示勾選':'路行鳥郵差等待確認';d.querySelector('[data-heading]').textContent=ok?'已交付 Google 寄送':'請先核對寄送結果';d.querySelector('[data-message]').textContent=ok?'請收件人確認收件匣或垃圾郵件。':message;d.querySelector('[data-wait]').hidden=true;const b=d.querySelector('[data-leave]');b.textContent=ok?'完成並離開':'返回檢查';b.hidden=false;b.focus();};
 return {success:()=>finish(true),failure:message=>finish(false,message)};
}
