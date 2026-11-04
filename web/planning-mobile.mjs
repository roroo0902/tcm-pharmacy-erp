// Mobile controls delegate to the existing sort buttons, preserving calculations.
export function installPlanningMobile(root){
 if(root.dataset.planningMobileInstalled)return;
 root.dataset.planningMobileInstalled='true';
 const names={code:'藥品編號',name:'藥品名稱',legacy:'原表訂量',quantity:'確認訂貨量',suggested:'新建議量',usage:'期間耗損',average:'每日平均耗損',stock:'未拆封瓶數',stockDate:'原表更新日期',shortage:'缺藥／缺藥率'};
 function update(){
  const table=root.querySelector('#order-table');if(!table)return;
  let bar=root.querySelector('.planning-mobile-sort');
  if(!bar){
   bar=document.createElement('div');bar.className='planning-mobile-sort';
   bar.innerHTML='<label for="planning-sort-key">排序</label><select id="planning-sort-key" aria-label="排序欄位">'+Object.entries(names).map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('')+'</select><button type="button" class="secondary" aria-label="切換排序方向">升冪 ↑</button>';
   table.before(bar);
   bar.querySelector('select').onchange=e=>table.querySelector('[data-order-sort="'+e.target.value+'"]').click();
   bar.querySelector('button').onclick=()=>table.querySelector('[data-order-sort="'+bar.querySelector('select').value+'"]').click();
  }
  bar.hidden=!table.querySelector('table');
  const active=Array.from(table.querySelectorAll('[data-order-sort]')).find(b=>/[↑↓]/.test(b.textContent));
  if(active){bar.querySelector('select').value=active.dataset.orderSort;const button=bar.querySelector('button'),label=active.textContent.includes('↓')?'降冪 ↓':'升冪 ↑';if(button.textContent!==label)button.textContent=label;}
  const section=table.closest('section');
  const paragraphs=Array.from(section.children).filter(e=>e.tagName==='P'&&(e.compareDocumentPosition(table)&Node.DOCUMENT_POSITION_FOLLOWING));
  if(!section.querySelector('.planning-mobile-help')&&paragraphs.length){
   const help=document.createElement('details');help.className='planning-mobile-help';
   const summary=document.createElement('summary');summary.textContent='計算與排序說明';help.append(summary);
   paragraphs.forEach(p=>{p.classList.add('planning-desktop-help');const copy=p.cloneNode(true);copy.removeAttribute('id');copy.classList.remove('planning-desktop-help');help.append(copy);});bar.before(help);
  }
 }
 new MutationObserver(update).observe(root,{childList:true,subtree:true});update();
}
