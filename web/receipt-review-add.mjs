import {receiptKey,receiptLines} from './receive-grid-data.mjs';
import {cloudDraft} from '../src/cloud-transaction.mjs';

export function appendReceiptItem(draft,rows,key,quantity,price){
 if(draft.kind!=='tcm-cloud'||draft.action!=='進貨')throw Error('僅支援進貨新增品項');
 const [line]=receiptLines(rows,new Map([[key,String(quantity)]]),new Map([[key,price]]));
 if(!line)throw Error('請選擇品項並填入數量');
 if(draft.lines.some(l=>l.sheet===line.sheet&&l.code===line.code))throw Error('此品項已在清單，請直接修改原有數量');
 const lines=[...draft.lines,line],priced=lines.some(l=>l.unitPriceCents!==undefined);
 return cloudDraft({...draft,lines,version:priced?2:1,...(priced?{currency:'TWD'}:{})});
}

export const receiptAddMarkup=`<fieldset class="review-add"><legend>新增本次進貨品項</legend><label>搜尋藥名、編號或廠商<input type="search" data-add-search placeholder="輸入關鍵字"></label><label>選擇已建檔品項<select data-add-item><option value="">請選擇品項</option></select></label><div class="review-add-fields"><label>進貨數量（瓶）<input data-add-qty type="number" min="1" max="1000000" step="1" inputmode="numeric" value="1"></label><label>單價（元／瓶）<input data-add-price type="number" min="0" max="1000000" step="0.01" inputmode="decimal" placeholder="未提供"></label></div><button type="button" data-add-submit>＋ 加入並重新核對</button><p data-add-message role="status">加入已建檔品項後會重新預覽，確認後才入帳。</p></fieldset>`;

export function bindReceiptAdd(root,rows,readDraft,onAdd){
 const search=root.querySelector('[data-add-search]'),select=root.querySelector('[data-add-item]'),qty=root.querySelector('[data-add-qty]'),price=root.querySelector('[data-add-price]'),message=root.querySelector('[data-add-message]'),button=root.querySelector('[data-add-submit]');
 const draw=()=>{
  const query=search.value.trim().toLowerCase(),draft=readDraft();
  select.replaceChildren(new Option('請選擇品項',''));
  rows.filter(r=>`${r.name} ${r.code} ${r.drug}`.toLowerCase().includes(query)&&!draft.lines.some(l=>l.sheet===r.name&&l.code===r.code)).forEach(r=>select.add(new Option(`${r.name}｜${r.code} ${r.drug}`,receiptKey(r))));
  price.value='';
 };
 search.oninput=()=>{try{draw();}catch(e){message.textContent=e.message;}};
 select.onchange=()=>{const row=rows.find(r=>receiptKey(r)===select.value);price.value=row?.unitPriceCents===undefined?'':String(row.unitPriceCents/100);message.textContent=row?.priceWarning||'加入後會重新核對最新庫存與金額。';};
 button.onclick=async()=>{
  try{
   if(!select.value)throw Error('請先選擇要新增的品項');
   const next=appendReceiptItem(readDraft(),rows,select.value,qty.value,price.value);
   button.disabled=true;await onAdd(next);
  }catch(e){message.textContent=e.message;button.disabled=false;}
 };
 draw();
}
