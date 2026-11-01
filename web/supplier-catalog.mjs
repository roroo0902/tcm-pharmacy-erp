import {runDirect} from './direct-sync.mjs';
import {parseSheet} from './sheets-data.mjs';

// Registration, receipt, order and daily loss screens use the server's enabled supplier registry.
export function parseSupplierCatalog(data){
 if(!Array.isArray(data?.sources)||!data.sources.length)throw Error('尚無已啟用的廠商分類');
 const ids=new Set(),groups=new Set();
 const rows=data.sources.flatMap(source=>{
  const group=source.brand+'|'+source.category;
  if(!source.name||!source.brand||!['單方','複方'].includes(source.category)||!Number.isInteger(source.gid)||ids.has(source.gid)||groups.has(group))throw Error('廠商來源設定不完整或重複');
  ids.add(source.gid);groups.add(group);
  const grid=data.sheets?.[source.name];if(!Array.isArray(grid))throw Error('來源缺少 '+source.name);
  const csv=grid.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\n');
  return parseSheet(csv,source).map(row=>({...row,weekly:data.weekly?.[source.name]?.[row.code]??null}));
 });
 return {sources:data.sources,rows,sheets:data.sheets};
}
export async function loadSupplierCatalog(){return parseSupplierCatalog(await runDirect('readOrderCatalog'));}
export function supplierSelection(sources,brand,category){
 const brands=[...new Set(sources.map(s=>s.brand))];
 if(!brands.includes(brand))brand=brands[0]||'';
 const categories=sources.filter(s=>s.brand===brand).map(s=>s.category);
 if(!categories.includes(category))category=categories[0]||'';
 return {brands,categories,brand,category,source:sources.find(s=>s.brand===brand&&s.category===category)};
}

// Share only in-flight reads; a later refresh always reads Google again.
export function createSupplierLoader(read=loadSupplierCatalog){let pending;return ()=>{if(!pending)pending=Promise.resolve().then(read).finally(()=>{pending=undefined;});return pending;};}
