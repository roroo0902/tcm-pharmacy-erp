// HTML-service transport. The web app remains MYSELF and checks the existing owner gate.
function erpHosted(operation,input,token){
 loss3Actor_();
 // HtmlService may reorder object keys between RPC calls. Keep the draft hash stable.
 input=erpHostedCanonical_(input);
 if(operation==='prepareLoss')return lossV3PrepareDate(input);
 if(operation==='preview'&&input&&input.kind==='tcm-loss-cumulative')return lossV3Preview(input);
 return erpDirect(operation,input,token);
}
function erpHostedCanonical_(value){
 if(Array.isArray(value))return value.map(erpHostedCanonical_);
 if(value&&typeof value==='object'){const out={};Object.keys(value).sort().forEach(key=>out[key]=erpHostedCanonical_(value[key]));return out;}
 return value;
}
