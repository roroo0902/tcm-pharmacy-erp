import {receiptExplanation} from '../src/receipt-explanation.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function operationResult(p,type,hiddenId=''){
 const loss=type==='loss',prefix=loss?'loss':'receipt',label=loss?'耗損':'進貨',d=loss?p?.draft:p;
 const empty=`<h3>最近${label}結果</h3><p>目前沒有待確認的${label}操作。</p>`;
 if(!p)return empty;
 const relevant=loss?d?.kind==='tcm-loss-cumulative':d?.action==='進貨';
 if(!relevant)return p.verified?empty:`<h3>其他操作尚待確認</h3><p>其他頁面有一筆操作尚未確認完成，請先查詢結果，避免重複送出。</p><button type="button" id="${prefix}-check">查詢待確認操作</button><a href="#history">查看交易紀錄</a>`;
 if(p.verified&&hiddenId===p.id)return empty;
 const heading=p.verified?(loss?'耗損累計已核對一致':'本次進貨已入庫，並完成核對'):`這筆${label}尚未確認完成`;
 const description=p.verified?(loss?'工作表當日累計與這筆填寫內容一致。累計量不是再次扣除的數量。':'本次進貨已寫入 Google Sheet，並已讀回確認入庫後庫存及本次提供的單價。'):'請先查詢同步結果；仍未完成時，可沿用這筆操作重新預覽，確認後才入帳。';
 const receipt=!loss&&p.verified?receiptExplanation(p.receiptEvent||d):null;
 const resultBody=receipt?`<p><strong>${esc(receipt.totalText)}</strong></p><div class="receipt-result-table"><table><thead><tr><th>廠商／藥品／編號</th><th>本次進貨</th><th>入庫前</th><th>入庫後</th><th>單價</th><th>小計</th></tr></thead><tbody>${receipt.lines.map(l=>`<tr><td>${esc(l.sheet)}<br>${esc(l.name)}／${esc(l.code)}</td><td>${esc(l.quantity)} 瓶</td><td>${esc(l.beforeText)}</td><td>${esc(l.afterText)}</td><td>${esc(l.priceText)}</td><td>${esc(l.amountText)}</td></tr>`).join('')}</tbody></table></div><p>入庫前後瓶數為本次交易當時的紀錄；後續進貨或耗損會影響目前庫存。</p>`:'';
 const time=p.receiptEvent?.time;
 const recordedTime=time&&!isNaN(Date.parse(time))?new Date(time).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'未記錄';
 return `<h3>${heading}</h3><p>${description}</p>${resultBody}<ul>${(receipt?[]:d.lines||[]).map(l=>`<li>${esc(l.sheet)}｜${esc(l.name)} ${esc(l.code)} · ${loss?'當日累計 '+esc(l.total)+' 瓶':'進貨 '+esc(l.quantity)+' 瓶'}</li>`).join('')}</ul><details><summary>${loss?'查看交易明細':'查看本次進貨紀錄'}</summary><p>日期：${esc(d.date)} · 經手人：${esc(d.actor)}</p><p>${loss?'操作識別碼（供重試）':'交易編號'}：${esc(p.id)}</p>${loss&&(d.note||d.reason)?`<p>備註：${esc(d.note||d.reason)}</p>`:''}${!loss?`<p>備註：${esc(d.note||'無')}</p><p>入帳時間：${esc(p.verified?recordedTime:'尚未確認')}</p><p>紀錄位置：藥庫_同步紀錄</p>`:''}</details><div class="actions"><button type="button" id="${prefix}-check">${p.verified?'重新核對同步結果':'查詢同步結果'}</button>${p.verified?`<button type="button" class="secondary" id="${prefix}-hide">隱藏此提示</button>`:`<button type="button" id="${prefix}-resume">重新確認這筆操作</button>${loss?'<button type="button" class="secondary" id="loss-edit">修改尚未確認累計</button>':`<button type="button" class="secondary" id="receipt-edit">修改尚未入帳內容</button>`}`}</div>`;
}

// Read-only reconciliation. Matching totals do not prove who posted an operation.
export function checkLossResult(draft,data){
 if(data?.date!==draft.date||!Array.isArray(data.loss))throw Error('耗損日期核對失敗，請稍後重新查詢');
 for(const line of draft.lines){
  const matches=data.loss.filter(x=>x.sheet===line.sheet&&x.code===line.code&&x.name===line.name);
  if(matches.length!==1||matches[0].error||!Number.isInteger(matches[0].posted))throw Error(line.name+'：目前無法核對已入帳累計，請重新讀取工作表');
  if(matches[0].posted!==line.total)throw Error(line.name+'：工作表累計 '+matches[0].posted+' 瓶，這筆填寫 '+line.total+' 瓶；尚未一致，請核對最新數字後再決定是否重試');
 }
 return true;
}
