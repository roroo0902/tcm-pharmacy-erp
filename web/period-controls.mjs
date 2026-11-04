import {runDirect} from './direct-sync.mjs';
import {lossPeriod} from '../src/loss-period.mjs';
import {today} from './store.mjs';
export const periodControls=`<style>
.period-controls{padding:18px;border:1px solid #c6c9bc;border-radius:8px;margin:18px 0}.period-controls legend{font-weight:bold}.period-controls .period-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0}.period-controls button{min-height:44px}.period-controls button[aria-pressed=true]{background:#223d60;color:#fff4d7;outline:2px solid #d5b472}.period-controls input{max-width:150px;font-size:16px}.period-result{padding:18px;background:#edf3ee;border-left:4px solid #456c60;border-radius:6px;margin:16px 0}.period-result h3{margin:0 0 8px}.period-result strong{display:block;font-size:18px}.period-result p{margin:8px 0}.period-result[data-stale=true]{background:#fff3d9;border-color:#b28736}.period-controls [hidden]{display:none!important}.period-more{margin-top:14px}.period-more summary{cursor:pointer;min-height:44px;padding:10px 0}.period-preview{font-weight:bold}.period-controls .period-custom-label{max-width:180px}@media(max-width:760px){.period-controls{padding:12px}.period-controls .period-row{gap:8px}.period-controls .period-row button{flex:1 1 42%;padding:10px 8px}.period-controls #period-apply{width:100%}.period-result strong{font-size:16px}.period-result{padding:14px}.period-controls label{max-width:100%}}
</style><fieldset class="period-controls"><legend>① 選擇統計期間</legend><div class="period-row" role="group" aria-label="統計天數">${[3,5,7].map(n=>`<button type="button" class="secondary" data-period-days="${n}">近 ${n} 天</button>`).join('')}<button type="button" class="secondary" id="period-custom">自訂</button></div><label class="period-custom-label" id="period-custom-label" hidden>自訂天數<input id="period-days" type="number" inputmode="numeric" min="1" max="3660" step="1" value="3"></label><div class="period-row" role="group" aria-label="統計截止"><button type="button" class="secondary" data-period-cutoff="false">截至昨天</button><button type="button" class="secondary" data-period-cutoff="true">包含今天</button></div><input id="period-today" type="checkbox" hidden><p id="period-preview" class="period-preview"></p><p class="muted">按連續日曆日統計，包含週日；此區不套用批次訂貨工作台的排除日期。</p><button type="button" id="period-apply">更新耗損統計</button><p id="period-state" role="status">正在讀取共用預設…</p><details class="period-more"><summary>更多設定</summary><p>共用預設會影響其他使用者下次開啟時的期間。</p><button type="button" class="secondary" id="period-default">儲存為共用預設</button><button type="button" class="secondary" id="period-refresh">讀取共用預設</button></details></fieldset><section class="period-result" aria-label="目前統計結果" id="period-result"><h3>② 目前統計結果</h3><strong id="period-result-range">尚未取得統計結果</strong><p id="period-result-state" role="status"></p><p id="period-coverage"></p><p id="period-result-time" class="muted"></p><p id="period-today-warning" class="muted"></p><p class="muted">表格的平均與建議量須全期間完成登錄才顯示；建議量採備貨 7 天＋運送 0.5 天，扣除目前庫存後向上取整瓶。可至「批次訂貨、建議量與舊草稿」調整備貨參數。</p></section>`;
export function mountPeriodControls(root,{onData,ask}){
 const $=s=>root.querySelector(s);let alive=true,seq=0,current=null,custom=false,dirty=false,busy=false;
 const input=()=>{const p=lossPeriod({days:$('#period-days').value,includeToday:$('#period-today').checked},today());return {days:p.days,includeToday:p.includeToday};};
 function preview(){
  const n=Number($('#period-days').value),t=$('#period-today').checked;
  root.querySelectorAll('[data-period-days]').forEach(b=>b.setAttribute('aria-pressed',String(!custom&&Number(b.dataset.periodDays)===n)));
  root.querySelectorAll('[data-period-cutoff]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.periodCutoff==='true')===t)));
  $('#period-custom').setAttribute('aria-pressed',String(custom));$('#period-custom-label').hidden=!custom;
  try{const p=lossPeriod(input(),today());$('#period-preview').textContent=`預計查詢：${p.start} ～ ${p.end}（${p.days} 天）`;}catch(e){$('#period-preview').textContent=e.message;}
 }
 function stale(text){$('#period-result').dataset.stale=String(!!current);$('#period-result-state').textContent=current?text+'；下方仍為上次成功結果。':'尚無結果，請更新統計。';}
 function edit(){seq++;busy=false;dirty=true;$('#period-apply').disabled=false;$('#period-apply').textContent='更新耗損統計';preview();$('#period-state').textContent='期間已修改，請更新統計。';stale('期間尚未套用');}
 function fields(p){$('#period-days').value=p.days;$('#period-today').checked=p.includeToday;custom=![3,5,7].includes(p.days);preview();}
 async function read(request,{preserveSelection=false}={}){
  const ticket=++seq;busy=true;$('#period-apply').disabled=true;$('#period-apply').textContent='更新中…';$('#period-state').textContent='正在讀取每日耗損…';stale('正在更新');
  try{const data=await runDirect('readLossPeriod',request);if(!alive||ticket!==seq)return;
   onData(data);current=data;if(!preserveSelection){fields(data.period);dirty=false;}
   const p=data.period;$('#period-result-range').textContent=`${p.start} ～ ${p.end}｜${p.includeToday?'包含今天':'截至昨天'}`;
   $('#period-coverage').textContent=`期間共 ${p.days} 天 · 排除 0 天 · 平均計算分母 ${p.days} 天（須全部完成登錄）`;
   $('#period-result-time').textContent='更新時間：'+new Date(data.readAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'});
   $('#period-today-warning').textContent=p.includeToday?'今日尚未結束，平均值可能偏低。':'';
   $('#period-result').dataset.stale=String(dirty);$('#period-result-state').textContent=dirty?'選擇期間尚未套用；下方為目前已更新的結果。':'已更新，表格使用以上期間。';$('#period-state').textContent=dirty?'期間已修改，請更新統計。':'統計已更新。';
  }catch(e){if(alive&&ticket===seq){$('#period-state').textContent='更新失敗：'+e.message;stale('更新失敗');}}
  finally{if(alive&&ticket===seq){busy=false;$('#period-apply').disabled=false;$('#period-apply').textContent='更新耗損統計';}}
 }
 root.querySelectorAll('[data-period-days]').forEach(b=>b.onclick=()=>{custom=false;$('#period-days').value=b.dataset.periodDays;edit();});
 root.querySelectorAll('[data-period-cutoff]').forEach(b=>b.onclick=()=>{$('#period-today').checked=b.dataset.periodCutoff==='true';edit();});
 $('#period-custom').onclick=()=>{custom=true;edit();$('#period-days').focus();};$('#period-days').oninput=edit;
 $('#period-apply').onclick=()=>{try{read(input());}catch(e){$('#period-state').textContent=e.message;}};
 $('#period-refresh').onclick=()=>read(null);
 $('#period-default').onclick=()=>{try{const p=input();ask(`<p>將共用預設設為近 ${p.days} 天（${p.includeToday?'含':'不含'}今天）。其他使用者下次讀取預設時也會套用。</p>`,async()=>{try{await runDirect('saveLossPeriodSettings',p);await read(null);}catch(e){if(alive)$('#period-state').textContent='設定結果待確認：'+e.message;}},'儲存共用預設');}catch(e){$('#period-state').textContent=e.message;}};
 preview();read(null);return {refresh:()=>{if(busy)return;return read(current?{days:current.period.days,includeToday:current.period.includeToday}:null,{preserveSelection:dirty});},dispose:()=>{alive=false;seq++;}};
}
