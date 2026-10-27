import {InventoryLedger} from '../src/inventory.mjs';
import {checkCatalog} from './catalog-data.mjs';
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const empty=()=>({version:1,items:[],entries:[]});
export function validate(data){
 if(!data||data.version!==1||!Array.isArray(data.items)||!Array.isArray(data.entries)||data.items.length>5000||data.entries.length>50000)throw Error('備份格式不符或超過試用容量');
 const ledger=new InventoryLedger({today});
 if(data.catalog!==undefined)checkCatalog(data.catalog);
 const ids=new Set();
 for(const i of data.items){if(typeof i.category!=='string'||typeof i.code!=='string'||!Number.isFinite(i.safety)||i.safety<0)throw Error('藥品資料不完整');ledger.register(i);}
 for(const e of data.entries){if(ids.has(e.id))throw Error('重複交易ID');ids.add(e.id);if(e.reverses){const original=data.entries.find(x=>x.id===e.reverses);if(!original||e.type!=='沖銷'||e.itemId!==original.itemId||e.bottles!==original.bottles)throw Error('沖銷資料與原交易不符');ledger.reverse(e.reverses,{id:e.id,date:e.date,actor:e.actor,reason:e.note});}else ledger.post(e);}
 return ledger;
}
export function addItem(data,item){const next=structuredClone(data);next.items.push(item);validate(next);return next;}
export function addEntry(data,entry){const next=structuredClone(data);next.entries.push(entry);validate(next);return next;}
