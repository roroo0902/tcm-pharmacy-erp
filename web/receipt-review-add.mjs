import {priceCents} from './receipt-pricing.mjs';
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

export function appendReceiptSelection(draft,rows,brand,category,name,code,quantity,price,makeCode=()=>`AUTO-${crypto.randomUUID()}`){
 const group=rows.filter(r=>r.brand===brand&&r.category===category),text=name.trim(),entered=code.trim();
 if(!group.length||!text)throw Error('請選擇廠商、類別並填入藥品名稱');
 const matches=group.filter(r=>r.drug===text||`${r.drug}（${r.code}）`===text);
 if(matches.length){
  const selected=entered?matches.filter(r=>r.code===entered):matches;
  if(selected.length!==1)throw Error('藥品名稱或編號不一致，請核對後再加入');
  return appendReceiptItem(draft,rows,receiptKey(selected[0]),quantity,price);
 }
 const itemCode=entered||makeCode();
 if(group.some(r=>r.code===itemCode)||draft.lines.some(l=>l.sheet===group[0].name&&(l.code===itemCode||l.name===text)))throw Error('藥品編號或名稱已存在');
 const unitPriceCents=priceCents(price),line={sheet:group[0].name,code:itemCode,name:text,quantity:Number(quantity),create:true,...(unitPriceCents===undefined?{}:{unitPriceCents})};
 const lines=[...draft.lines,line],priced=lines.some(l=>l.unitPriceCents!==undefined);
 return cloudDraft({...draft,lines,version:priced?2:1,...(priced?{currency:'TWD'}:{})});
}

export const receiptAddMarkup=`<details class="review-add-disclosure"><summary><span class="review-add-symbol" aria-hidden="true"></span>新增本次品項</summary><fieldset class="review-add" disabled aria-label="新增本次品項"><div class="review-add-fields"><label>廠商<select data-add-brand><option value="">請選擇廠商</option></select></label><label>類別<select data-add-category disabled><option value="">請選擇類別</option></select></label></div><label>藥品名稱<input data-add-name list="receipt-add-names" maxlength="120" autocomplete="off" disabled><datalist id="receipt-add-names"></datalist></label><label>藥品編號（選填）<input data-add-code maxlength="60" autocomplete="off" placeholder="新品項留白時自動產生"></label><div class="review-add-fields"><label>單價（元／瓶）<span class="review-add-unit"><input data-add-price type="number" min="0" max="1000000" step="0.01" inputmode="decimal"><span>元</span></span></label><label>訂貨量<span class="review-add-unit"><input data-add-qty type="number" min="1" max="1000000" step="1" inputmode="numeric"><span>瓶</span></span></label></div><button type="button" data-add-submit>＋ 加入品項</button><p data-add-message role="status">選擇廠商與類別，再輸入或選擇藥品名稱；加入後重新核對，確認後才入帳。</p></fieldset></details>`;

export function receiptNameMatch(rows,brand,category,value){
 const text=value.trim();
 const matches=rows.filter(r=>r.brand===brand&&r.category===category&&(r.drug===text||`${r.drug}（${r.code}）`===text));
 if(matches.length!==1)throw Error(matches.length?'同名藥品不只一筆，請選擇含編號的藥品名稱':'找不到此廠商與類別的藥品，請先完成藥品建檔');
 return matches[0];
}

export function bindReceiptAdd(root,rows,readDraft,onAdd){
 const disclosure=root.querySelector('.review-add-disclosure'),fields=disclosure.querySelector('fieldset');
 disclosure.addEventListener('toggle',()=>{fields.disabled=!disclosure.open;});
 const brand=root.querySelector('[data-add-brand]'),category=root.querySelector('[data-add-category]'),name=root.querySelector('[data-add-name]'),code=root.querySelector('[data-add-code]'),names=root.querySelector('#receipt-add-names'),qty=root.querySelector('[data-add-qty]'),price=root.querySelector('[data-add-price]'),message=root.querySelector('[data-add-message]'),button=root.querySelector('[data-add-submit]');
 [...new Set(rows.map(r=>r.brand).filter(Boolean))].forEach(b=>brand.add(new Option(b,b)));
 const clearItem=()=>{name.value='';code.value='';price.value='';names.replaceChildren();message.textContent='加入後會重新核對最新庫存與金額。';};
 brand.onchange=()=>{
  clearItem();category.replaceChildren(new Option('請選擇類別',''));category.disabled=!brand.value;name.disabled=true;
  [...new Set(rows.filter(r=>r.brand===brand.value).map(r=>r.category))].forEach(c=>category.add(new Option(c,c)));
 };
 category.onchange=()=>{
  clearItem();name.disabled=!category.value;
  rows.filter(r=>r.brand===brand.value&&r.category===category.value).forEach(r=>names.append(new Option(r.code,`${r.drug}（${r.code}）`)));
 };
 name.oninput=()=>{
  price.value='';code.value='';
  try{const row=receiptNameMatch(rows,brand.value,category.value,name.value);code.value=row.code;price.value=row.unitPriceCents===undefined?'':String(row.unitPriceCents/100);message.textContent=row.priceWarning||`${row.code} ${row.drug}，加入後重新核對。`;}
  catch(e){message.textContent=name.value?'新藥品可填編號或留白自動產生；確認入帳時才建立，期初庫存為 0 瓶。':'請輸入或選擇藥品名稱';}
 };
 button.onclick=async()=>{
  try{
   if(!brand.value||!category.value||!name.value.trim())throw Error('請選擇廠商、類別並填入藥品名稱');
   const next=appendReceiptSelection(readDraft(),rows,brand.value,category.value,name.value,code.value,qty.value,price.value);
   button.disabled=true;await onAdd(next);
  }catch(e){message.textContent=e.message;button.disabled=false;}
 };
}
