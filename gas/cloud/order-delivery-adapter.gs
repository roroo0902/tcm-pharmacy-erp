function orderDeliveryAuth_(){loss3Actor_();const email=Session.getActiveUser().getEmail().toLowerCase(),allowed=(PropertiesService.getScriptProperties().getProperty('ERP_ALLOWED_EMAILS')||'').split(',').map(s=>s.trim().toLowerCase());if(!email||!allowed.includes(email))throw Error('此帳號尚未獲准使用藥庫站內同步');}
function orderDeliveryEvents_(){
 const log=SpreadsheetApp.openById(ERP.orders).getSheetByName(ERP.orderLog);if(!log||log.getRange(1,1).getValue()!=='交易編號'||log.getLastRow()<2||log.getLastRow()>10000)throw Error('訂貨紀錄無法核對');
 return log.getRange(2,1,log.getLastRow()-1,9).getValues().filter(r=>r[0]||r[1]).map(r=>{const e=JSON.parse(r[1]);if(e?.draft?.id!==r[0])throw Error('訂貨紀錄編號不一致');if(!e.time&&r[8])e.time=r[8] instanceof Date?r[8].toISOString():String(r[8]);return e;});
}
function orderDeliveryPlans_(id,events){events=events||orderDeliveryEvents_();return confirmedPrintPlan_(events,id).map(p=>({...p,items:events.find(e=>e.draft.id===id).draft.lines.filter(l=>l.sheet===p.brand+'單方'||l.sheet===p.brand+'複方')}));}
// Attach labels only for output so historical draft and mail hashes keep their identity.
function orderOutputTimes_(plans,events){
 const times=new Map(events.map(e=>[e.draft.id,e.time]));
 return plans.map(p=>({...p,time:times.get(p.id),
  ...(p.sources?{sources:p.sources.map(s=>({...s,time:times.get(s.id)}))}:{})}));
}
function orderOutputBase_(id,mergeIds,events=orderDeliveryEvents_()){
 if(mergeIds===undefined)mergeIds=[];if(!Array.isArray(mergeIds)||mergeIds.length>1||mergeIds.some(x=>typeof x!=='string'||x===id))throw Error('請選擇一筆不同的先前訂單');
 const current=orderDeliveryPlans_(id,events);if(!mergeIds.length)return current;
 const currentIndex=events.findIndex(e=>e.draft.id===id),previousIndex=events.findIndex(e=>e.draft.id===mergeIds[0]);
 if(previousIndex<0||previousIndex>=currentIndex)throw Error('只能選擇本筆之前已確認的訂單');
 return mergeOrderPdfPlans_(current,orderDeliveryPlans_(mergeIds[0],events));
}
function orderWasSent_(id,plans,roster,props){
 if(props['order-mail-sent-'+id])return true;
 const variants=[plans,reviseOrderPdf_(plans,{rows:orderPdfSeed_(plans).rows})];
 for(const staff of roster)if(staff.valid)for(const p of variants)for(const test of [false,true]){const value=props[orderMailKey_({id,email:staff.email,hash:loss3Hash_(p),test})];if(value&&JSON.parse(value).state==='sent')return true;}
 return false;
}
function erpOrderOutputOptions(id){
 orderDeliveryAuth_();const events=orderDeliveryEvents_();orderDeliveryPlans_(id,events);const index=events.findIndex(e=>e.draft.id===id);
 const roster=orderDeliveryRoster_(),props=PropertiesService.getScriptProperties().getProperties(),orders=[];for(let i=index-1;i>=0&&orders.length<30;i--){const d=events[i].draft;if(d.action!=='訂貨'||/測試|驗收|test/i.test(d.note||''))continue;try{const plans=orderDeliveryPlans_(d.id,events);orders.push({id:d.id,time:events[i].time,date:d.date,actor:d.actor,count:d.lines.length,brands:plans.map(p=>p.brand),sent:orderWasSent_(d.id,plans,roster,props)});}catch{}}
 return {orders};
}
function erpOrderPdfEditSource(input){orderDeliveryAuth_();const id=typeof input==='string'?input:input.id,mergeIds=typeof input==='string'?[]:input.mergeIds||[],events=orderDeliveryEvents_(),plans=orderOutputBase_(id,mergeIds,events);return {id,mergeIds,date:plans[0].date,actor:plans[0].actor,merged:!!plans[0].merged,sources:orderOutputTimes_(plans,events)[0].sources||[],sourceHash:loss3Hash_(plans),...orderPdfSeed_(plans)};}
function orderDeliveryRevised_(id,draft,events){const base=orderOutputBase_(id,draft?.mergeIds,events);if(!draft)return base;if(draft.sourceHash!==loss3Hash_(base))throw Error('原訂單已變更，請重新載入並核對 PDF 草稿');return reviseOrderPdf_(base,draft);}
function orderDeliveryRoster_(){const sh=SpreadsheetApp.openById(ERP.inventory).getSheetByName('員工名冊');if(!sh||sh.getLastRow()>10000)throw Error('員工名冊無法讀取');return orderMailRoster_(sh.getRange(1,2,Math.max(1,sh.getLastRow()),2).getDisplayValues());}
function erpOrderPdfStaff(){orderDeliveryAuth_();return {staff:orderDeliveryRoster_()};}
function orderDeliveryFiles_(plans){let size=0;return plans.map(p=>{const blob=HtmlService.createHtmlOutput(orderPdfHtml_(p)).getAs('application/pdf').setName(orderPdfName_(p));const bytes=blob.getBytes();size+=bytes.length;if(size>8*1024*1024)throw Error('PDF 附件總大小超過 8 MB，請分批訂單處理');return {p,blob,bytes};});}
function erpOrderPdfDownload(input){orderDeliveryAuth_();const id=typeof input==='string'?input:input?.id,events=orderDeliveryEvents_(),plans=orderOutputTimes_(orderDeliveryRevised_(id,typeof input==='object'?input.draft:null,events),events);return {id,files:orderDeliveryFiles_(plans).map(({p,blob,bytes})=>({brand:p.brand,count:p.count,name:blob.getName(),mime:'application/pdf',base64:Utilities.base64Encode(bytes)}))};}
function orderDeliverySnapshot_(id,row,test,draft=null){
 const events=orderDeliveryEvents_(),base=orderDeliveryRevised_(id,draft,events),plans=orderOutputTimes_(base,events),staff=orderDeliveryRoster_().find(s=>s.row===Number(row));if(!staff||!staff.valid)throw Error('所選員工沒有有效的 C 欄 email，請先更新名冊');
 const files=plans.map(p=>({name:orderPdfName_(p),count:p.count,brand:p.brand}));return {id,draft,row:staff.row,name:staff.name,email:staff.email,test:!!test,hash:loss3Hash_(base),files,subject:(test?'【功能測試・請勿重複下單】':'')+(plans[0].merged?'【更新版・取代前版・請勿重複下單】':'')+'訂藥 PDF｜'+plans[0].date+'｜'+plans.map(p=>p.brand).join('、'),plans};
}
function orderMailKey_(s){return 'order-mail-v1-'+loss3Hash_({id:s.id,email:s.email.toLowerCase(),hash:s.hash,test:s.test});}
function erpOrderPdfMailPreview(input){
 orderDeliveryAuth_();
 const s=orderDeliverySnapshot_(input?.id,input?.row,input?.test,input?.draft||null),token=Utilities.getUuid();
 CacheService.getUserCache().put('order-mail-preview-v2-'+token,JSON.stringify(s),600);
 const props=PropertiesService.getScriptProperties(),old=props.getProperty(orderMailKey_(s));
 const sources=s.plans[0].sources||[{id:s.id}];
 const previousState=sources.some(source=>['sending','uncertain'].includes(props.getProperty('order-mail-state-'+source.id)))
  ?'uncertain':old?JSON.parse(old).state:null;
 const {plans,...publicPreview}=s;
 let mailEnabled=false;try{MailApp.getRemainingDailyQuota();mailEnabled=true;}catch{}
 return {...publicPreview,token,mailEnabled,state:'ready',previousState};
}
function erpOrderPdfMailSend(token){
 orderDeliveryAuth_();if(typeof token!=='string'||token.length>100)throw Error('寄送預覽已失效');
 const lock=LockService.getScriptLock();if(!lock.tryLock(30000))throw Error('其他作業處理中，尚未寄送');
 try{
  const cache=CacheService.getUserCache(),attemptKey='order-mail-preview-v2-'+token;
  const raw=cache.get(attemptKey);if(!raw)throw Error('寄送預覽已過期，請重新核對收件人');
  const preview=JSON.parse(raw);
  if(preview.state==='sent')return {state:'sent',duplicate:true,time:preview.time,message:'此確認已交付 Google 寄送。'};
  if(preview.state)throw Error('這次寄送結果待確認，請先查收信件；如需重寄，請重新預覽並確認。');
  const s=orderDeliverySnapshot_(preview.id,preview.row,preview.test,preview.draft);
  if(JSON.stringify(s)!==raw)throw Error('訂單或員工 email 已變動，請重新預覽，尚未寄送');
  if(MailApp.getRemainingDailyQuota()<1)throw Error('今日寄信額度不足，尚未寄送');
  const files=orderDeliveryFiles_(s.plans),time=new Date().toISOString();
  const props=PropertiesService.getScriptProperties(),key=orderMailKey_(s),sources=s.plans[0].sources||[{id:s.id}];
  // Replace the preview under the lock. An evicted entry cannot authorize another send.
  cache.put(attemptKey,JSON.stringify({state:'sending',time}),600);
  props.setProperty(key,JSON.stringify({state:'sending',time}));
  for(const source of sources)props.setProperty('order-mail-state-'+source.id,'sending');
  try{MailApp.sendEmail({to:s.email,subject:s.subject,body:(s.plans[0].merged?'更新版，取代前版，請勿重複下單。來源訂單：'+s.plans[0].sources.map(x=>orderLabel(x.time)).join('、')+'\n\n':'')+s.name+' 您好：\n\n附件為本次核對後的訂藥 PDF 草稿（如有修訂，正式訂量尚未變更），共 '+s.files.length+' 份。\n'+s.files.map(f=>f.brand+'：'+f.count+' 項').join('\n')+'\n訂單編號：'+orderLabel(s.plans[0].time)+'\n\n'+(s.test?'此為功能測試郵件，請勿依此重複下單。\n':'')+'產生與寄送 PDF 不會增加庫存或重新登錄訂貨。',attachments:files.map(f=>f.blob),name:'瑞恩藥庫'});}catch(e){cache.put(attemptKey,JSON.stringify({state:'uncertain',time}),600);props.setProperty(key,JSON.stringify({state:'uncertain',time}));for(const source of sources)props.setProperty('order-mail-state-'+source.id,'uncertain');throw Error('Google 寄送結果待確認，請先查收信件；如需重寄，請重新預覽並確認。');}
  cache.put(attemptKey,JSON.stringify({state:'sent',time}),600);
  props.setProperty(key,JSON.stringify({state:'sent',time}));
  for(const source of sources){
   props.setProperty('order-mail-state-'+source.id,'sent');
   props.setProperty('order-mail-sent-'+source.id,time);
  }
  return {state:'sent',duplicate:false,time,message:'已交付 Google 寄送給 '+s.name+'，請收件人確認收件匣或垃圾郵件。'};
 }finally{lock.releaseLock();}
}
// Authorization check only. Never sends an email.
function erpOrderPdfMailPermissionCheck(){orderDeliveryAuth_();return MailApp.getRemainingDailyQuota();}


