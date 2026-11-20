// One document, all currently open or recreated order-mail panels. No backend cancellation.
export function createMailSendGate(){
 const states=new Map();
 const current=keys=>keys.map(key=>states.get(key));
 const blocked=keys=>{const marks=current(keys);return marks.some(x=>x?.state==='pending')?'pending':marks.some(x=>x?.state==='uncertain')?'uncertain':'';};
 return {snapshot:current,blocked,
  begin(keys,snapshot){if(blocked(keys)||current(keys).some((value,i)=>value!==snapshot[i]))return null;const mark={state:'pending'};for(const key of keys)states.set(key,mark);return mark;},
  settle(mark,state){if(mark.state==='pending')mark.state=state;}
 };
}
