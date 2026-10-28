// HTML-service transport. The web app remains MYSELF and checks the existing owner gate.
function erpHosted(operation,input,token){
 loss3Actor_();
 if(operation==='prepareLoss')return lossV3PrepareDate(input);
 if(operation==='preview'&&input&&input.kind==='tcm-loss-cumulative')return lossV3Preview(input);
 return erpDirect(operation,input,token);
}
