(() => {
 const origin='https://roroo0902.github.io/tcm-pharmacy-erp/';
 const style=document.createElement('link');
 style.rel='stylesheet';style.href=origin+'web/rpg-dialog.css?v=20261115';
 document.head.append(style);
 const decorated=new WeakSet();
 function decorate(dialog){
  if(decorated.has(dialog))return;
  decorated.add(dialog);dialog.classList.add('rpg-dialog');
  const mascot=document.createElement('div');mascot.className='rpg-dialog-mascot';mascot.setAttribute('aria-hidden','true');
  const image=document.createElement('img');image.src=origin+'web/assets/slime-king.svg';image.alt='';image.width=64;image.height=56;
  mascot.append(image);dialog.prepend(mascot);
 }
 let warning,returnFocus;
 function showWarning(text,target){
  if(document.querySelector('#erp-processing[open]'))return;
  if(!warning){
   warning=document.createElement('dialog');warning.setAttribute('aria-labelledby','rpg-warning-title');
   warning.innerHTML='<h2 id="rpg-warning-title">請確認輸入內容</h2><p class="rpg-warning-text"></p><div class="actions"><button type="button">返回修改</button></div>';
   warning.querySelector('button').onclick=()=>warning.close();
   warning.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus();});
   document.body.append(warning);decorate(warning);
  }
  returnFocus=target||document.activeElement;
  warning.querySelector('.rpg-warning-text').textContent=text;
  if(!warning.open)warning.showModal();
 }
 document.addEventListener('invalid',event=>{
  if(!event.target.closest('#content,#confirm'))return;
  event.preventDefault();
  if(warning?.open)return;
  const field=event.target,label=field.getAttribute('aria-label')||field.labels?.[0]?.textContent.trim()||'此欄位';
  showWarning(label+'：'+field.validationMessage,field);
 },true);
 let lastError='';
 const scan=()=>{
  document.querySelectorAll('dialog').forEach(decorate);
  const message=document.querySelector('#message.error');
  const text=message?.textContent.trim()||'';
  if(text&&text!==lastError){lastError=text;showWarning(text);}
  if(!text)lastError='';
 };
 new MutationObserver(scan).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','open']});
 scan();
})();