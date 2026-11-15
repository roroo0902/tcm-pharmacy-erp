(() => {
 const root=document.getElementById('content');
 if(!root)return;
 const style=document.createElement('style');
 style.textContent=`
 #period-rpg-loading{position:fixed;inset:0;margin:auto;width:min(400px,calc(100vw - 40px));box-sizing:border-box;padding:22px 24px;border:4px solid #49301e;border-radius:0;background:#f6e8c6;color:#49301e;box-shadow:0 0 0 3px #d6b367,inset 0 0 0 3px #c09a52,6px 7px 0 #241b1933;overflow:visible;font-family:"Noto Serif TC","PMingLiU",serif}
 #period-rpg-loading::backdrop{background:#132b464d}
 #period-rpg-loading:after{content:"";position:absolute;bottom:-12px;left:calc(50% - 9px);width:16px;height:16px;background:#f6e8c6;border-right:4px solid #49301e;border-bottom:4px solid #49301e;transform:rotate(45deg)}
 #period-rpg-loading .period-rpg-body{display:flex;align-items:center;gap:20px}
 #period-rpg-loading img{width:76px;height:70px;object-fit:contain;filter:drop-shadow(0 0 8px #e6b84d)}
 #period-rpg-loading h2{font-size:26px;line-height:1.3;margin:0 0 8px;color:#49301e}
 #period-rpg-loading p{font-size:16px;margin:0;color:#49301e}
 #period-rpg-loading .period-rpg-dots{display:flex;gap:10px;margin-top:14px}
 #period-rpg-loading i{display:block;width:9px;height:9px;background:#c3932c;animation:period-rpg-pulse 1.2s infinite}
 #period-rpg-loading i:nth-child(2){animation-delay:.2s}#period-rpg-loading i:nth-child(3){animation-delay:.4s}
 @keyframes period-rpg-pulse{50%{opacity:.25;transform:translateY(-3px)}}
 @media(prefers-reduced-motion:reduce){#period-rpg-loading i{animation:none}}
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
  const loading=button?.disabled&&button.textContent.trim()==='更新中…';
  if(!loading){close();return;}
  if(dialog||document.querySelector('dialog[open]'))return;
  previous=document.activeElement;
  dialog=document.createElement('dialog');dialog.id='period-rpg-loading';
  dialog.setAttribute('aria-labelledby','period-rpg-title');
  dialog.setAttribute('aria-describedby','period-rpg-description');
  dialog.setAttribute('aria-busy','true');
  dialog.innerHTML='<div class="period-rpg-body"><img src="https://roroo0902.github.io/tcm-pharmacy-erp/web/assets/slime-king.svg" alt=""><div><h2 id="period-rpg-title">更新中…</h2><p id="period-rpg-description" role="status">正在讀取每日耗損</p><div class="period-rpg-dots" aria-hidden="true"><i></i><i></i><i></i></div></div></div>';
  dialog.addEventListener('cancel',event=>event.preventDefault());
  document.body.append(dialog);dialog.showModal();
 }
 new MutationObserver(update).observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled']});
 window.addEventListener('hashchange',close);
 update();
})();