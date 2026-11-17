const pdfEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function orderPdfName_(p){return `${p.brand}_訂藥_${p.date}_${p.id.slice(-8)}.pdf`.replace(/[\\/:*?"<>|\r\n]/g,'_');}
function orderPdfHtml_(p){
 const pages=[];for(let c=0;c<p.values[0].length;c+=6){const cols=Math.min(6,p.values[0].length-c);pages.push(`<section><h1>${pdfEscape(p.brand)}訂購清單</h1><p>訂貨日期：${pdfEscape(p.date)}　經手人：${pdfEscape(p.actor)}　單位：瓶</p><table><colgroup>${Array.from({length:cols},(_,i)=>`<col style="width:${i%2?25/(cols/2):75/(cols/2)}%">`).join('')}</colgroup><thead><tr>${p.values[1].slice(c,c+cols).map(x=>`<th>${pdfEscape(x).replaceAll('\n','<br>')}</th>`).join('')}</tr></thead><tbody>${p.values.slice(2).map(r=>`<tr>${r.slice(c,c+cols).map(x=>`<td>${pdfEscape(x)||'&nbsp;'}</td>`).join('')}</tr>`).join('')}</tbody></table><footer>本廠牌共 ${p.count} 項 · 訂單編號：${pdfEscape(p.id)}<br>${p.edited?"本 PDF 依草稿修訂；正式訂量與庫存未變更。":"僅為訂藥清單，尚未入庫。"}</footer></section>`);}
 return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><style>@page{size:A4 portrait;margin:12mm}body{font-family:'Noto Sans CJK TC','Microsoft JhengHei',sans-serif;color:#172c43;font-size:11px;margin:0}section{page-break-after:always}section:last-child{page-break-after:auto}h1{font-size:20px;text-align:center;margin:0 0 10px}p{text-align:center;margin:0 0 12px}table{border-collapse:collapse;width:100%;table-layout:fixed}thead{display:table-header-group}th,td{border:1px solid #777;text-align:center;vertical-align:middle;padding:5px 3px;overflow-wrap:anywhere;word-wrap:break-word}th{background:#f0f0ed}tr{page-break-inside:avoid}footer{font-size:9px;color:#555;margin-top:12px;overflow-wrap:anywhere}</style></head><body>${pages.join('')}</body></html>`;
}
function orderMailRoster_(values){
 if(values[0]?.[0]!=='員工姓名'||String(values[0]?.[1]||'').trim().toLowerCase()!=='email')throw Error('員工名冊 B1/C1 必須是員工姓名/email');
 return values.slice(1).map((r,i)=>({row:i+2,name:String(r[0]??'').trim(),email:String(r[1]??'').trim()})).filter(r=>r.name).map(r=>({...r,valid:/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(r.email)}));
}

// PDF-only revisions. This module never creates inventory or order transactions.
function orderPdfSeed_(plans){
 return {rows:plans.flatMap(p=>p.items.map(l=>({key:l.sheet+'|'+l.code,brand:p.brand,category:l.sheet.slice(p.brand.length),code:l.code,name:l.name,quantity:l.quantity,manual:false}))),brands:[...new Set([...plans.map(p=>p.brand),'科達','天明','富田'])]};
}
function reviseOrderPdf_(plans,draft){
 const seed=orderPdfSeed_(plans);if(!draft||!Array.isArray(draft.rows)||draft.rows.length>1000)throw Error('PDF 草稿格式不符或超過 1000 列');
 const originals=new Map(seed.rows.map(r=>[r.key,r])),used=new Set(),names=new Set(),rows=[];
 for(const input of draft.rows){
  if(!input||typeof input!=='object')throw Error('PDF 品項格式不符');
  let row;
  if(input.manual===true){const name=String(input.name??'').trim();if(!name&&(input.quantity===''||input.quantity===null||input.quantity===undefined))continue;
   if(!name||name.length>120||/[\r\n\u0000-\u001f]/.test(name))throw Error('手動品項請填入 1 至 120 字的藥品名稱');
   if(!seed.brands.includes(input.brand)||!['單方','複方'].includes(input.category))throw Error(name+'：請選擇廠牌與單方／複方');
   row={brand:input.brand,category:input.category,code:'',name,manual:true};
  }else{const original=originals.get(input.key);if(!original||used.has(input.key))throw Error('原訂單品項無法核對或重複');used.add(input.key);row={...original};}
  const quantity=typeof input.quantity==='number'?input.quantity:(typeof input.quantity==='string'&&input.quantity.trim()!==''?Number(input.quantity):NaN);
  if(!Number.isInteger(quantity)||quantity<1||quantity>1000000)throw Error(row.name+'：數量須為 1 至 1000000 的整數；不寄送請按移除');
  const nameKey=[row.brand,row.category,row.name.normalize('NFKC').replace(/\s/g,'')].join('|');if(names.has(nameKey))throw Error(row.brand+' '+row.name+' 重複，請合併數量');names.add(nameKey);rows.push({...row,quantity});
 }
 if(!rows.length)throw Error('至少保留一項藥品才能產生 PDF');
 return seed.brands.flatMap(brand=>{const items=rows.filter(r=>r.brand===brand);if(!items.length)return [];const columns=[];
  for(const category of ['單方','複方']){const list=items.filter(r=>r.category===category);for(let i=0;i<list.length;i+=22){const chunk=list.slice(i,i+22);columns.push(['',category+'・藥品名稱',...chunk.map(r=>(r.manual?'[手動新增] ':'')+r.name)],['',plans[0].date.slice(5).replace('-','/')+'\n訂量',...chunk.map(r=>r.quantity)]);}}
  const values=Array.from({length:24},(_,i)=>columns.map(c=>c[i]??''));return [{...plans[0],brand,title:brand+'訂單列印版',count:items.length,values,items,edited:true}];
 });
}

function orderDeliveryAuth_(){loss3Actor_();const email=Session.getActiveUser().getEmail().toLowerCase(),allowed=(PropertiesService.getScriptProperties().getProperty('ERP_ALLOWED_EMAILS')||'').split(',').map(s=>s.trim().toLowerCase());if(!email||!allowed.includes(email))throw Error('此帳號尚未獲准使用藥庫站內同步');}
function orderDeliveryPlans_(id){
 const log=SpreadsheetApp.openById(ERP.orders).getSheetByName(ERP.orderLog);if(!log||log.getRange(1,1).getValue()!=='交易編號'||log.getLastRow()<2||log.getLastRow()>10000)throw Error('訂貨紀錄無法核對');
 const events=log.getRange(2,1,log.getLastRow()-1,2).getValues().filter(r=>r[0]||r[1]).map(r=>{const e=JSON.parse(r[1]);if(e?.draft?.id!==r[0])throw Error('訂貨紀錄編號不一致');return e;});return confirmedPrintPlan_(events,id).map(p=>({...p,items:events.find(e=>e.draft.id===id).draft.lines.filter(l=>l.sheet===p.brand+'單方'||l.sheet===p.brand+'複方')}));
}
function erpOrderPdfEditSource(id){orderDeliveryAuth_();const plans=orderDeliveryPlans_(id);return {id,date:plans[0].date,actor:plans[0].actor,sourceHash:loss3Hash_(plans),...orderPdfSeed_(plans)};}
function orderDeliveryRevised_(id,draft){const base=orderDeliveryPlans_(id);if(!draft)return base;if(draft.sourceHash!==loss3Hash_(base))throw Error('原訂單已變更，請重新載入並核對 PDF 草稿');return reviseOrderPdf_(base,draft);}
function orderDeliveryRoster_(){const sh=SpreadsheetApp.openById(ERP.inventory).getSheetByName('員工名冊');if(!sh||sh.getLastRow()>10000)throw Error('員工名冊無法讀取');return orderMailRoster_(sh.getRange(1,2,Math.max(1,sh.getLastRow()),2).getDisplayValues());}
function erpOrderPdfStaff(){orderDeliveryAuth_();return {staff:orderDeliveryRoster_()};}
function orderDeliveryFiles_(plans){let size=0;return plans.map(p=>{const blob=HtmlService.createHtmlOutput(orderPdfHtml_(p)).getAs('application/pdf').setName(orderPdfName_(p));const bytes=blob.getBytes();size+=bytes.length;if(size>8*1024*1024)throw Error('PDF 附件總大小超過 8 MB，請分批訂單處理');return {p,blob,bytes};});}
function erpOrderPdfDownload(input){orderDeliveryAuth_();const id=typeof input==='string'?input:input?.id,plans=orderDeliveryRevised_(id,typeof input==='object'?input.draft:null);return {id,files:orderDeliveryFiles_(plans).map(({p,blob,bytes})=>({brand:p.brand,count:p.count,name:blob.getName(),mime:'application/pdf',base64:Utilities.base64Encode(bytes)}))};}
function orderDeliverySnapshot_(id,row,test,draft=null){
 const plans=orderDeliveryRevised_(id,draft),staff=orderDeliveryRoster_().find(s=>s.row===Number(row));if(!staff||!staff.valid)throw Error('所選員工沒有有效的 C 欄 email，請先更新名冊');
 const files=plans.map(p=>({name:orderPdfName_(p),count:p.count,brand:p.brand}));return {id,draft,row:staff.row,name:staff.name,email:staff.email,test:!!test,hash:loss3Hash_(plans),files,subject:(test?'【功能測試・請勿重複下單】':'')+'訂藥 PDF｜'+plans[0].date+'｜'+plans.map(p=>p.brand).join('、'),plans};
}
function orderMailKey_(s){return 'order-mail-v1-'+loss3Hash_({id:s.id,email:s.email.toLowerCase(),hash:s.hash,test:s.test});}
function erpOrderPdfMailPreview(input){
 orderDeliveryAuth_();const s=orderDeliverySnapshot_(input?.id,input?.row,input?.test,input?.draft||null),token=Utilities.getUuid();CacheService.getUserCache().put('order-mail-preview-'+token,JSON.stringify(s),600);
 const old=PropertiesService.getScriptProperties().getProperty(orderMailKey_(s));const {plans,...publicPreview}=s;let mailEnabled=false;try{MailApp.getRemainingDailyQuota();mailEnabled=true;}catch{}return {...publicPreview,token,mailEnabled,state:old?JSON.parse(old).state:'ready'};
}
function erpOrderPdfMailSend(token){
 orderDeliveryAuth_();if(typeof token!=='string'||token.length>100)throw Error('寄送預覽已失效');
 const raw=CacheService.getUserCache().get('order-mail-preview-'+token);if(!raw)throw Error('寄送預覽已過期，請重新核對收件人');const preview=JSON.parse(raw);
 const lock=LockService.getScriptLock();if(!lock.tryLock(30000))throw Error('其他作業處理中，尚未寄送');
 try{
  const s=orderDeliverySnapshot_(preview.id,preview.row,preview.test,preview.draft);if(JSON.stringify(s)!==raw)throw Error('訂單或員工 email 已變動，請重新預覽，尚未寄送');
  const props=PropertiesService.getScriptProperties(),key=orderMailKey_(s),oldRaw=props.getProperty(key),old=oldRaw?JSON.parse(oldRaw):null;
  if(old?.state==='sent')return {state:'sent',duplicate:true,time:old.time,message:'此訂單已交付 Google 寄送給此員工，未重複寄送。'};
  if(old)throw Error('上次寄送結果待確認，請先查收信件；系統不會自動重寄');
  if(MailApp.getRemainingDailyQuota()<1)throw Error('今日寄信額度不足，尚未寄送');
  const files=orderDeliveryFiles_(s.plans);const time=new Date().toISOString();props.setProperty(key,JSON.stringify({state:'sending',time}));
  try{MailApp.sendEmail({to:s.email,subject:s.subject,body:s.name+' 您好：\n\n附件為本次核對後的訂藥 PDF 草稿（如有修訂，正式訂量尚未變更），共 '+s.files.length+' 份。\n'+s.files.map(f=>f.brand+'：'+f.count+' 項').join('\n')+'\n訂單編號：'+s.id+'\n\n'+(s.test?'此為功能測試郵件，請勿依此重複下單。\n':'')+'產生與寄送 PDF 不會增加庫存或重新登錄訂貨。',attachments:files.map(f=>f.blob),name:'瑞恩藥庫'});}catch(e){props.setProperty(key,JSON.stringify({state:'uncertain',time}));throw Error('Google 寄送結果待確認，請先查收信件，不會自動重寄');}
  props.setProperty(key,JSON.stringify({state:'sent',time}));return {state:'sent',duplicate:false,time,message:'已交付 Google 寄送給 '+s.name+'，請收件人確認收件匣或垃圾郵件。'};
 }finally{lock.releaseLock();}
}
// Authorization check only. Never sends an email.
function erpOrderPdfMailPermissionCheck(){orderDeliveryAuth_();return MailApp.getRemainingDailyQuota();}


function erpOrderPdfDraftPreview(input){orderDeliveryAuth_();const plans=orderDeliveryRevised_(input?.id,input?.draft);return {groups:plans.map(p=>({brand:p.brand,items:p.items}))};}
