import {DIRECT} from './direct-config.mjs';
export const hostedEnabled=()=>!!globalThis.google?.script?.run;
export const directEnabled=()=>hostedEnabled()||(DIRECT.enabled&&!!DIRECT.clientId&&!!DIRECT.deploymentId);
const scopes=['https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/script.container.ui','https://www.googleapis.com/auth/userinfo.email'];
let token='',expires=0,client,signing;
let snapshotRequest,writing=false,reviewSequence=0;
export const directPollMs=()=>DIRECT.pollMs;
export function setupDirect(){
 if(!directEnabled())return;
 if(hostedEnabled()){
  document.querySelector('.notice').textContent='Google Sheets 為正式庫存；在本頁預覽並確認後直接入帳，完成後自動讀回。訂貨不增加庫存。';
  document.querySelector('.sidefoot small').textContent='Google 已登入・站內確認後直接同步';
  return;
 }
 const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
 document.head.append(script);
 const button=document.createElement('button');button.id='google-connect';button.textContent='登入 Google 同步';
 const notice=document.querySelector('.notice');notice.textContent='Google Sheets 為唯一正式庫存；在站內核對後按「確認入帳」直接同步。訂貨不增加庫存。';notice.append(button);
 const foot=document.querySelector('.sidefoot small');if(foot)foot.textContent='正式帳務儲存於 Google Sheets；站內核對後直接同步';
 button.onclick=()=>authorize().then(()=>{button.textContent='Google 已連線';window.dispatchEvent(new Event('erp-synced'));}).catch(e=>{button.textContent=e.message;});
}
export function authorize(){
 if(hostedEnabled())return Promise.resolve();
 if(token&&Date.now()<expires)return Promise.resolve();
 if(signing)return signing;
 if(!directEnabled())return Promise.reject(Error('站內同步尚未完成部署設定'));
 if(!globalThis.google?.accounts?.oauth2)return Promise.reject(Error('Google 登入元件尚未載入，請稍後重試'));
 signing=new Promise((resolve,reject)=>{
  const fail=e=>{signing=null;reject(Error(e.error_description||e.message||'Google 登入未完成'));};
  client=google.accounts.oauth2.initTokenClient({client_id:DIRECT.clientId,scope:scopes.join(' '),callback:r=>{
   if(r.error)return fail(r);
   if(!google.accounts.oauth2.hasGrantedAllScopes(r,...scopes))return fail({message:'尚未授權所有必要權限'});
   token=r.access_token;expires=Date.now()+(Number(r.expires_in)-60)*1000;signing=null;resolve();
  },error_callback:fail});client.requestAccessToken({prompt:''});
 });return signing;
}
export async function runDirect(operation,draft,previewToken){
 if(hostedEnabled()){
  const call=(op)=>new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(Error(e.message||'同步失敗，請重新核對同一筆資料'))).erpHosted(op,draft??null,previewToken??null));
  // Separate executions avoid SpreadsheetApp stale caches after adding a date column.
  if(operation==='preview'&&draft?.kind==='tcm-loss-cumulative')await call('prepareLoss');
  return call(operation);
 }
 if(!token||Date.now()>=expires)throw Error('請先點「登入 Google 同步」重新連線；輸入仍保留');
 if(operation==='preview'&&draft?.kind==='tcm-loss-cumulative')await runDirect('prepareLoss',draft);
 const response=await fetch('https://script.googleapis.com/v1/scripts/'+encodeURIComponent(DIRECT.deploymentId)+':run',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({function:'erpDirect',parameters:[operation,draft??null,previewToken??null],devMode:false})
 });
 if(response.status===401){token='';expires=0;}
 const result=await response.json();
 if(!response.ok||result.error)throw Error(result.error?.details?.[0]?.errorMessage||result.error?.message||'同步失敗；請以同一交易重新核對，勿重複建立');
 if(!result.done||!result.response||!Object.hasOwn(result.response,'result'))throw Error('結果未明，請以同一交易重新核對');
 return result.response.result;
}
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function directReview(draft,ask,onSuccess,status){
 if(writing){status('上一筆仍在入帳，請稍候');return;}
 const sequence=++reviewSequence;
 try{
  await authorize();status('正在讀取最新雲端資料…');
  const reviewed=JSON.parse(JSON.stringify(draft));
  const preview=await runDirect('preview',reviewed);
  if(sequence!==reviewSequence)return;
  const lines=preview.lines.map(l=>`<tr><td>${escape(l.sheet)} ${escape(l.code)} ${escape(l.name)}</td><td>${escape(l.quantity??l.total)}</td><td>${escape(l.before)}</td><td>${escape(l.after??l.stockAfter)}</td></tr>`).join('');
  const loss=reviewed.kind==='tcm-loss-cumulative';
  ask(`<p>${escape(reviewed.date)} · ${escape(reviewed.actor)}</p><p>${loss?'當日累計以差額入帳；原值欄為已登錄累計。':'請核對數量與庫存。訂貨不增加庫存。'}</p><div class="tablewrap"><table class="direct-review-table"><thead><tr><th>藥品</th><th>${loss?'新累計':'數量'}</th><th>${loss?'原累計':'原庫存'}</th><th>入帳後庫存</th></tr></thead><tbody>${lines}</tbody></table></div>${loss?'<p>'+preview.lines.map(l=>escape(l.code)+'：本次差額 '+escape(l.delta)+' 罐').join('；')+'</p>':''}`,
   async()=>{if(writing)return;writing=true;const controls=[...document.querySelectorAll('#content input,#content select,#content button')].map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);status('正在入帳與讀回核對，請勿重複送出…');try{
    const result=await runDirect('commit',reviewed,preview.token);
    if(loss){
     const check=await runDirect('preview',reviewed);
     if(check.lines.some(l=>l.delta!==0))throw Error('入帳後資料又有變動，請重新核對累計，不要另建重送');
     result.lines=check.lines;
    }
    // Invalidate in-flight snapshots so a post-write read cannot reuse older data.
    snapshotRequest=null;
    await onSuccess(result);status([result.message||'已同步 Google Sheets',result.warning].filter(Boolean).join('；'));window.dispatchEvent(new Event('erp-synced'));
    const updates=(result.lines||preview.lines).map(l=>'<tr><td>'+escape(l.sheet)+' '+escape(l.code)+' '+escape(l.name)+'</td><td>'+escape(l.quantity??l.total)+'</td><td>'+escape(l.after??l.stockAfter)+'</td></tr>').join('');
    ask('<h3>同步完成・工作表已讀回核對</h3><p>'+escape(result.message||'已完成')+'</p><div class="tablewrap"><table class="direct-review-table"><thead><tr><th>品項</th><th>本次數量／累計</th><th>目前庫存</th></tr></thead><tbody>'+updates+'</tbody></table></div><p>'+escape(result.id||'')+'</p>',()=>{},'完成');
   }catch(e){status(e.message+'；請重新預覽同一筆資料，輸入仍保留。');}finally{writing=false;controls.forEach(([el,disabled])=>{if(el.isConnected)el.disabled=disabled;});}},'確認入帳');
 }catch(e){status(e.message);}
}
export async function directSheet(source,signal){
 // Parallel consumers share one request, without keeping stale stock between refreshes.
 if(!snapshotRequest){const request=runDirect('readAll');snapshotRequest=request;request.finally(()=>{if(snapshotRequest===request)snapshotRequest=null;}).catch(()=>{});}
 const r=await snapshotRequest,values=r.sheets[source.name];
 if(!values)throw Error('來源缺少 '+source.name);
 if(signal?.aborted)throw Error('已取消讀取');
 return csvResponse(values);
}
export async function directLog(log){return csvResponse((await runDirect('readLog',{log})).values);}
function csvResponse(values){return new Response(values.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n'),{headers:{'Content-Type':'text/csv'}});}
