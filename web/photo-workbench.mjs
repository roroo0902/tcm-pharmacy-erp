const styles = `
#photo-receive-panel{--ai-navy:#19364e;--ai-gold:#b28c43;--ai-line:#d8cfb7;color:var(--ai-navy);background:#fffdf5;text-align:left}
#photo-receive-panel *{box-sizing:border-box}
#photo-receive-panel [hidden]{display:none!important}
#photo-receive-panel h3.ai-plaque{display:inline-flex;align-items:center;gap:.55em;margin:0;padding:7px 16px;background:var(--ai-navy);color:#fff9e7;border:4px double #dab967;border-radius:5px;line-height:1.25}
#photo-receive-panel h2.ai-plaque{display:inline-flex;align-items:center;gap:10px;margin:0;padding:8px 17px;color:#fff2cb;background:#19354c;border:4px double #cea35a;border-radius:7px;box-shadow:0 2px 0 #685233;font-family:Georgia,"PMingLiU",serif;letter-spacing:.07em}
#photo-receive-panel h2.ai-plaque::before{display:none}
#photo-receive-panel h2.ai-plaque svg{width:28px;height:26px;flex:none;fill:#efc76e}
#photo-receive-panel .ai-steps{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;list-style:none;margin:14px 0;padding:0}
.ai-steps li{display:flex;align-items:center;gap:12px;font-size:14px}
.ai-steps li+li:before{content:'→';color:#94805c}
.ai-steps li span{border:1px solid #d4c49f;border-radius:3px;padding:3px 8px}
.ai-steps [aria-current=step] span{background:#1e3c54;border-color:#d3ae60;color:white}
#ai-status{background:#e6efe8;border-left:3px solid #547969;padding:8px 12px;margin:10px 0}
#photo-receive-panel .ai-suppliers,.ai-tools,.ai-foot{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px}
#photo-receive-panel #ai-source{margin:0}
#ai-source [aria-pressed=true]{background:#e8c371;color:#21364b;border-color:#9e7732}
#ai-source [aria-pressed=true]:before{content:'✓ '}.ai-suppliers{margin:12px 0}
.ai-workspace{display:grid;grid-template-columns:minmax(190px,23%) minmax(0,1fr);gap:14px;align-items:start}
.ai-pane{border:1px solid var(--ai-line);background:#fffef9;border-radius:5px;padding:clamp(10px,1vw,16px);min-width:0}
#photo-receive-panel .ai-pane h3,#photo-receive-panel .ai-list-title{margin:0 0 12px;font-size:18px}
.ai-photo-stage{display:grid;place-items:center;background:#f2eddf;border:1px dashed #c9b88f;border-radius:3px;min-height:130px;margin:10px 0;color:#74664b}
#ai-original{display:block;width:100%;max-height:310px;object-fit:contain}
.ai-tools{margin:8px 0}.ai-hint{display:block;overflow-wrap:anywhere}
#photo-receive-panel .ai-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(145px,100%),1fr));gap:8px 14px}
#photo-receive-panel label{min-width:0}
#photo-receive-panel .ai-fields label{margin:0}
#photo-receive-panel .ai-fields :is(select,input){width:100%;min-width:0}
.ai-review-note{font-size:13px}.ai-review-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px}
#photo-receive-panel .ai-review-head h3{margin:0}.ai-review-head img{object-fit:contain;image-rendering:pixelated}
[data-ai-review-count]{border:1px solid #bda465;border-radius:5px;padding:5px 9px;font-size:14px;font-weight:600}
#photo-receive-panel .ai-review-wrap,#photo-receive-panel .ai-basket-wrap{overflow:auto;max-width:100%}
#photo-receive-panel .ai-table{width:100%;border-collapse:collapse;font-size:14px;color:#22394a;white-space:normal}
#photo-receive-panel .ai-table th{background:#ede7d5;color:#20384b;text-align:left;white-space:nowrap}
#photo-receive-panel .ai-table :is(td,th){padding:7px;border-bottom:1px solid #ddd7c6;vertical-align:middle}
#photo-receive-panel .ai-table tr:nth-child(even) td{background:#f8f6ec}
#photo-receive-panel .ai-table small{display:block;color:#646f70;font-size:12px}
#photo-receive-panel .ai-table details{font-size:12px}
#photo-receive-panel .ai-table summary{cursor:pointer}
#photo-receive-panel .ai-review-match,#photo-receive-panel [data-picker]{display:grid;gap:4px;min-width:0}
#photo-receive-panel [data-picker]>:is(input,select),#photo-receive-panel [data-registration] :is(input,select){width:100%;min-width:0;max-width:100%}
#photo-receive-panel .ai-review-match{min-width:145px}
#photo-receive-panel .ai-table .quantity-stepper{width:110px;grid-template-columns:26px minmax(44px,1fr) 26px;gap:3px}
#photo-receive-panel .quantity-stepper .quantity-clear{display:none}
#photo-receive-panel .quantity-adjust{min-width:24px;padding:2px}
#photo-receive-panel .ai-table [data-photo-price]{width:90px;max-width:100%}
#photo-receive-panel [data-reviewed]{width:20px;height:20px;accent-color:#245640}
#photo-receive-panel .ai-foot{justify-content:flex-end;margin-top:12px}
#photo-receive-panel .ai-list{margin-top:14px}
#photo-receive-panel .ai-primary{color:#fff9df;background:#1c3952;border:3px double #d6b56c}
#photo-receive-panel .ai-review-table th{background:#203b53;color:#fff9e7}
#photo-receive-panel .ai-review-table td{overflow-wrap:anywhere}
#photo-receive-panel .ai-review-table tr:has([data-reviewed]:checked) td{background:#eaf2e7}
#photo-receive-panel .ai-review-table tr[data-unmatched] td:first-child{box-shadow:inset 3px 0 #c3892b;padding-left:10px}
.ai-unmatched{display:inline-block;padding:2px 8px;margin-bottom:5px;color:#70400b;background:#ffe5ae;border-radius:4px;font-size:13px}
.ai-match-tools,.ai-review-actions{display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px;margin-top:5px}
.ai-match-tools details[open]{flex-basis:100%}
#photo-receive-panel .ai-match-tools summary{color:#254e6b;text-decoration:underline}
#photo-receive-panel .ai-review-actions label{display:inline-flex;align-items:center;gap:5px;margin:0;white-space:nowrap}
#photo-receive-panel [data-receipt-category]{width:auto;max-width:100%;justify-self:start}
@media(min-width:761px){.ai-review-table th:nth-child(1){width:24%}.ai-review-table th:nth-child(2){width:38%}}
@media(max-width:1150px){.ai-workspace{grid-template-columns:1fr}.ai-photo-stage{min-height:80px}#ai-original{max-height:215px}}
@media(max-width:760px){
 #photo-receive-panel h2.ai-plaque{padding:6px 9px;font-size:18px}
 #photo-receive-panel .ai-steps{gap:5px}.ai-steps li{font-size:12px;gap:4px}.ai-steps li span{padding:3px 5px}
 #photo-receive-panel .ai-workspace{grid-template-columns:minmax(0,1fr)}
 #photo-receive-panel .ai-table,#photo-receive-panel .ai-table tbody{display:block;min-width:0}
 #photo-receive-panel .ai-table thead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
 #photo-receive-panel .ai-table tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;border:1px solid #d6cbb2;border-radius:5px;background:#fffaf0;padding:12px;margin-bottom:8px}
 #photo-receive-panel .ai-table tr td{display:block;min-width:0;padding:0;border:0;background:transparent;overflow-wrap:anywhere}
 #photo-receive-panel .ai-table td:before{display:block;content:attr(data-label);font-size:12px;color:#655b47;margin-bottom:3px}
 #photo-receive-panel .ai-table td[data-wide]{grid-column:1/-1}
 #photo-receive-panel .ai-review-match{min-width:0}
 #photo-receive-panel .ai-review-table tr:has([data-reviewed]:checked){background:#eaf2e7}
 #photo-receive-panel .ai-review-table tr[data-unmatched]{border-left:3px solid #c3892b}
 #photo-receive-panel .ai-review-table tr[data-unmatched] td:first-child{box-shadow:none;padding-left:0}
 #photo-receive-panel .ai-review-actions{justify-content:space-between}
 #photo-receive-panel .ai-foot button{flex:1}
}
`;

