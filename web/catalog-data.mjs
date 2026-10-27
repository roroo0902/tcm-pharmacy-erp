export function checkCatalog(records){
 if(!Array.isArray(records)||records.length>5000)throw Error('名冊格式錯誤或超過5000筆');
 const ids=new Set(),sources=new Set();
 for(const r of records){
  for(const key of ['id','name','brand','sourceKey'])if(typeof r[key]!=='string'||!r[key].trim()||r[key].length>300)throw Error('名冊識別、藥名、廠牌或來源資料不完整');
  if(typeof r.code!=='string'||!['單方','複方','其他'].includes(r.category)||!Array.isArray(r.warnings)||r.warnings.some(w=>typeof w!=='string'))throw Error('名冊類別或核對事項格式錯誤');
  if(r.referenceBottles!==null&&(!Number.isFinite(r.referenceBottles)||r.referenceBottles<0))throw Error('來源參考瓶數格式錯誤');
  if(typeof r.stockDate!=='string')throw Error('來源日期格式錯誤');
  if(ids.has(r.id)||sources.has(r.sourceKey))throw Error('名冊來源識別重複');ids.add(r.id);sources.add(r.sourceKey);
 }
}
export function mergeCatalog(data,file){
 if(file?.kind!=='tcm-catalog'||file.version!==1)throw Error('請選擇藥品名冊匯入檔');
 checkCatalog(file.records);
 const next=structuredClone(data);next.catalog??=[];
 for(const r of file.records){const found=next.catalog.find(x=>x.id===r.id||x.sourceKey===r.sourceKey);if(found){if(JSON.stringify(found)!==JSON.stringify(r))throw Error('來源已存在但內容不同，請先核對，未覆蓋名冊');continue;}if(next.items.some(i=>i.id===r.id))throw Error('名冊ID與現有建帳品項衝突');next.catalog.push(structuredClone(r));}
 checkCatalog(next.catalog);return next;
}
