// Shared by the browser and the generated Apps Script build. No spreadsheet writes.
export function isoDay(s){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s)))throw Error('請使用完整年月日');
 const d=new Date(s+'T00:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==s)throw Error('日期無效');return s;
}
export function periodDays(start,end,ignore=[]){
 isoDay(start);isoDay(end);if(start>end)throw Error('開始日期不能晚於結束日期');
 if((Date.parse(end)-Date.parse(start))/86400000>62)throw Error('單次期間最多63天');
 ignore.forEach(isoDay);const out=[];for(let t=Date.parse(start);t<=Date.parse(end);t+=86400000){const d=new Date(t),s=d.toISOString().slice(0,10);if(d.getUTCDay()!==0&&!ignore.includes(s))out.push(s);}if(!out.length)throw Error('期間沒有開藥日（預設週日休診）');return out;
}
export function headerDate(value,days){
 const s=String(value??'').trim(),full=s.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/),md=s.match(/^(\d{1,2})[\/.-](\d{1,2})$/);
 if(full){try{return isoDay(`${full[1]}-${full[2].padStart(2,'0')}-${full[3].padStart(2,'0')}`);}catch{return null;}}
 if(md){const matches=days.filter(d=>Number(d.slice(5,7))===Number(md[1])&&Number(d.slice(8))===Number(md[2]));return matches.length===1?matches[0]:null;}return null;
}
export function numberOrNull(v){const s=String(v??'').trim();return /^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s)&&Number.isFinite(Number(s))?Number(s):null;}
export function calculateOrderRows(grid,source,options){
 const days=periodDays(options.start,options.end,options.ignore||[]);
 const target=Number(options.targetDays),shipping=Number(options.shippingDays),holiday=Number(options.holidayDays);
 if(!Number.isFinite(target)||target<1||target>90||!Number.isFinite(shipping)||shipping<0||shipping>30||!Number.isFinite(holiday)||holiday<0||holiday>90)throw Error('備貨與加成天數超出範圍');
 if(grid[0]?.[1]!=='編號'||grid[0]?.[3]!=='藥品名稱'||grid[1]?.[6]!=='未拆封')throw Error(source.name+' 來源欄位已變動');
 const dates=new Map();for(let c=13;c<(grid[0]?.length||0);c++){
  if(!/^(?:週|星期)?[一二三四五六日天]$/.test(String(grid[1]?.[c]??'').trim()))continue;
  const d=headerDate(grid[0][c],days);if(!days.includes(d))continue;
  if(dates.has(d))throw Error(source.name+' 每日耗損日期重複：'+d);dates.set(d,c);
 }
 const missing=days.filter(d=>!dates.has(d)),counts=new Map();for(const r of grid.slice(2))if(r[3]?.trim()&&String(r[1]??'').trim())counts.set(String(r[1]).trim(),(counts.get(String(r[1]).trim())||0)+1);
 const rows=[];for(let i=2;i<grid.length;i++){
  const r=grid[i],name=String(r[3]??'').trim();if(!name)continue;const code=String(r[1]??'').trim(),stock=numberOrNull(r[6]);let total=0,blank=0,invalid=0;const warnings=[];
  for(const c of dates.values()){const raw=String(r[c]??'').trim(),n=numberOrNull(raw);if(raw===''){blank++;continue;}if(n===null||n<0){invalid++;continue;}total+=n;}
  if(!code)warnings.push('缺編號');if(counts.get(code)>1)warnings.push('同廠牌編號重複');if(missing.length)warnings.push('缺 '+missing.length+' 天日期欄');if(blank&&!options.blankAsZero)warnings.push(blank+' 天未填耗損');if(invalid)warnings.push('耗損有非數字或負數');if(stock===null||stock<0)warnings.push('庫存待核對');
  const complete=!missing.length&&!invalid&&(!blank||options.blankAsZero),average=complete?total/days.length:null;
  const suggested=complete&&!warnings.length?Math.max(0,Math.ceil((average*(target+shipping+holiday)-stock)-1e-9)):null;
  rows.push({id:source.name+':'+(code||'row'+(i+1))+':'+(i+1),sourceRow:i+1,brand:source.brand,category:source.category,sheet:source.name,code,name,stock,stockDate:String(r[5]??''),usage:Math.round(total*100)/100,days:days.length,observedDays:dates.size,blankDays:blank,average,suggested,status:String(r[10]??''),shortage:String(r[11]??''),warnings});
 }
 return {rows,days,missing,assumption:'無年份表頭依所選期間解讀；週日排除',options:{...options,targetDays:target,shippingDays:shipping,holidayDays:holiday}};
}
export function makeOrder(snapshot,quantities,actor,confirmed,id,createdAt){
 if(!snapshot?.rows?.length)throw Error('請先計算耗損');if(!String(actor).trim())throw Error('請填經手人');if(!confirmed)throw Error('請確認已核對庫存、缺漏資料與訂量');
 const lines=[];for(const r of snapshot.rows){const raw=quantities[r.id];if(raw===undefined||raw==='')continue;const n=numberOrNull(raw);if(n===null||n<0||!Number.isInteger(n)||n>100000)throw Error(r.name+' 訂量須為非負整瓶數');if(n>0)lines.push({...r,quantity:n});}
 if(!lines.length)throw Error('至少填寫一項大於0的訂貨量');
 return {kind:'tcm-purchase-order',version:2,id,createdAt,actor:String(actor).trim(),status:'已確認草稿・未送出',options:snapshot.options,lines};
}
export function validateOrderStore(s){
 if(!s||typeof s.drafts!=='object'||!s.drafts||Array.isArray(s.drafts)||!Array.isArray(s.orders)||s.orders.length>5000)throw Error('訂貨備份格式錯誤');
 function rows(list){if(!Array.isArray(list)||list.length>5000)throw Error('訂貨品項格式錯誤');for(const r of list){if(!r||['id','sheet','brand','category','code','name','stockDate','status','shortage'].some(k=>typeof r[k]!=='string')||!Array.isArray(r.warnings)||r.warnings.some(w=>typeof w!=='string')||!Number.isFinite(r.usage)||![r.stock,r.average,r.suggested].every(v=>v===null||Number.isFinite(v)))throw Error('訂貨品項資料不完整');}}
 for(const d of Object.values(s.drafts)){if(!d?.snapshot?.options||!d.quantities||typeof d.quantities!=='object'||!Array.isArray(d.legacy))throw Error('草稿格式錯誤');periodDays(d.snapshot.options.start,d.snapshot.options.end,d.snapshot.options.ignore);rows(d.snapshot.rows);}
 const ids=new Set();for(const o of s.orders){if(o?.kind!=='tcm-purchase-order'||o.version!==2||typeof o.id!=='string'||ids.has(o.id)||typeof o.actor!=='string'||typeof o.status!=='string'||!o.options)throw Error('確認紀錄格式錯誤');ids.add(o.id);periodDays(o.options.start,o.options.end,o.options.ignore);rows(o.lines);if(o.lines.some(r=>!Number.isInteger(r.quantity)||r.quantity<=0||r.quantity>100000))throw Error('確認訂量無效');}return s;
}
