const runningBird=()=>matchMedia('(prefers-reduced-motion: reduce)').matches?'./web/assets/postbird-running.svg':'./web/assets/postbird-stride.gif';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function openMailProgress({name,files,onLeave}){
 const d=document.createElement('dialog');d.className='mail-parchment';d.setAttribute('aria-label','訂藥 PDF 寄送狀態');
 d.innerHTML=`<h2>訂藥 PDF 寄送中</h2><div class="postbird-scene"><img src="${runningBird()}" alt="路行鳥郵差叼信奔跑"></div><div role="status" aria-live="polite"><strong data-heading>郵差正在傳遞信件…</strong><p data-message>請稍候，請勿重複寄送。</p></div><div class="mail-parchment-summary">收件人：${esc(name)}<br>附件：${files.map(f=>esc(f.name)).join('<br>')}</div><p data-wait>可先返回；寄送不會取消，結果未確認前請勿重寄。</p><button type="button" data-leave>返回（不取消寄送）</button>`;
 let departed=false;d.addEventListener('cancel',e=>{e.preventDefault();leave();});
 const leave=()=>{if(departed)return;departed=true;d.close();d.remove();if(!d.dataset.state||d.dataset.state==='success')onLeave?.();};d.querySelector('[data-leave]').onclick=leave;document.body.append(d);d.showModal();
 const finish=(ok,message)=>{if(departed||!d.isConnected)return;d.dataset.state=ok?'success':'uncertain';d.querySelector('h2').textContent=ok?'訂藥 PDF 已交付寄送':'寄送狀態待確認';const img=d.querySelector('img');img.src=ok?'./web/assets/postbird-complete.svg':'./web/assets/postbird-running.svg';img.alt=ok?'路行鳥郵差在郵筒旁揮手，顯示勾選':'路行鳥郵差等待確認';d.querySelector('[data-heading]').textContent=ok?'已交付 Google 寄送':'請先核對寄送結果';d.querySelector('[data-message]').textContent=ok?'請收件人確認收件匣或垃圾郵件。':message;d.querySelector('[data-wait]').hidden=true;const b=d.querySelector('[data-leave]');b.textContent=ok?'完成並離開':'返回檢查';b.hidden=false;b.focus();};
 return {success:()=>finish(true),failure:message=>finish(false,message),departed:()=>departed};
}

// Preparatory work never sends mail; success closes this overlay before the next step.
export function openMailLoading(stage){
 const pdf=stage==='pdf',title=pdf?'正在產生訂藥 PDF':'正在讀取員工名冊';
 const d=document.createElement('dialog');d.className='mail-parchment';d.setAttribute('aria-label',title);
 d.innerHTML=`<h2>${title}</h2><div class="postbird-scene"><img src="${runningBird()}" alt="路行鳥郵差叼信奔跑"></div><div role="status" aria-live="polite"><strong data-heading>${pdf?'正在整理各廠牌的訂藥附件…':'正在確認可選擇的收件員工…'}</strong><p data-message>可返回上一個畫面；尚未寄送郵件。</p></div><p class="mail-parchment-summary">${pdf?'正在產生 PDF，尚未寄送郵件。':'讀取員工姓名與 email，尚未寄送郵件。'}</p><button type="button" data-leave>返回檢查</button>`;
 let departed=false,resolveLeave;const leaving=new Promise(resolve=>{resolveLeave=resolve;});const close=()=>{if(d.open)d.close();d.remove();};const leave=()=>{if(departed)return;departed=true;close();resolveLeave({left:true});};d.addEventListener('cancel',e=>{e.preventDefault();leave();});d.querySelector('[data-leave]').onclick=leave;document.body.append(d);d.showModal();
 return {close,wait:request=>Promise.race([Promise.resolve(request).then(value=>({value})),leaving]),failure:error=>{if(departed||!d.isConnected)return;d.querySelector('h2').textContent=pdf?'PDF 產生未完成':'員工名冊讀取未完成';d.querySelector('strong').textContent='請返回檢查後再試一次';d.querySelector('[data-message]').textContent=error?.message||String(error);const img=d.querySelector('img');img.src='./web/assets/postbird-running.svg';img.alt='路行鳥郵差等待確認';const button=d.querySelector('[data-leave]');button.hidden=false;button.focus();}};
}
