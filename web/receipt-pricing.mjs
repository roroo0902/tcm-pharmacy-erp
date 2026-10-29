// Keep money in integer cents; blank is unknown, zero is an explicit free item.
export function priceCents(value){
 const text=String(value??'').trim();if(!text)return undefined;
 if(!/^\d+(?:\.\d{1,2})?$/.test(text))throw Error('單價須為0或正數，最多兩位小數');
 const [whole,fraction='']=text.split('.');const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(cents)||cents>100000000)throw Error('單價不可超過1,000,000元');return cents;
}
export const money=cents=>'NT$ '+(cents/100).toLocaleString('zh-TW',{minimumFractionDigits:0,maximumFractionDigits:2});
export function sheetPrice(value){
 const raw=String(value??'').trim();if(!raw)return {};
 const m=raw.match(/^(?:NT\$|NTD|TWD|\$)?\s*(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?$/i);
 try{if(!m)throw Error();return {unitPriceCents:priceCents(m[1].replaceAll(',','')+(m[2]||''))};}
 catch{return {priceWarning:'E欄價格格式待核對',priceRaw:raw};}
}
export function pricingTotal(lines){
 let cents=0,missing=0;
 for(const l of lines){if(l.unitPriceCents===undefined){missing++;continue;}cents+=l.unitPriceCents*l.quantity;}
 if(!Number.isSafeInteger(cents))throw Error('金額超出可精確計算範圍');return {cents,missing};
}
