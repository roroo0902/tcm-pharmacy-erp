const pages={
 shortage:['SUPPLY WATCH / 補給追蹤','缺藥與替代管理','確認缺藥、安排補貨，追蹤每一筆到貨進度。'],
 cloud:['01 / WORLD INVENTORY','補給地圖','查看各廠牌的藥品庫存，為下一次補給做好準備。'],
 overview:['02 / SUPPLY CHEST','藥庫寶箱','直接同步 Google 工作表，掌握最新品項與庫存。'],
 orders:['03 / MERCHANT GUILD','商人公會','核對訂貨品項與瓶數，將待發送訂單存入 Google 工作表。'],
 receive:['04 / RESTOCK QUEST','補給入庫','選擇廠牌、核對到貨，在本頁確認後同步入庫。'],
 photoReceive:['04 / AI RESTOCK','智慧補給','拍照辨識進貨單，逐項核對既有藥名與庫存後再入帳。'],
 loss:['05 / DAILY JOURNAL','每日冒險紀錄','填寫當日累計耗損，在本頁核對入帳差額。'],
 history:['06 / ADVENTURE LOG','交易冒險誌','查閱每次進出庫，讓每一瓶藥品都有跡可循。'],
 items:['07 / APOTHECARY CODEX','藥品圖鑑','建立品項與實盤期初，整理你的藥庫收藏。'],
 backup:['08 / SAVE POINT','旅途存檔點','匯出本機備份，妥善保存這段藥庫紀錄。']
};
export function updateQuestTheme(page){
 const [chapter,subtitle,description]=pages[page]||pages.cloud;
 document.body.dataset.page=page;
 document.querySelector('#quest-chapter').textContent=chapter;
 document.querySelector('#quest-subtitle').textContent=subtitle;
 document.querySelector('#quest-description').textContent=description;
 document.querySelectorAll('nav a').forEach(a=>{if(a.hash==='#'+page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
}

// Keep the skip link from changing the application route.
document.querySelector('.skip-link')?.addEventListener('click', event=>{event.preventDefault();const content=document.querySelector('#content');content.focus();content.scrollIntoView({block:'start'});});

// Apply the current identity to both static pages and older Apps Script shells.
const brand = document.querySelector('.brand');
if (brand) {
 brand.setAttribute('aria-label', '瑞恩藥庫，前往庫存總覽');
 const label = brand.querySelector('span');
 if (label) label.innerHTML = '<b class="rpg-brand-name">瑞恩藥庫</b><small>ADVENTURER’S APOTHECARY</small>';
}
document.title = document.title.replace('本草藥庫', '瑞恩藥庫');
for (const el of document.querySelectorAll('.local, .footer-title')) {
 for (const node of el.childNodes) if (node.nodeType === 3) node.textContent = node.textContent.replaceAll('本草藥庫', '瑞恩藥庫');
}
const brandStyle = document.createElement('style');
brandStyle.textContent = `.brand .rpg-brand-name{display:block;font-family:"DFKai-SB","BiauKai","KaiTi","STKaiti","PMingLiU",serif;font-size:1.13em;font-weight:900;letter-spacing:2px;white-space:nowrap;line-height:1.3;color:#ffe3a0;text-shadow:1px 1px 0 #8c6231,2px 2px 0 #08172a,0 0 10px #d5b47235;-webkit-text-stroke:.25px #f9d68c}.brand small{text-shadow:none}`;
document.head.append(brandStyle);
