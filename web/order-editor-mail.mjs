import {openMailProgress} from './mail-progress.mjs';

export async function sendEditorOrder(options){
 const locks=globalThis.navigator?.locks;
 if(!locks)return sendWithPreview(options);
 return locks.request('tcm-order-editor-mail',{ifAvailable:true},lock=>{
  if(!lock)throw Error('另一個分頁正在寄送訂單，請稍後查看寄送紀錄。');
  return sendWithPreview(options);
 });
}

async function sendWithPreview({id,draft,recipient,rpc,gate,isOpen,onLeave,status}){
 const keys=[...new Set([id,...draft.mergeIds])];
 const attempt=gate.begin(keys,gate.snapshot(keys));
 if(!attempt)throw Error('這筆訂單正在寄送或結果待核對，請先確認寄送紀錄。');
 let started=false,progress;
 try{
  const preview=await rpc('erpOrderPdfMailPreview',{id,draft,row:recipient.row,test:false});
  if(!isOpen())return;
  if(preview.row!==recipient.row||preview.name!==recipient.name||preview.email!==recipient.email)
   throw Error('員工名冊已更新，請返回並重新選擇收件員工。');
  if(preview.previousState==='sent'||preview.state==='sent')throw Error('相同訂單內容已寄給這位員工，請查看寄送紀錄。');
  if(preview.state!=='ready'||['sending','uncertain'].includes(preview.previousState))throw Error('上次寄送結果待確認，請先查收信件。');
  if(!preview.mailEnabled||!preview.token)throw Error('尚未取得寄信授權，請核對寄送設定。');
  progress=openMailProgress({name:recipient.name,files:preview.files,onLeave});
  status('寄送中…');
  started=true;
  const result=await rpc('erpOrderPdfMailSend',preview.token);
  if(result?.state!=='sent')throw Error('寄送結果待核對');
  gate.settle(attempt,'sent');
  if(isOpen()){status(result.message||'已交付 Google 寄送。');progress.success();}
  return true;
 }catch(error){
  if(started){
   gate.settle(attempt,'uncertain');
   const message='寄送結果待確認，請先查收信件，避免重寄。';
   if(isOpen())progress?.failure(message);
   throw Error(message);
  }
  throw error;
 }finally{
  if(!started)gate.settle(attempt,'not-started');
 }
}
