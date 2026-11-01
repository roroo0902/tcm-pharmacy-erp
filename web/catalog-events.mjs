const KEY='tcm-supplier-catalog-change-v1',EVENT='supplier-catalog-changed';
// A timestamp-only signal; drug and transaction data stay in Google Sheets.
export function notifySupplierCatalogChanged(target=window,storage=localStorage){
 try{storage.setItem(KEY,`${Date.now()}-${Math.random()}`);}catch{}
 target.dispatchEvent(new Event(EVENT));
}
export function watchSupplierCatalog(callback,target=window){
 const local=()=>callback(),remote=e=>{if(e.key===KEY&&e.newValue)callback();};
 target.addEventListener(EVENT,local);target.addEventListener('storage',remote);
 return ()=>{target.removeEventListener(EVENT,local);target.removeEventListener('storage',remote);};
}
