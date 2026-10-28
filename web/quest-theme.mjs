const pages={
 cloud:['01 / WORLD INVENTORY','補給地圖','查看各廠牌的藥品庫存，為下一次補給做好準備。'],
 overview:['02 / SUPPLY CHEST','藥庫寶箱','掌握本機帳本的品項、庫存與每日進貨。'],
 orders:['03 / MERCHANT GUILD','商人公會','依耗損與庫存規劃訂貨，備妥每一份補給。'],
 receive:['04 / RESTOCK QUEST','補給入庫','選擇廠牌、核對到貨，將藥品收入本機藥庫。'],
 loss:['05 / DAILY JOURNAL','每日冒險紀錄','填寫當日累計耗損，前往 Google 核對入帳差額。'],
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
