# 本草藥庫｜勇者的補給站

管理中藥進貨、當天耗損、訂購與盤點。所有數量使用「瓶」；銷指當天耗損，不包含零售收款或克數換算。

## 冒險藥庫介面

![冒險藥庫場景](web/assets/adventure-valley.jpg)

八個操作頁面採用深藍選單、金色邊框與草原城鎮場景，搭配史萊姆守護者及紅、藍藥水圖示。電腦與手機共用同一網址；手機可橫向滑動選單與資料表，並保留原有排序、廠牌選擇、登錄及備份功能。

場景為生成式插畫；史萊姆、藥水與選單圖示為本專案 SVG。藥品清單依類別顯示補血藥罐：單方為中藥粉陶罐，複方為寬身稜角瓶，保留文字類別標示。單方素材為 `web/assets/herbal-powder.png`，複方素材為 `web/assets/potion-categories.png`。主題樣式集中於  `web/quest-theme.css`，各頁冒險文案位於 `web/quest-theme.mjs`。

## Google Sheet 整合

庫存總覽直接同步 Google 庫存總表。建檔、進貨、每日累計耗損、訂貨皆經 Google 預覽確認後寫回工作表，並提供交易紀錄、進貨沖銷、訂貨取消與重送防護。

- 庫存以六個藥品分頁 G 欄為準；建檔及進貨另寫「藥庫_同步紀錄」。
- 耗損以當日累計差額入帳，保留「耗損V3_更正紀錄」。
- 訂貨寫入原訂藥工作簿的「藥庫_訂貨紀錄」，不自動入庫或發送廠商。
- 舊650筆待盤點名冊、本機試用帳與訂貨草稿保留，不自動轉成正式庫存。

操作、資料來源、部署與限制見 [Google整合說明](docs/Google整合.md)。下列舊單機與V2文件保留作歷史參考，以整合說明為準。

## 沿用 Google 登入

在 GitHub 首頁按「開啟 Google 藥庫」，勾選「記住這台瀏覽器」。之後同一瀏覽器開啟 GitHub，會在 3 秒後進入 Google 代管操作頁，並保留目前選擇的功能。Google 操作頁沿用瀏覽器既有 Google 登入，不使用 GitHub 頁面的短期 OAuth token；進貨、耗損仍須站內核對後才入帳。

本機只記住 `tcm-google-entry-v1=google` 的入口偏好，不保存密碼、access token 或 refresh token。登出 Google、清除 Cookie、更換裝置或 Google 要求驗證時仍需登入。固定以同一個 Safari/Chrome 開啟；Google Apps Script 不支援多帳號同時登入，若無法開啟，請使用只登入藥庫帳號的瀏覽器設定檔。

取消自動開啟：在倒數期間按「留在 GitHub 操作」，或開啟 `?stay=1`；Google 藥庫頁尾也提供「切換操作入口」。`#backup` 不自動跳轉，方便保留舊本機帳。兩個入口的未送出草稿不會自動搬移，切換前應先完成或另行記下。部署存取權限保持 MYSELF，原有伺服器帳號檢查不變。

## 執行測試

安裝 Node.js 22 或更新版本後，在專案目錄執行：

```sh
node --test
```

## 歷史文件

- [原單機網頁說明](docs/網頁試用.md)
- [耗損V3](gas/loss/README.md)
- [批次訂貨計算](gas/orders/README.md)
- [Excel名冊匯入](docs/Excel匯入.md)
