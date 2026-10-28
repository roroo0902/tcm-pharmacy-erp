// HTML-service transport. The web app remains MYSELF and checks the existing owner gate.
function erpHosted(operation,input,token){
 loss3Actor_();
 // HtmlService may reorder object keys between RPC calls. Keep the draft hash stable.
 input=erpHostedCanonical_(input);
 if(operation==='prepareLoss')return lossV3PrepareDate(input);
 if(input&&input.kind==='tcm-loss-cumulative'){
  const cache=CacheService.getUserCache(),serialized=JSON.stringify(input);
  if(operation==='preview'){
   const preview=lossV3Preview(serialized);
   cache.put('hosted-loss-'+preview.token,serialized,600);
   return preview;
  }
  if(operation==='commit'){
   const reviewed=cache.get('hosted-loss-'+token);
   if(!reviewed||reviewed!==serialized)throw Error('預覽已過期或內容已修改，請重新預覽');
   return lossV3Commit(reviewed,token);
  }
 }
 return erpDirect(operation,input,token);
}
function erpHostedCanonical_(value){
 if(Array.isArray(value))return value.map(erpHostedCanonical_);
 if(value&&typeof value==='object'){const out={};Object.keys(value).sort().forEach(key=>out[key]=erpHostedCanonical_(value[key]));return out;}
 return value;
}
