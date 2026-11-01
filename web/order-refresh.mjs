import {orderKey} from './order-grid-data.mjs';
// Preserve edits across a name correction only when the source/code remains unique.
export function reconcileOrderInputs(previous,next,quantities,prices){
 for(const old of previous){
  const key=orderKey(old);if(!quantities.has(key)&&!prices.has(key))continue;
  const same=r=>r.name===old.name&&r.code===old.code;
  const matches=next.filter(same);
  if(!old.code||previous.filter(same).length!==1||matches.length!==1)continue;
  const target=orderKey(matches[0]);if(target===key)continue;
  for(const map of [quantities,prices])if(map.has(key)&&!map.has(target)){map.set(target,map.get(key));map.delete(key);}
 }
}
