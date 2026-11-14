import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
const origin='https://roroo0902.github.io/tcm-pharmacy-erp/';
const result=await build({entryPoints:['web/app.mjs'],bundle:true,write:false,format:'iife',target:'es2022',minify:true,charset:'utf8'});
let js=result.outputFiles[0].text.replaceAll('./web/assets/',origin+'web/assets/');
let html=await readFile('index.html','utf8');
await writeFile('web/hosted-app.js',js);
html=html.replace(/<script type="module"[^>]*><\/script>/,()=>'<script src="'+origin+'web/hosted-app.js?v=lossedit20261114"></script>');
for(const path of ['web/style.css','web/quest-theme.css','web/mobile.css']){
 const css=(await readFile(path,'utf8')).replace(/url\((['"]?)(?!data:|https:)([^)'"\s]+)\1\)/g,(_,q,url)=>'url("'+new URL(url,origin+path).href+'")');
 html=html.replace(new RegExp('<link rel="stylesheet" href="\\./'+path.replaceAll('.','\\.')+'[^\"]*">'),()=>'<style>'+css+'</style>');
}
html=html.replaceAll('./web/assets/',origin+'web/assets/');
const planningCompat=await readFile('web/planning-compat.js','utf8');
html=html.replace('</body>','<script>'+planningCompat.replaceAll('</script','<\\/script')+'</script></body>');
const wordAxisSource=(await readFile('web/order-word-axis.mjs','utf8')).replace('export function','function');
const wordAxisInline='<script>(()=>{'+wordAxisSource+';let previous=null,stop=()=>{};const root=document.querySelector("#content");const attach=()=>{const table=root.querySelector("#order-grid,#loss-table");if(table===previous)return;stop();previous=table;stop=table?alignOrderWord(table):()=>{};};new MutationObserver(attach).observe(root,{childList:true,subtree:true});attach();})();</script>';
html=html.replace('</body>',()=>wordAxisInline+'</body>');
await writeFile('gas/cloud/App.html',html);
console.log('Built authenticated hosted app:',Buffer.byteLength(html),'bytes');

