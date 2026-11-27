// Working inputs belong to this tab; only reviewed slips are shared between tabs.
const prefix='tcm-loss-form-v1:';
export function readLossForm(storage,day){
 const draft={quantities:new Map(),prices:new Map(),rows:new Map(),reason:'',reasonKind:''};
 const raw=storage?.getItem(prefix+day);
 if(!raw)return draft;
 const saved=JSON.parse(raw);
 for(const item of saved.items){
  const {id,name,code,drug,quantity,price}=item;
  if(typeof id!=='string'||typeof name!=='string'||typeof code!=='string'||typeof drug!=='string')continue;
  if(typeof quantity==='string'&&quantity!=='')draft.quantities.set(id,quantity);
  if(typeof price==='string')draft.prices.set(id,price);
  if(draft.quantities.has(id)||draft.prices.has(id))draft.rows.set(id,{id,name,code,drug});
 }
 draft.reason=typeof saved.reason==='string'?saved.reason:'';
 draft.reasonKind=typeof saved.reasonKind==='string'?saved.reasonKind:'';
 return draft;
}
export function writeLossForm(storage,day,draft){
 if(!storage)return;
 if(!draft.rows.size&&!draft.reason&&!draft.reasonKind){
  storage.removeItem(prefix+day);
  return;
 }
 const items=Array.from(draft.rows,([id,{name,code,drug}])=>({
  id,name,code,drug,quantity:draft.quantities.get(id),price:draft.prices.get(id)
 }));
 storage.setItem(prefix+day,JSON.stringify({items,reason:draft.reason,reasonKind:draft.reasonKind}));
}
