const Shortage=(function(){
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
function text(value,label,max){if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\u0000-\u001f]/.test(value))throw Error(label+'格式無效');return value.trim();}
function integer(value,label,min=0){if(!Number.isSafeInteger(value)||value<min||value>1000000)throw Error(label+'須為有效整數');return value;}
function choice(value,values,label){if(!values.includes(value))throw Error(label+'無效');return value;}
function identifier(value,prefix){if(typeof value!=='string'||!new RegExp('^'+prefix+'-'+UUID+'$','i').test(value))throw Error('紀錄編號無效');return value;}
function revision(value){if(!Number.isSafeInteger(value)||value<0)throw Error('版本無效');return value;}
function item(value){if(!value||typeof value!=='object')throw Error('品項無效');return {sheet:text(value.sheet,'分頁',100),code:text(value.code,'藥品編號',60),name:text(value.name,'藥品名稱',120)};}
function note(value){if(typeof value!=='string'||value.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error('備註格式無效');return value.trim();}
function date(value){if(value==='')return '';if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error('預計到貨日期無效');return value;}
function normalizeShortage(input){
 if(!input||typeof input!=='object')throw Error('缺藥紀錄無效');
 const r={id:identifier(input.id,'SH'),revision:revision(input.revision),...item(input),need:integer(input.need,'待補數量'),threshold:integer(input.threshold,'補貨門檻'),priority:choice(input.priority,['normal','urgent'],'優先順序'),status:choice(input.status,['pending','confirmed','sufficient','closed','cancelled','deferred'],'處理狀態'),supply:choice(input.supply,['unknown','available','unavailable'],'供貨狀態'),eta:date(input.eta),note:note(input.note),actor:text(input.actor,'經手人',80)};
 if(['closed','cancelled','deferred'].includes(r.status)&&!r.note)throw Error('結案、取消或暫不補貨須填寫原因');return r;
}
function normalizeSubstitution(input){
 if(!input||typeof input!=='object')throw Error('替代設定無效');
 const r={id:identifier(input.id,'SU'),revision:revision(input.revision),from:item(input.from),to:item(input.to),priority:integer(input.priority,'替代優先順序',1),note:note(input.note),status:choice(input.status,['pending','confirmed','disabled'],'確認狀態'),actor:text(input.actor,'經手人',80)};
 if(r.from.sheet===r.to.sheet&&r.from.code===r.to.code)throw Error('替代品項不得與缺藥品項相同');
 if(r.status==='confirmed'&&!r.note)throw Error('確認替代設定前須填寫適用條件與限制');return r;
}
function allocationShape(input){if(!input||typeof input!=='object')throw Error('交易關聯無效');return {shortageId:identifier(input.shortageId,'SH'),kind:choice(input.kind,['order','receipt'],'交易關聯種類'),transactionId:text(input.transactionId,'交易編號',100),sheet:text(input.sheet,'分頁',100),code:text(input.code,'藥品編號',60),quantity:integer(input.quantity,'關聯數量',1)};}
function transactionLine(a,orderEvents,receiptEvents){
 const events=a.kind==='order'?orderEvents:receiptEvents,action=a.kind==='order'?'訂貨':'進貨',reverse=a.kind==='order'?'取消訂貨':'沖銷';
 const found=events.filter(e=>e?.draft?.id===a.transactionId&&e.draft.action===action);
 if(found.length!==1)throw Error('找不到唯一已入帳交易');
 if(events.some(e=>e?.draft?.action===reverse&&e.draft.reverses===a.transactionId))throw Error('原交易已取消或沖銷');
 const lines=(found[0].draft.lines||[]).filter(l=>l.sheet===a.sheet&&l.code===a.code);
 if(lines.length!==1||!Number.isSafeInteger(lines[0].quantity)||lines[0].quantity<=0)throw Error('交易品項或數量無效');return lines[0];
}
function validateAllocation(input,allocations=[],orderEvents=[],receiptEvents=[]){
 const a=allocationShape(input),line=transactionLine(a,orderEvents,receiptEvents);
 let used=0;for(const x of allocations){if(x.kind===a.kind&&x.transactionId===a.transactionId&&x.sheet===a.sheet&&x.code===a.code){integer(x.quantity,'既有關聯數量',1);used+=x.quantity;}}
 if(used+a.quantity>line.quantity)throw Error('關聯數量超過原交易數量');return a;
}
function shortageProgress(record,allocations=[],orderEvents=[],receiptEvents=[]){
 const r=normalizeShortage(record);let ordered=0,received=0,invalidAllocations=0;
 // Validate global totals, not just this shortage: another record may share a transaction.
 for(let i=0;i<allocations.length;i++){const input=allocations[i];if(input.shortageId!==r.id)continue;
  try{const a=validateAllocation(input,allocations.filter((_,j)=>j!==i),orderEvents,receiptEvents),line=transactionLine(a,orderEvents,receiptEvents);if(a.sheet!==r.sheet||a.code!==r.code||line.name!==r.name)throw Error('藥品身分不符');if(a.kind==='order')ordered+=a.quantity;else received+=a.quantity;}catch{invalidAllocations++;}}
 const outstanding=Math.max(0,ordered-received),toOrder=Math.max(0,r.need-Math.max(ordered,received));
 return {ordered,received,outstanding,toOrder,progress:received>0?(outstanding>0||toOrder>0?'partial':'arrived'):ordered>0?'pending':'unordered',invalidAllocations};
}

return {normalizeShortage,normalizeSubstitution,validateAllocation,shortageProgress};})();
// Shortage records are append-only revisions. Never modifies inventory cells.
const SHORTAGE_TABLES={records:'缺藥管理',substitutions:'缺藥替代設定',events:'缺藥追蹤紀錄'};
function shortageRows_(ss,title){const sh=ss.getSheetByName(title);if(!sh)return [];if(sh.getRange(1,1,1,3).getDisplayValues()[0].join('|')!=='事件編號|資料JSON|更新時間')throw Error(title+' 表頭不符');if(sh.getLastRow()>10000)throw Error(title+' 超過讀取上限');return sh.getLastRow()<2?[]:sh.getRange(2,1,sh.getLastRow()-1,3).getValues().filter(r=>r.some(v=>v!==''&&v!==null)).map(r=>JSON.parse(r[1]));}
function shortageLatest_(rows){const m=new Map();rows.forEach(r=>m.set(r.id,r));return [...m.values()];}
function shortageLog_(id,title){const ss=SpreadsheetApp.openById(id),sh=ss.getSheetByName(title);if(!sh)return [];if(sh.getRange(1,1).getValue()!=='交易編號'||sh.getLastRow()>10000)throw Error('交易紀錄格式或範圍異常');return sh.getLastRow()<2?[]:sh.getRange(2,1,sh.getLastRow()-1,3).getValues().filter(r=>r.some(v=>v!==''&&v!==null)).map(r=>JSON.parse(r[1]));}
function shortageRead_(){const ss=SpreadsheetApp.openById(ERP.inventory),orders=shortageLog_(ERP.orders,ERP.orderLog),receipts=shortageLog_(ERP.inventory,ERP.log),events=shortageRows_(ss,SHORTAGE_TABLES.events);for(const [kind,list] of [['order',orders],['receipt',receipts]])for(const event of list)for(const a of event.draft.shortageLinks||[])events.push({targetId:a.shortageId,kind:'allocation',actor:event.draft.actor,time:event.time,request:JSON.stringify(event.draft),allocation:{...a,kind,transactionId:event.draft.id}});return {records:shortageLatest_(shortageRows_(ss,SHORTAGE_TABLES.records)),substitutions:shortageLatest_(shortageRows_(ss,SHORTAGE_TABLES.substitutions)),events,orders,receipts};}

