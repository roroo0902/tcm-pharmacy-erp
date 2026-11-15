(() => {
 const root=document.getElementById('content');
 if(!root)return;
 const style=document.createElement('style');
 style.textContent=`
 :is(#period-rpg-loading,#loss-actor-warning){position:fixed;inset:0;margin:auto;width:min(420px,calc(100vw - 32px));box-sizing:border-box;padding:30px 28px;border:0;border-radius:0;background:transparent;color:#49301e;overflow:visible;isolation:isolate;filter:drop-shadow(4px 7px 4px #241b1955);font-family:"Noto Serif TC","PMingLiU",serif}
 :is(#period-rpg-loading,#loss-actor-warning)::backdrop{background:#132b464d}
 :is(#period-rpg-loading,#loss-actor-warning)::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(ellipse at 0 0,#98633199,transparent 24%),radial-gradient(ellipse at 100% 100%,#98633188,transparent 24%),repeating-linear-gradient(117deg,#84592509 0 1px,transparent 1px 5px),repeating-linear-gradient(27deg,#fff9d922 0 1px,transparent 1px 7px),#f5e4bb;box-shadow:inset 0 0 0 3px #49301e,inset 0 0 0 7px #bb8d4f,inset 0 0 19px 6px #b37b3f99;clip-path:polygon(0 10px,8px 10px,8px 3px,16px 3px,16px 0,19% 0,19% 3px,24% 3px,24% 0,43% 0,43% 2px,49% 2px,49% 0,73% 0,73% 3px,78% 3px,78% 0,calc(100% - 12px) 0,calc(100% - 12px) 4px,calc(100% - 5px) 4px,calc(100% - 5px) 10px,100% 10px,100% 38%,calc(100% - 3px) 38%,calc(100% - 3px) 44%,100% 44%,100% calc(100% - 12px),calc(100% - 5px) calc(100% - 12px),calc(100% - 5px) calc(100% - 5px),calc(100% - 14px) calc(100% - 5px),calc(100% - 14px) 100%,81% 100%,81% calc(100% - 3px),75% calc(100% - 3px),75% 100%,53% 100%,53% calc(100% - 2px),47% calc(100% - 2px),47% 100%,23% 100%,23% calc(100% - 3px),17% calc(100% - 3px),17% 100%,12px 100%,12px calc(100% - 4px),5px calc(100% - 4px),5px calc(100% - 11px),0 calc(100% - 11px),0 65%,3px 65%,3px 59%,0 59%)}
 :is(#period-rpg-loading,#loss-actor-warning)::after{content:"";position:absolute;inset:13px;pointer-events:none;border:1px solid #a77842;box-shadow:0 0 0 2px #f9edcd66}
 :is(#period-rpg-loading,#loss-actor-warning) .period-rpg-body{display:flex;align-items:center;gap:18px;position:relative;z-index:1}
 :is(#period-rpg-loading,#loss-actor-warning) .period-rpg-body>div{min-width:0}
 :is(#period-rpg-loading,#loss-actor-warning) img{width:76px;height:70px;flex-shrink:0;object-fit:contain;filter:drop-shadow(0 0 8px #e6b84d)}
 :is(#period-rpg-loading,#loss-actor-warning) h2{font-size:26px;line-height:1.3;margin:0 0 10px;color:#49301e}
 :is(#period-rpg-loading,#loss-actor-warning) p{font-size:16px;line-height:1.6;margin:0;padding-top:10px;border-top:1px solid #b98d4d55;color:#49301e;overflow-wrap:anywhere}
 :is(#period-rpg-loading,#loss-actor-warning) .period-rpg-dots{display:flex;gap:10px;margin-top:14px}
 :is(#period-rpg-loading,#loss-actor-warning) i{display:block;width:9px;height:9px;background:#c3932c;animation:period-rpg-pulse 1.2s infinite}
 :is(#period-rpg-loading,#loss-actor-warning) i:nth-child(2){animation-delay:.2s}
 :is(#period-rpg-loading,#loss-actor-warning) i:nth-child(3){animation-delay:.4s}
 @keyframes period-rpg-pulse{50%{opacity:.25;transform:translateY(-3px)}}
 @media(prefers-reduced-motion:reduce){:is(#period-rpg-loading,#loss-actor-warning) i{animation:none}}
 @media(max-width:380px){:is(#period-rpg-loading,#loss-actor-warning){padding:26px 22px}:is(#period-rpg-loading,#loss-actor-warning) img{width:58px;height:58px}:is(#period-rpg-loading,#loss-actor-warning) h2{font-size:22px}}
 `;
 document.head.append(style);
 let dialog,previous;
 function close(){
  if(!dialog)return;
  dialog.close();dialog.remove();dialog=null;
  if(previous?.isConnected)previous.focus({preventScroll:true});
 }
 function update(){
  const button=root.querySelector('#period-apply');
  const cloudButton=root.querySelector('#cloud-refresh');
  const cloudLoading=cloudButton?.disabled&&root.querySelector('#cloud-status')?.textContent.trim()==='正在向 Google 讀取最新內容…';
  const loading=cloudLoading||(button?.disabled&&button.textContent.trim()==='更新中…');
  if(!loading){close();return;}
  if(dialog||document.querySelector('dialog[open]'))return;
  previous=document.activeElement;
  dialog=document.createElement('dialog');dialog.id='period-rpg-loading';
  dialog.setAttribute('aria-labelledby','period-rpg-title');
  dialog.setAttribute('aria-describedby','period-rpg-description');
  dialog.setAttribute('aria-busy','true');
  dialog.innerHTML='<div class="period-rpg-body"><img src="https://roroo0902.github.io/tcm-pharmacy-erp/web/assets/slime-king.svg" alt=""><div><h2 id="period-rpg-title">更新中…</h2><p id="period-rpg-description" role="status">正在讀取每日耗損</p><div class="period-rpg-dots" aria-hidden="true"><i></i><i></i><i></i></div></div></div>';
  dialog.addEventListener('cancel',event=>event.preventDefault());
  if(cloudLoading){dialog.querySelector('#period-rpg-title').textContent='讀取中…';dialog.querySelector('#period-rpg-description').textContent='正在向 Google 讀取最新內容…';}
  document.body.append(dialog);dialog.showModal();
 }
 new MutationObserver(update).observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled']});
 window.addEventListener('hashchange',close);

 let actorWarning;
 function warnActor(){
  const actor=root.querySelector('#loss-actor');
  if(!actor||actor.value||actorWarning?.open)return;
  actorWarning=document.createElement('dialog');actorWarning.id='loss-actor-warning';
  actorWarning.setAttribute('aria-labelledby','loss-actor-warning-title');
  actorWarning.innerHTML='<div class="period-rpg-body"><img src="https://roroo0902.github.io/tcm-pharmacy-erp/web/assets/slime-king.svg" alt=""><div><h2 id="loss-actor-warning-title">請填經手人</h2><p>請選擇經手人後，再繼續登錄。</p><button type="button" style="margin-top:16px;padding:8px 16px;border:2px solid #795329;background:#e8cc87;color:#49301e;font:inherit;min-height:44px">返回填寫</button></div></div>';
  const current=actorWarning;
  current.querySelector('button').onclick=()=>current.close();
  current.addEventListener('close',()=>{current.remove();if(actorWarning===current)actorWarning=null;if(actor.isConnected)actor.focus();},{once:true});
  document.body.append(current);current.showModal();
 }
 const message=document.getElementById('message');
 if(message)new MutationObserver(()=>{
  if(message.classList.contains('error')&&/請(?:填|選擇)經手人/.test(message.textContent))warnActor();
 }).observe(message,{childList:true,characterData:true,subtree:true});
 root.addEventListener('invalid',event=>{
  if(event.target.id==='loss-actor'){event.preventDefault();warnActor();}
 },true);
 window.addEventListener('hashchange',()=>actorWarning?.close());

 update();
})();