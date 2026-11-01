const collator=new Intl.Collator('zh-TW',{numeric:true,sensitivity:'base'});
export const ORDER_COLUMNS=[['code','藥品／編號'],['legacy','原表訂量<br>僅對照'],['quantity','確認訂貨量'],['suggested','新建議量'],['usage','期間耗損<br>已填合計'],['average','每日平均耗損<br>瓶／日'],['stock','未拆封瓶數'],['stockDate','原表更新欄'],['shortage','缺藥／缺藥率']];
function numeric(v){if(v===null||v===undefined)return null;const s=String(v).trim().replaceAll(',','');return /^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s)&&Number.isFinite(Number(s))?Number(s):null;}
export function orderDateKey(v,referenceDate){
 const m=String(v??'').trim().match(/^(?:(\d{4})[\/.-])?(\d{1,2})[\/.-](\d{1,2})$/);if(!m)return null;
 const year=m[1]?Number(m[1]):Number(String(referenceDate??'').slice(0,4));if(!Number.isInteger(year)||year<1000)return null;
 const month=Number(m[2]),day=Number(m[3]),d=new Date(Date.UTC(year,month-1,day));return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day?+d:null;
}
function shortageKey(r){const s=String(r.shortage??'').trim(),n=numeric(s.replace(/[%％]$/,''));if(n!==null)return /[%％]$/.test(s)?n:n*100;return String(r.status??'').trim()?101:null;}
export function sortOrderRows(rows,key='code',direction='asc',{quantities={},legacy=new Map(),referenceDate}={}){
 const value=r=>key==='code'||key==='name'?(String(r[key]??'').trim()||null):key==='legacy'?numeric(legacy.get(r.code)):key==='quantity'?numeric(quantities[r.id]):key==='stockDate'?orderDateKey(r.stockDate,referenceDate):key==='shortage'?shortageKey(r):numeric(r[key]);
 return [...rows].sort((a,b)=>{const x=value(a),y=value(b);if(x===null||y===null)return x===y?0:x===null?1:-1;const n=typeof x==='string'?collator.compare(x,y):x-y;return direction==='desc'?-n:n;});
}