function shortageItem_(item){const sources=erpOrderSources_();if(!sources.some(s=>s.name===item.sheet))throw Error('廠商來源未啟用');const v=SpreadsheetApp.openById(ERP.inventory).getSheetByName(item.sheet).getDataRange().getDisplayValues().slice(2);const matches=v.filter(r=>String(r[1]).trim()===item.code);if(matches.length!==1||String(matches[0][3]).trim()!==item.name)throw Error('藥品編號或名稱已變動，請重新讀取');}
function shortageSave_(input){
 const lock=LockService.getScriptLock();if(!lock.tryLock(30000))throw Error('其他操作處理中，請重試');
 try{
 if(!input||!/^SE-[a-zA-Z0-9-]{8,80}$/.test(input.operationId||''))throw Error('操作編號無效');
 const ss=SpreadsheetApp.openById(ERP.inventory),state=shortageRead_();const oldEvent=state.events.find(e=>e.operationId===input.operationId);if(oldEvent){if(oldEvent.request!==JSON.stringify(input))throw Error('同操作編號內容不同');return {id:oldEvent.targetId,operationId:input.operationId};}
 let value,table;
 if(input.kind==='record'){value=Shortage.normalizeShortage(input.value);shortageItem_(value);table='records';if(!['closed','cancelled'].includes(value.status)&&state.records.some(r=>r.id!==value.id&&r.sheet===value.sheet&&r.code===value.code&&!['closed','cancelled'].includes(r.status)))throw Error('此藥品已有追蹤紀錄，請更新原紀錄');}
 else if(input.kind==='substitution'){value=Shortage.normalizeSubstitution(input.value);shortageItem_(value.from);shortageItem_(value.to);table='substitutions';if(state.substitutions.some(r=>r.id!==value.id&&r.from.sheet===value.from.sheet&&r.from.code===value.from.code&&r.to.sheet===value.to.sheet&&r.to.code===value.to.code))throw Error('此替代關係已存在，請更新原設定');}
 else if(input.kind==='allocation'){
 value=input.value;const record=state.records.find(r=>r.id===value.shortageId);if(!record)throw Error('缺藥紀錄不存在');if(!['order','receipt'].includes(value.kind))throw Error('關聯種類無效');if(value.sheet!==record.sheet||value.code!==record.code)throw Error('關聯品項不符');
 value=Shortage.validateAllocation(value,state.events.filter(e=>e.allocation).map(e=>e.allocation),state.orders,state.receipts);const transaction=(value.kind==='order'?state.orders:state.receipts).find(e=>e.draft.id===value.transactionId);if(transaction.draft.lines.find(l=>l.sheet===value.sheet&&l.code===value.code).name!==record.name)throw Error('交易品項名稱不符');
 if(!input.actor||String(input.actor).length>80)throw Error('經手人必填');
 }else throw Error('不支援的缺藥操作');
 if(table){const prev=state[table].find(r=>r.id===value.id);if(table==='records'&&prev&&(prev.sheet!==value.sheet||prev.code!==value.code||prev.name!==value.name))throw Error('已有紀錄不得變更藥品身分');if(value.revision!==(prev?.revision||0))throw Error('其他人已更新，請重新讀取後修改');value={...value,revision:value.revision+1,updatedAt:new Date().toISOString(),updatedBy:Session.getActiveUser().getEmail()};}
 const event={operationId:input.operationId,targetId:value.id||value.shortageId,kind:input.kind,actor:value.actor||input.actor,request:JSON.stringify(input),time:new Date().toISOString(),...(input.kind==='allocation'?{allocation:value}:{})};
 const requests=[],used=new Set(ss.getSheets().map(s=>s.getSheetId()));
 const append=(name,data)=>{let sh=ss.getSheetByName(name),id=sh?.getSheetId();if(!sh){id=904295000;while(used.has(id))id++;used.add(id);requests.push({addSheet:{properties:{sheetId:id,title:name,gridProperties:{rowCount:2,columnCount:3,frozenRowCount:1}}}});requests.push({updateCells:{start:{sheetId:id,rowIndex:0,columnIndex:0},rows:[{values:['事件編號','資料JSON','更新時間'].map(v=>({userEnteredValue:{stringValue:v}}))}],fields:'userEnteredValue'}});}requests.push({appendCells:{sheetId:id,rows:[{values:[input.operationId,JSON.stringify(data),event.time].map(v=>({userEnteredValue:{stringValue:v}}))}],fields:'userEnteredValue'}});};
 if(table)append(SHORTAGE_TABLES[table],value);append(SHORTAGE_TABLES.events,event);
 Sheets.Spreadsheets.batchUpdate({requests},ERP.inventory);return {id:event.targetId,operationId:input.operationId};
 }finally{lock.releaseLock();}
}