export function photoWorkbench(date){
 const steps=['選廠商','拍照','AI 解析','人工核對','預覽','確認入庫'];
 return `<style>${styles}</style><section class="panel" id="photo-receive-panel">
 <h2 class="ai-plaque"><svg viewBox="0 0 24 20" aria-hidden="true"><path fill-rule="evenodd" d="M2 4h5l2-3h6l2 3h5v14H2zm10 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/></svg>AI 拍照進貨</h2>
 <ol class="ai-steps" aria-label="進貨流程">${steps.map((s,i)=>`<li data-ai-step="${i}"><span>${s}</span></li>`).join('')}</ol>
 <p id="ai-status" role="status">正在讀取廠商與藥品名冊…</p>
 <div class="ai-suppliers"><strong id="ai-source-label">廠商</strong><div id="ai-source" class="order-tabs" role="group" aria-labelledby="ai-source-label"></div><button type="button" class="secondary" id="ai-reload">更新現有藥品</button></div>
 <div class="ai-workspace"><section class="ai-pane"><h3>單據照片</h3><div class="ai-photo-stage"><span id="ai-photo-empty">尚未選擇照片</span><img id="ai-original" hidden alt="本張進貨原照片"></div>
 <div class="ai-tools"><button type="button" class="secondary" id="ai-camera">拍照</button><button type="button" class="secondary" id="ai-choose">選擇照片</button></div>
 <input hidden id="ai-image" type="file" accept="image/*"><small tabindex="0" id="ai-image-hint" class="ai-hint">也可選取此欄位後貼上圖片。</small>
 <div class="ai-tools"><button id="ai-scan" type="button">AI 解析照片</button><button type="button" class="secondary" id="ai-reset-photo" hidden>清除本張照片</button></div></section>
 <section class="ai-pane"><header class="ai-review-head"><h3 class="ai-plaque"><img src="./web/assets/loss-lookup.png" width="32" height="28" alt="">人工核對藥品</h3><span data-ai-review-count role="status" hidden></span></header><div class="ai-fields"><label>經手人<select id="ai-actor" data-staff data-staff-compact required disabled><option value="">正在讀取員工名冊…</option></select></label>
 <label>進貨日期<input type="date" id="ai-date" max="${date}" value="${date}"></label>
 <label>單據或備註（選填）<select id="ai-note"><option value="">不填寫備註</option><option>依送貨單進貨</option><option>補填入送到貨單</option><option>無附進貨單直接入庫</option><option>換貨補回</option><option>其他</option></select></label></div>
 <div id="ai-note-other-field" hidden><label for="ai-note-other">其他說明（選填）</label><input type="text" id="ai-note-other" maxlength="490"><button type="button" class="secondary" id="ai-note-back">返回上一個選項</button></div>
 <div id="ai-result" tabindex="-1"></div><div class="ai-foot"><button type="button" id="ai-add" disabled>核對後加入進貨清單</button></div></section></div>
 <section class="ai-pane ai-list"><h3 class="ai-list-title">本次進貨清單（尚未入庫）</h3><div id="ai-basket"></div><div class="ai-foot"><strong id="ai-total"></strong><button type="button" class="ai-primary" id="ai-preview" disabled>預覽進貨</button></div></section><section id="ai-pending"></section></section>`;
}
