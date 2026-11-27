import {checkLossResult} from './operation-result.mjs';
import {lossDialogTheme} from './loss-dialog-theme.mjs';

function matched(draft){
 const {lines,completionSheets}=draft;
 const detail=lines.length===1?`本筆填寫 ${lines[0].total} 瓶，Google 累計也是 ${lines[0].total} 瓶。`:
  lines.length?`本筆 ${lines.length} 個品項的填寫數量，逐項與 Google 當日累計一致。`:'';
 return {state:'success',title:'核對一致',detail:detail+(completionSheets?.length?'正常品項完成狀態也已核對一致。':'')};
}

// Compare the entire snapshot, including edits that reuse an operation ID.
export function createLossResultCheck({readRecord,writeRecord,readCloud,begin,blocked,disposed,report,changed,withSlipLock=callback=>callback(),timeoutMs=60000}){
 let checking=false;
 return async()=>{
  if(checking||blocked()||disposed())return;
  checking=true;
  let screen,timer,outcome,context;
  try{
   const record=readRecord(),snapshot=JSON.stringify(record);
   if(!record)throw Error('找不到待核對操作，請重新整理本頁。');
   const draft=record.draft;
   const sheets=new Set([...draft.lines.map(line=>line.sheet),...(draft.completionSheets||[])]);
   context=[draft.date.replaceAll('-','/'),...sheets].join(' · ');
   if(record.phase==='draft'){
    report({state:'pending',title:'本筆為未送出草稿',detail:'草稿仍在待處理清單，可稍後繼續核對。',context});
    return;
   }
   screen=begin(draft);
   try{
    const data=await Promise.race([readCloud(draft),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('查詢逾時，請稍後再試。')),timeoutMs);})]);
    if(disposed())return;
    checkLossResult(draft,data);
    outcome=matched(draft);
   }catch(e){
    if(disposed())return;
    if(e.code==='LOSS_NOT_SYNCED'){
     outcome=e.line?{state:'pending',title:'數量不同',detail:`${draft.lines.length>1?e.line.sheet+'／'+e.line.name+'（'+e.line.code+'）：':''}本筆填寫 ${e.line.total} 瓶，Google 目前累計 ${e.posted} 瓶。請先查看當日耗損紀錄。`}
      :{state:'pending',title:'完成狀態待核對',detail:e.message};
    }else{
     if(JSON.stringify(readRecord())!==snapshot)throw Error('待核對耗損單已變更或移除，這次查詢結果未套用。');
     outcome=e.code==='LOSS_INVALID_RESULT'?{state:'error',title:'無法核對累計',detail:e.message}:{state:'error',title:'查詢失敗',detail:'暫時無法讀取 Google 工作表。這筆紀錄已保留，可稍後再核對。',reason:e.message};
    }
   }finally{clearTimeout(timer);}
   if(outcome.state!=='error'){
    await withSlipLock(()=>{
     if(disposed())return;
     if(JSON.stringify(readRecord())!==snapshot)throw Error('待核對耗損單已變更或移除，這次查詢結果未套用。');
     writeRecord({...record,verified:outcome.state==='success'});
    });
    if(!disposed())changed();
   }
  }catch(e){outcome={state:'error',title:'無法完成核對',detail:e.message||'請重新查看待處理清單。'};}
  finally{clearTimeout(timer);screen?.close();checking=false;}
  if(!disposed()&&outcome)report({...outcome,context});
 };
}

export function showLossCheckResult({state,title,detail,context,reason}){
 const previous=document.activeElement,dialog=document.createElement('dialog');
 const element=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 const icon=src=>{const img=element('img');img.src=src;img.alt='';return img;};
 dialog.id='loss-check-result';dialog.dataset.state=state;
 dialog.setAttribute('aria-labelledby','loss-check-heading');
 dialog.setAttribute('aria-describedby','loss-check-detail');
 const style=element('style',lossDialogTheme),header=element('header');
 header.append(icon('./web/assets/loss-ledger.png'),element('b','每日耗損'));
 const summary=element('section');summary.className='loss-outcome';
 const heading=element('h2',title);heading.id='loss-check-heading';
 const labels=element('div');labels.append(heading);
 if(context){const meta=element('p',context);meta.className='loss-context';labels.append(meta);}
 const icons={success:'./web/assets/loss-match.png',pending:'./web/assets/loss-difference.png',error:'./web/assets/loss-unavailable.png'};
 summary.append(icon(icons[state]),labels);
 const body=element('p',detail);body.id='loss-check-detail';
 dialog.append(style,header,summary,body);
 if(reason){
  const details=element('details');details.append(element('summary','查看原因'),element('p',reason));dialog.append(details);
 }
 const close=element('button','關閉');close.type='button';close.autofocus=true;close.onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus();},{once:true});
 dialog.append(close);document.body.append(dialog);dialog.showModal();
}
