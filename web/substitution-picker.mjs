export function substitutionChoices(rows,brand='',category=''){
 const valid=rows.filter(r=>r.code&&!r.warning?.includes('編號'));
 return {brands:[...new Set(rows.map(r=>r.brand))],categories:[...new Set(rows.filter(r=>r.brand===brand).map(r=>r.category))],items:valid.filter(r=>r.brand===brand&&r.category===category)};
}
export function substitutionPicker(name,label,esc){return `<fieldset class="sub-picker" data-picker="${name}"><legend>${label}</legend><label>${label} 廠商<select data-pick-brand aria-label="${label} 廠商" required><option value="">請選擇廠商</option></select></label><label>${label} 類別<select data-pick-category aria-label="${label} 類別" required disabled><option value="">請先選擇廠商</option></select></label><label>${label} 藥品<select name="${name}" aria-label="${label} 藥品" required disabled><option value="">請先選擇類別</option></select></label><small data-pick-status role="status"></small></fieldset>`;}
export function mountSubstitutionPicker(root,rows,initial,esc){
 const brand=root.querySelector('[data-pick-brand]'),category=root.querySelector('[data-pick-category]'),drug=root.querySelector('select[name]'),status=root.querySelector('[data-pick-status]');
 const value=r=>r.name+'|'+r.code,original=initial&&rows.find(r=>r.name===initial.sheet&&r.code===initial.code&&r.drug===initial.name);
 const options=(list,placeholder)=>'<option value="">'+placeholder+'</option>'+list.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
 brand.innerHTML=options(substitutionChoices(rows).brands,'請選擇廠商');
 function renderItems(selected=''){const items=substitutionChoices(rows,brand.value,category.value).items;drug.innerHTML='<option value="">'+(!category.value?'請先選擇類別':items.length?'請選擇藥品':'此分類沒有可選藥品')+'</option>'+items.map(r=>`<option value="${esc(value(r))}">${esc(r.code+' '+r.drug)}（${r.bottles??'待核對'}瓶）</option>`).join('');drug.disabled=!category.value;drug.value=selected;status.textContent=category.value?items.length+' 項可選藥品':'';}
 function renderCategories(selected=''){category.innerHTML=options(substitutionChoices(rows,brand.value).categories,brand.value?'請選擇單方／複方':'請先選擇廠商');category.disabled=!brand.value;category.value=selected;renderItems();}
 brand.onchange=()=>renderCategories();category.onchange=()=>renderItems();
 if(original){brand.value=original.brand;renderCategories(original.category);renderItems(value(original));if(!drug.value)status.textContent='原品項目前待核對，請重新選擇有效藥品。';}else if(initial)status.textContent='原品項已變更或不在目前藥品來源，請重新選擇。';
}

