function orderDeliveryAuth_(){loss3Actor_();const email=Session.getActiveUser().getEmail().toLowerCase(),allowed=(PropertiesService.getScriptProperties().getProperty('ERP_ALLOWED_EMAILS')||'').split(',').map(s=>s.trim().toLowerCase());if(!email||!allowed.includes(email))throw Error('此帳號尚未獲准使用藥庫站內同步');}
function orderDeliveryPlans_(id){
 const log=SpreadsheetApp.openById(ERP.orders).getSheetByName(ERP.orderLog);if(!log||log.getRange(1,1).getValue()!=='交易編號'||log.getLastRow()<2||log.getLastRow()>10000)throw Error('訂貨紀錄無法核對');
 const events=log.getRange(2,1,log.getLastRow()-1,2).getValues().filter(r=>r[0]||r[1]).map(r=>{const e=JSON.parse(r[1]);if(e?.draft?.id!==r[0])throw Error('訂貨紀錄編號不一致');return e;});return confirmedPrintPlan_(events,id);
}
function orderDeliveryRoster_(){const sh=SpreadsheetApp.openById(ERP.inventory).getSheetByName('員工名冊');if(!sh||sh.getLastRow()>10000)throw Error('員工名冊無法讀取');return orderMailRoster_(sh.getRange(1,2,Math.max(1,sh.getLastRow()),2).getDisplayValues());}
function erpOrderPdfStaff(){orderDeliveryAuth_();return {staff:orderDeliveryRoster_()};}
function orderDeliveryFiles_(plans){let size=0;return plans.map(p=>{const blob=HtmlService.createHtmlOutput(orderPdfHtml_(p)).getAs('application/pdf').setName(orderPdfName_(p));const bytes=blob.getBytes();size+=bytes.length;if(size>8*1024*1024)throw Error('PDF 附件總大小超過 8 MB，請分批訂單處理');return {p,blob,bytes};});}
function erpOrderPdfDownload(id){orderDeliveryAuth_();const plans=orderDeliveryPlans_(id);return {id,files:orderDeliveryFiles_(plans).map(({p,blob,bytes})=>({brand:p.brand,count:p.count,name:blob.getName(),mime:'application/pdf',base64:Utilities.base64Encode(bytes)}))};}
function orderDeliverySnapshot_(id,row,test){
 const plans=orderDeliveryPlans_(id),staff=orderDeliveryRoster_().find(s=>s.row===Number(row));if(!staff||!staff.valid)throw Error('所選員工沒有有效的 C 欄 email，請先更新名冊');
 const files=plans.map(p=>({name:orderPdfName_(p),count:p.count,brand:p.brand}));return {id,row:staff.row,name:staff.name,email:staff.email,test:!!test,hash:loss3Hash_(plans),files,subject:(test?'【功能測試・請勿重複下單】':'')+'訂藥 PDF｜'+plans[0].date+'｜'+plans.map(p=>p.brand).join('、'),plans};
}
function orderMailKey_(s){return 'order-mail-v1-'+loss3Hash_({id:s.id,email:s.email.toLowerCase(),hash:s.hash,test:s.test});}
function erpOrderPdfMailPreview(input){
 orderDeliveryAuth_();const s=orderDeliverySnapshot_(input?.id,input?.row,input?.test),token=Utilities.getUuid();CacheService.getUserCache().put('order-mail-preview-'+token,JSON.stringify(s),600);
 const old=PropertiesService.getScriptProperties().getProperty(orderMailKey_(s));const {plans,...publicPreview}=s;let mailEnabled=false;try{MailApp.getRemainingDailyQuota();mailEnabled=true;}catch{}return {...publicPreview,token,mailEnabled,state:old?JSON.parse(old).state:'ready'};
}
function erpOrderPdfMailSend(token){
 orderDeliveryAuth_();if(typeof token!=='string'||token.length>100)throw Error('寄送預覽已失效');
 const raw=CacheService.getUserCache().get('order-mail-preview-'+token);if(!raw)throw Error('寄送預覽已過期，請重新核對收件人');const preview=JSON.parse(raw);
 const lock=LockService.getScriptLock();if(!lock.tryLock(30000))throw Error('其他作業處理中，尚未寄送');
 try{
  const s=orderDeliverySnapshot_(preview.id,preview.row,preview.test);if(JSON.stringify(s)!==raw)throw Error('訂單或員工 email 已變動，請重新預覽，尚未寄送');
  const props=PropertiesService.getScriptProperties(),key=orderMailKey_(s),oldRaw=props.getProperty(key),old=oldRaw?JSON.parse(oldRaw):null;
  if(old?.state==='sent')return {state:'sent',duplicate:true,time:old.time,message:'此訂單已交付 Google 寄送給此員工，未重複寄送。'};
  if(old)throw Error('上次寄送結果待確認，請先查收信件；系統不會自動重寄');
  if(MailApp.getRemainingDailyQuota()<1)throw Error('今日寄信額度不足，尚未寄送');
  const files=orderDeliveryFiles_(s.plans);const time=new Date().toISOString();props.setProperty(key,JSON.stringify({state:'sending',time}));
  try{MailApp.sendEmail({to:s.email,subject:s.subject,body:s.name+' 您好：\n\n附件為本次已確認訂單的各廠牌 PDF，共 '+s.files.length+' 份。\n'+s.files.map(f=>f.brand+'：'+f.count+' 項').join('\n')+'\n訂單編號：'+s.id+'\n\n'+(s.test?'此為功能測試郵件，請勿依此重複下單。\n':'')+'產生與寄送 PDF 不會增加庫存或重新登錄訂貨。',attachments:files.map(f=>f.blob),name:'瑞恩藥庫'});}catch(e){props.setProperty(key,JSON.stringify({state:'uncertain',time}));throw Error('Google 寄送結果待確認，請先查收信件，不會自動重寄');}
  props.setProperty(key,JSON.stringify({state:'sent',time}));return {state:'sent',duplicate:false,time,message:'已交付 Google 寄送給 '+s.name+'，請收件人確認收件匣或垃圾郵件。'};
 }finally{lock.releaseLock();}
}
// Authorization check only. Never sends an email.
function erpOrderPdfMailPermissionCheck(){orderDeliveryAuth_();return MailApp.getRemainingDailyQuota();}

