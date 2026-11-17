// PDF-only revisions. This module never creates inventory or order transactions.
export function orderPdfSeed(plans){
 return {rows:plans.flatMap(p=>p.items.map(l=>({key:l.sheet+'|'+l.code,brand:p.brand,category:l.sheet.slice(p.brand.length),code:l.code,name:l.name,quantity:l.quantity,manual:false}))),brands:[...new Set([...plans.map(p=>p.brand),'科達','天明','富田'])]};
}
export function reviseOrderPdf(plans,draft){
 const seed=orderPdfSeed(plans);if(!draft||!Array.isArray(draft.rows)||draft.rows.length>1000)throw Error('PDF 草稿格式不符或超過 1000 列');
 const originals=new Map(seed.rows.map(r=>[r.key,r])),used=new Set(),names=new Set(),rows=[];
 for(const input of draft.rows){
  if(!input||typeof input!=='object')throw Error('PDF 品項格式不符');
  let row;
  if(input.manual===true){const name=String(input.name??'').trim();if(!name&&(input.quantity===''||input.quantity===null||input.quantity===undefined))continue;
   if(!name||name.length>120||/[\r\n\u0000-\u001f]/.test(name))throw Error('手動品項請填入 1 至 120 字的藥品名稱');
   if(!seed.brands.includes(input.brand)||!['單方','複方'].includes(input.category))throw Error(name+'：請選擇廠牌與單方／複方');
   row={brand:input.brand,category:input.category,code:'',name,manual:true};
  }else{const original=originals.get(input.key);if(!original||used.has(input.key))throw Error('原訂單品項無法核對或重複');used.add(input.key);row={...original};}
  const quantity=typeof input.quantity==='number'?input.quantity:(typeof input.quantity==='string'&&input.quantity.trim()!==''?Number(input.quantity):NaN);
  if(!Number.isInteger(quantity)||quantity<1||quantity>1000000)throw Error(row.name+'：數量須為 1 至 1000000 的整數；不寄送請按移除');
  const nameKey=[row.brand,row.category,row.name.normalize('NFKC').replace(/\s/g,'')].join('|');if(names.has(nameKey))throw Error(row.brand+' '+row.name+' 重複，請合併數量');names.add(nameKey);rows.push({...row,quantity});
 }
 if(!rows.length)throw Error('至少保留一項藥品才能產生 PDF');
 return seed.brands.flatMap(brand=>{const items=rows.filter(r=>r.brand===brand);if(!items.length)return [];const columns=[];
  for(const category of ['單方','複方']){const list=items.filter(r=>r.category===category);for(let i=0;i<list.length;i+=22){const chunk=list.slice(i,i+22);columns.push(['',category+'・藥品名稱',...chunk.map(r=>(r.manual?'[手動新增] ':'')+r.name)],['',plans[0].date.slice(5).replace('-','/')+'\n訂量',...chunk.map(r=>r.quantity)]);}}
  const values=Array.from({length:24},(_,i)=>columns.map(c=>c[i]??''));return [{...plans[0],brand,title:brand+'訂單列印版',count:items.length,values,items,edited:true}];
 });
}
