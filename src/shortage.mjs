const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
function text(value,label,max){if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\u0000-\u001f]/.test(value))throw Error(label+'格式無效');return value.trim();}
function integer(value,label,min=0){if(!Number.isSafeInteger(value)||value<min||value>1000000)throw Error(label+'須為有效整數');return value;}
function choice(value,values,label){if(!values.includes(value))throw Error(label+'無效');return value;}
function identifier(value,prefix){if(typeof value!=='string'||!new RegExp('^'+prefix+'-'+UUID+'$','i').test(value))throw Error('紀錄編號無效');return value;}
function revision(value){if(!Number.isSafeInteger(value)||value<0)throw Error('版本無效');return value;}
function item(value){if(!value||typeof value!=='object')throw Error('品項無效');return {sheet:text(value.sheet,'分頁',100),code:text(value.code,'藥品編號',60),name:text(value.name,'藥品名稱',120)};}
function note(value){if(typeof value!=='string'||value.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error('備註格式無效');return value.trim();}
function date(value){if(value==='')return '';if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error('預計到貨日期無效');return value;}
export function normalizeShortage(input){
 if(!input||typeof input!=='object')throw Error('缺藥紀錄無效');
 const r={id:identifier(input.id,'SH'),revision:revision(input.revision),...item(input),need:integer(input.need,'待補數量'),threshold:integer(input.threshold,'補貨門檻'),priority:choice(input.priority,['normal','urgent'],'優先順序'),status:choice(input.status,['pending','confirmed','sufficient','closed','cancelled','deferred'],'處理狀態'),supply:choice(input.supply,['unknown','available','unavailable'],'供貨狀態'),eta:date(input.eta),note:note(input.note),actor:text(input.actor,'經手人',80)};
 if(['closed','cancelled','deferred'].includes(r.status)&&!r.note)throw Error('結案、取消或暫不補貨須填寫原因');return r;
}
export function normalizeSubstitution(input){
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
export function validateAllocation(input,allocations=[],orderEvents=[],receiptEvents=[]){
 const a=allocationShape(input),line=transactionLine(a,orderEvents,receiptEvents);
 let used=0;for(const x of allocations){if(x.kind===a.kind&&x.transactionId===a.transactionId&&x.sheet===a.sheet&&x.code===a.code){integer(x.quantity,'既有關聯數量',1);used+=x.quantity;}}
 if(used+a.quantity>line.quantity)throw Error('關聯數量超過原交易數量');return a;
}
export function shortageProgress(record,allocations=[],orderEvents=[],receiptEvents=[]){
 const r=normalizeShortage(record);let ordered=0,received=0,invalidAllocations=0;
 // Validate global totals, not just this shortage: another record may share a transaction.
 for(let i=0;i<allocations.length;i++){const input=allocations[i];if(input.shortageId!==r.id)continue;
  try{const a=validateAllocation(input,allocations.filter((_,j)=>j!==i),orderEvents,receiptEvents),line=transactionLine(a,orderEvents,receiptEvents);if(a.sheet!==r.sheet||a.code!==r.code||line.name!==r.name)throw Error('藥品身分不符');if(a.kind==='order')ordered+=a.quantity;else received+=a.quantity;}catch{invalidAllocations++;}}
 const outstanding=Math.max(0,ordered-received),toOrder=Math.max(0,r.need-Math.max(ordered,received));
 return {ordered,received,outstanding,toOrder,progress:received>0?(outstanding>0||toOrder>0?'partial':'arrived'):ordered>0?'pending':'unordered',invalidAllocations};
}