function erpOrderPdfDraftPreview(input){orderDeliveryAuth_();const plans=orderDeliveryRevised_(input?.id,input?.draft);return {groups:plans.map(p=>({brand:p.brand,items:p.items}))};}

// Read-only gate for the most recent confirmed order retained by the client.
function erpOrderFollowupStatus(id){
 orderDeliveryAuth_();const events=orderDeliveryEvents_(),plans=orderDeliveryPlans_(id,events),d=events.find(e=>e.draft.id===id).draft;
 const props=PropertiesService.getScriptProperties().getProperties(),roster=orderDeliveryRoster_();
 let state=props['order-mail-state-'+id]||'unsent';
 if(orderWasSent_(id,plans,roster,props))state='sent';
 else if(state==='unsent'){
  const variants=[plans,reviseOrderPdf_(plans,{rows:orderPdfSeed_(plans).rows})];
  for(const staff of roster)if(staff.valid)for(const p of variants)for(const test of [false,true]){
   const raw=props[orderMailKey_({id,email:staff.email,hash:loss3Hash_(p),test})];
   if(raw&&JSON.parse(raw).state!=='sent')state='uncertain';
  }
 }
 return {id,date:d.date,actor:d.actor,count:d.lines.length,brands:plans.map(p=>p.brand),state,lines:d.lines};
}
