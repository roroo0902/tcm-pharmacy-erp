export function itemRegistration(source,code,name,value,rows){
 if(!source?.name)throw Error('請先讀取並選擇廠商與類別');
 code=String(code).trim();name=String(name).trim();
 if(!code||!name)throw Error('藥品編號與名稱必填');
 if(rows.some(r=>r.name===source.name&&(r.code===code||r.drug===name)))throw Error('此廠商與類別已有相同編號或藥名，請先核對');
 const quantity=Number(value);if(String(value).trim()===''||!Number.isInteger(quantity)||quantity<0||quantity>1000000)throw Error('期初瓶數須為 0 至 1,000,000 的整數');
 return {sheet:source.name,code,name,quantity};
}
