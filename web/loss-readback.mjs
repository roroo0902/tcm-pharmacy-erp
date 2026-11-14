import {parseSupplierCatalog} from './supplier-catalog.mjs';
export function verifiedLossCatalog(data,date){
 if(data?.date!==date||!Array.isArray(data.loss))throw Error('耗損日期核對失敗，請重新讀取');
 const catalog=parseSupplierCatalog(data),map=new Map();for(const x of data.loss){const key=JSON.stringify([x.sheet,x.code,x.row]);if(map.has(key))throw Error('耗損核對結果重複');map.set(key,x);}
 return {...catalog,rows:catalog.rows.map(r=>{const x=map.get(JSON.stringify([r.name,r.code,r.row]));if(!x||x.name!==r.drug)throw Error('品項位置變更，請重新讀取');return {...r,bottles:x.stock,posted:x.posted,postedError:x.error||''};}),readAt:data.readAt};
}
export function lossCalculation(value,row){
 if(value==null||value==='')return {delta:'—',after:'—',insufficient:false};
 const n=Number(value);if(!Number.isInteger(n)||n<0||n>1000000)return {delta:'數量無效',after:'—',insufficient:false};
 if(row.posted===null||row.bottles===null||row.postedError)return {delta:'無法核對',after:'待核對',insufficient:false};
 const delta=n-row.posted,after=row.bottles-delta;return {delta:delta===0?'不變':delta>0?'扣 '+delta+' 瓶':'加回 '+(-delta)+' 瓶',after:after+' 瓶',insufficient:after<0};
}

// Rapid supplier switches share one in-flight read of the same complete daily catalog.
export function createLossLoader(read){const pending=new Map();return date=>{if(!pending.has(date)){const p=Promise.resolve().then(()=>read(date)).finally(()=>pending.delete(date));pending.set(date,p);}return pending.get(date);};}

// Bound the wait so a stalled cloud read cannot leave the loading dialog open.
export function readLossWithTimeout(read,timeoutMs=60000){
 let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('讀取逾時')),timeoutMs);});
 return Promise.race([Promise.resolve().then(read),timeout]).finally(()=>clearTimeout(timer));
}
