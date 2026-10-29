import {runDirect} from './direct-sync.mjs?v=compact20261030';

// Share one request between dynamically mounted pages and review dialogs.
export function staffLoader(read=()=>runDirect('readStaff')){
 let pending;
 return ()=>pending||(pending=Promise.resolve().then(read).then(result=>{
  const names=[...new Set((result.names||[]).map(n=>String(n).trim()).filter(Boolean))];
  if(!names.length)throw Error('員工名冊尚未填寫姓名');
  return names;
 }).finally(()=>{pending=null;}));
}
export function installStaffSelectors(){
 const load=staffLoader(), initialized=new WeakSet();
 function mount(){
  document.querySelectorAll('select[data-staff]').forEach(el=>{
   if(initialized.has(el))return;initialized.add(el);
   const status=document.createElement('small');status.setAttribute('role','status');
   const refresh=document.createElement('button');refresh.type='button';refresh.className='secondary small';refresh.textContent='更新員工名冊';
   el.after(status,refresh);
   let sequence=0;
   async function update(){
    const current=++sequence,previous=el.value;el.disabled=true;el.value='';refresh.disabled=true;
    status.textContent='正在讀取員工名冊…';
    try{
     const names=await load();if(!el.isConnected||current!==sequence)return;
     el.replaceChildren(new Option('請選擇經手人',''),...names.map(n=>new Option(n,n)));
     el.value=names.includes(previous)?previous:'';el.disabled=false;status.textContent='來源：員工名冊 B 欄';
    }catch(e){if(el.isConnected&&current===sequence){el.replaceChildren(new Option('員工名冊尚未載入',''));status.textContent=e.message.includes('不支援的操作')?'線上同步版本尚未更新，請重新整理後再試。':e.message;}}
    finally{if(el.isConnected&&current===sequence)refresh.disabled=false;}
   }
   refresh.onclick=update;update();
  });
 }
 const observer=new MutationObserver(mount);observer.observe(document.body,{childList:true,subtree:true});mount();
 const retry=()=>document.querySelectorAll('select[data-staff]').forEach(el=>el.nextElementSibling?.nextElementSibling?.click());
 window.addEventListener('erp-synced',retry);
 return ()=>{observer.disconnect();window.removeEventListener('erp-synced',retry);};
}
