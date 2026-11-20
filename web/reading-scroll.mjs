// Reading overlays retain modal protection against edits and duplicate submissions.
export function allowReadingScroll(dialog,win){
 const move=(x,y)=>win.scrollBy({left:x,top:y,behavior:'instant'});
 const wheel=e=>{
  if(e.ctrlKey)return; // Preserve browser pinch/zoom.
  e.preventDefault();
  const unit=e.deltaMode===1?16:e.deltaMode===2?win.innerHeight:1;
  move(e.deltaX*unit,e.deltaY*unit);
 };
 let touch;
 const start=e=>{touch=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;};
 const drag=e=>{
  if(!touch||e.touches.length!==1){touch=null;return;}
  const next={x:e.touches[0].clientX,y:e.touches[0].clientY};
  e.preventDefault();move(touch.x-next.x,touch.y-next.y);touch=next;
 };
 const end=()=>{touch=null;};
 const key=e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const steps={ArrowDown:40,ArrowUp:-40,PageDown:win.innerHeight*.85,PageUp:-win.innerHeight*.85,' ':win.innerHeight*.85*(e.shiftKey?-1:1)};
  if(Object.hasOwn(steps,e.key)){e.preventDefault();move(0,steps[e.key]);}
 };
 const listeners=[['wheel',wheel,{passive:false}],['touchstart',start,{passive:true}],['touchmove',drag,{passive:false}],['touchend',end],['touchcancel',end],['keydown',key]];
 for(const [name,fn,options] of listeners)dialog.addEventListener(name,fn,options);
 return ()=>{for(const [name,fn,options] of listeners)dialog.removeEventListener(name,fn,options);};
}
