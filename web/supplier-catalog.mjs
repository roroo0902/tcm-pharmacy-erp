import {runDirect} from './direct-sync.mjs?v=release20261120r1';
import {SHEET_ID,parseSheet} from './sheets-data.mjs';

// Registration, receipt, order and daily loss screens use the server's enabled supplier registry.
export function parseSupplierCatalog(data){
 if(!Array.isArray(data?.sources)||!data.sources.length)throw Error('尚無已啟用的廠商分類');
 const ids=new Set(),groups=new Set();
 const rows=data.sources.flatMap(source=>{
  const group=source.brand+'|'+source.category;
  if(!source.name||!source.brand||!['單方','複方'].includes(source.category)||!Number.isInteger(source.gid)||ids.has(source.gid)||groups.has(group))throw Error('廠商來源設定不完整或重複');
  ids.add(source.gid);groups.add(group);
  const grid=data.sheets?.[source.name];if(!Array.isArray(grid))throw Error('來源缺少 '+source.name);
  const values=grid.map(row=>row.map(value=>String(value??'')));
  const manual=values[0]?.indexOf('廠商品號（補登）')??-1;
  const initial=values[0]?.indexOf('建檔廠商品號')??-1;
  let column='';
  for(let n=manual+1;n>0;n=Math.floor((n-1)/26))column=String.fromCharCode(65+(n-1)%26)+column;
  return parseSheet(values,source).map(row=>{
   const fields=values[row.row-1];
   return {...row,vendorCode:(fields[manual]||fields[initial]||'').trim(),
    vendorCell:column?'https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/edit#gid='+source.gid+'&range='+column+row.row:'',
    weekly:data.weekly?.[source.name]?.[row.code]??null};
  });
 });
 return {sources:data.sources,rows,sheets:data.sheets};
}
export async function loadSupplierCatalog(){return parseSupplierCatalog(await runDirect('readOrderCatalog'));}
export async function loadReceiptCatalog(){return loadSupplierCatalog();}
export async function loadOrderGridCatalog(){return parseSupplierCatalog(await runDirect('readOrderCatalog',{orderGrid:true}));}
export function supplierSelection(sources,brand,category){
 const brands=[...new Set(sources.map(s=>s.brand))];
 if(!brands.includes(brand))brand=brands[0]||'';
 const categories=sources.filter(s=>s.brand===brand).map(s=>s.category);
 if(!categories.includes(category))category=categories[0]||'';
 return {brands,categories,brand,category,source:sources.find(s=>s.brand===brand&&s.category===category)};
}

// Share only in-flight reads; a later refresh always reads Google again.
export function createSupplierLoader(read=loadSupplierCatalog,timeoutMs=60000){let pending;return ()=>{
 if(!pending){
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('讀取逾時，已填數量仍保留，請重新讀取')),timeoutMs);});
  pending=Promise.race([Promise.resolve().then(read),timeout]).finally(()=>{clearTimeout(timer);pending=undefined;});
 }
 return pending;
};}
