const maxBottles=1000000;
const manualShortageLabel='（手動登錄缺藥）';

function nameKey(row){
 return [row.brand,row.category,String(row.name||'').normalize('NFKC').replace(/\s/g,'')].join('|');
}

function addPickedRow(lines,originals,add){
 if(!add.code&&!add.search&&(add.quantity===''||add.quantity==null))return;
 const quantity=Number(add.quantity);
 if(!add.code||!add.name||!['單方','複方'].includes(add.category)||!Number.isInteger(quantity)||quantity<1||quantity>maxBottles){
  throw Error('請選擇藥品並填寫 1 至 1000000 的整數瓶數，或移除未完成的列。');
 }
 const key=add.brand+add.category+'|'+add.code;
 let target=lines.find(row=>row.key===key);
 if(!target){
  const original=originals.find(row=>row.key===key);
  target=original?{...original,quantity:0}:{manual:true,key,brand:add.brand,category:add.category,name:add.name+'（'+add.code+'）',quantity:0};
  lines.push(target);
 }
 const before=Number(target.quantity);
 if(target.quantity===''||!Number.isInteger(before)||before<0)throw Error('請核對原訂單瓶數');
 if(before+quantity>maxBottles)throw Error(add.name+'：合計超過 1000000 瓶，請核對數量。');
 target.quantity=before+quantity;
}

// This is an output copy. Editable rows and source quantities must survive repeated previews.
export function prepareOrderOutputDraft(snapshot,source){
 const lines=snapshot.rows.filter(row=>!row.catalog&&!row.shortage).map(row=>({...row}));
 const knownNames=new Set(lines.filter(row=>row.name).map(nameKey));
 for(const row of snapshot.rows.filter(row=>row.catalog)){
  addPickedRow(lines,source.rows,row);
  if(row.code)knownNames.add(nameKey(row));
 }
 for(const row of snapshot.rows.filter(row=>row.shortage&&!row.catalog)){
  const name=String(row.name||'').trim();
  if(!name&&(row.quantity===''||row.quantity==null))continue;
  const quantity=Number(row.quantity);
  if(!name||!['單方','複方'].includes(row.category)||!Number.isInteger(quantity)||quantity<1||quantity>maxBottles){
   throw Error('自行登錄缺藥品項請填妥類別、藥名與 1 至 1000000 的整數瓶數。');
  }
  if(knownNames.has(nameKey(row))){
   throw Error(row.brand+row.category+'「'+name+'」已有同名品項。請核對藥品後，在原列調整瓶數並移除重複列。');
  }
  knownNames.add(nameKey(row));
  if((name+manualShortageLabel).length>120)throw Error('手動登錄缺藥的藥名過長，請縮短藥名。');
  lines.push({brand:row.brand,category:row.category,name:name+manualShortageLabel,quantity,manual:true});
 }
 return {...snapshot,rows:lines};
}
