import {supplierCache} from './recent-read.mjs';
const WRITE_KEY='tcm-supplier-catalog-write-v1';
globalThis.window?.addEventListener?.('storage',event=>{
 if(event.key===WRITE_KEY||event.key===KEY)supplierCache.clear();
});
export function markCatalogWrite(){
 supplierCache.clear();
 try{localStorage.setItem(WRITE_KEY,`${Date.now()}-${Math.random()}`);}catch{}
}
const KEY='tcm-supplier-catalog-change-v1',EVENT='supplier-catalog-changed';
// A timestamp-only signal; drug and transaction data stay in Google Sheets.
export function notifySupplierCatalogChanged(target=window,storage=localStorage){
 supplierCache.clear();
 try{storage.setItem(KEY,`${Date.now()}-${Math.random()}`);}catch{}
 target.dispatchEvent(new Event(EVENT));
}
export function watchSupplierCatalog(callback,target=window){
 const local=()=>callback(),remote=e=>{if(e.key===KEY&&e.newValue)callback();};
 target.addEventListener(EVENT,local);target.addEventListener('storage',remote);
 return ()=>{target.removeEventListener(EVENT,local);target.removeEventListener('storage',remote);};
}
