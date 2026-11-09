export function alignOrderWord(table){
 if(table.dataset.wordAxis)return ()=>{};table.dataset.wordAxis='true';
 let frame=0;
 const update=()=>{frame=0;const heading=table.querySelector(table.id==='loss-table'?'[data-sort="code"]':'[data-og-sort="code"]');if(!heading)return;const text=[...heading.childNodes].find(n=>n.nodeType===3&&n.textContent.includes('藥品'));if(!text)return;const start=text.textContent.indexOf('藥品'),range=document.createRange();range.setStart(text,start);range.setEnd(text,start+2);const word=range.getBoundingClientRect(),box=heading.getBoundingClientRect();if(!box.width)return;const shift=(word.x+word.width/2-box.x-box.width/2)*heading.offsetWidth/box.width;table.style.setProperty('--order-word-shift',shift+'px');};
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
 const mutations=new MutationObserver(schedule);mutations.observe(table,{childList:true,characterData:true,subtree:true});
 const resize=new ResizeObserver(schedule);resize.observe(table);resize.observe(table.querySelector(table.id==='loss-table'?'[data-sort="code"]':'[data-og-sort="code"]'));schedule();
 return ()=>{mutations.disconnect();resize.disconnect();cancelAnimationFrame(frame);delete table.dataset.wordAxis;};
}
