# Google 代管完整藥庫

正式入口：https://script.google.com/macros/s/AKfycbwsXafoCVk_UzEwqhTD4shlbLerTzPh1sxv1EH8wxjTovy_fZUNH6F8btpo_oYLYUVF4Q/exec

使用既有管理帳號登入，建檔、進貨、耗損、訂貨都在本頁核對後直接同步；成功後在同一視窗顯示更新結果。進貨可加入多項、修改瓶數或移除，再整批確認。尚未加入清單的數量會提示處理，避免漏登。

Google 網頁應用維持「我」執行、「只有我自己」存取，不開放匿名寫入。透過 google.script.run 呼叫 erpHosted，再沿用既有 erpDirect、交易鎖、預覽版本與固定交易編號。耗損的日期準備與預覽分兩次伺服器呼叫，避免日期欄新增後的快取。

部署步驟：
1. 安裝 package.json 指定開發依賴，執行 node scripts/build-hosted.mjs。
2. 發布 web/hosted-app.js 至 GitHub Pages，確認 200 後才更新 Apps Script。
3. gas/cloud/App.html 對應 Apps Script 的 App.html。
4. 將 gas/loss/WebApp.gs 與 gas/cloud/Hosted.gs 合併貼入 Apps Script WebApp.gs；勿重複建立同名函式。
5. 保留既有 Cloud.gs、Direct.gs、耗損程式與權限，更新既有網頁部署版本。
6. 執行 node --test，並從正式入口實際確認與讀回。

完整 UI 的 CSS 隨 App.html 封裝，JS 從既有 GitHub Pages 載入，避免 HtmlService 對內嵌壓縮程式的處理差異。更新 JS 時調整 build-hosted 的版本參數，再重建。

原 GitHub 網址的本機草稿與尚未核對交易不會搬移到 Google 代管來源。原交易必須在原入口以同一編號讀回確認；不要將不確定是否入帳的實際交易另建重送。
