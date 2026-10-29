# 本草藥庫 AI 拍照進貨｜開發分支第一版

## 操作流程

1. 只選擇科達／天明／富田廠商，不須先知道單方或複方。
2. 手機拍照／選擇 JPG、PNG 照片（瀏覽器壓縮成 JPEG，不將原圖寫入 Google Sheets 或本機儲存）。
3. 透過已有的 OAuth 站內同步通道，將壓縮照片送到授權的既有 GAS，GAS 用 OpenAI API 擷取藥名、品號、數量、原始單位及辨識依據。
4. 同時完整讀取所選廠商的單方與複方名冊，以唯一品號或無品號時的唯一藥名提出建議。重複、衝突及未知品號不自動配對；未配對保留原藥名。
5. 顯示品項所屬分頁分類；人工選定現有品項、核對進貨單位、修改「實際入庫瓶數」，逐行打勾。
6. 加入批次清單；可再拍其他照片／切換廠商。
7. 預覽現在的庫存與預估變化（僅供參考），提交時既有 GAS 再次讀取最新資料，提供權威前後值預覽。
8. 經手人在現有確認對話框確認後，走原 `tcm-cloud` 進貨交易通道；同一交易 UUID 防重送，入庫與稽核為同一批寫入。

## 部署前置條件

- **此版本未部署到正式網站及 GAS，既有庫存沒有因本功能改動。**
- GitHub 端須新增 `web/photo-receive.mjs`、`src/photo-receive-data.mjs`、`test/photo-receive.test.mjs`，並更新 `web/app.mjs`、`web/google-entry.mjs`、`web/quest-theme.mjs`、`index.html`（請依 PR diff）。
- 在**既有** GAS 專案新增 `gas/cloud/PhotoVision.gs`，並將 `gas/cloud/Direct.gs` 新增 `recognizeReceipt` 路由，不可另建獨立無身份控管的 GAS 寫入端點。
- 在現有 GAS Script Properties 設定 `OPENAI_API_KEY`（不能寫進 GitHub、Sheet 或 HTML）。可用 `ERP_OPENAI_VISION_MODEL` 指定受支援的影像模型；預設 `gpt-4.1-mini`。確認 OpenAI API 配額、資料隱私與院內規範，再進行實際單據測試。
- 既有 OAuth `ERP_ALLOWED_EMAILS`、MYSELF 限制、庫存批次交易 `ScriptLock` 不變。
- 更新既有 GAS 部署版本後，再重新執行 `node scripts/build-hosted.mjs`，將更新的 hosted bundle 和 HTML 一起發佈，最後合併至 main。

## 數據安全

- AI 結果只是建議：沒有直接入庫權限，也不能新增主檔、變更庫存、修改歷史交易。
- 未匹配／重複代碼／缺庫存／非整瓶數量都無法直接加入，必須手動修正。
- 只有 `確認入帳` 才寫入現有 Google Sheets，沿用前後庫存驗證及 `ERP-...` 交易編號重送保護。
- 照片在瀏覽器記憶體中短暫使用；外部 AI API 會接收照片資料。避免上傳含患者個資、身分證件的圖片，且須於上線前完成資料處理規範評估。
- 若 AI 服務設定不足、權限不符、無法判讀，保持為未入庫狀態。可繼續使用既有「進貨登錄」。

## 開發測試

執行 `node --test test/photo-receive.test.mjs`。此測試涵蓋文字正規化、重複代碼、人工核對、庫存與數量檢查。完成部署後，仍需以隔離測試品項，實際用手機檢查拍照 → AI 辨識 → 人工核對 → 庫存預覽 → 同筆重送、沖銷及跨裝置讀回。
## 2026-10-30 廠商自動分類調整

同一張照片的單方與複方可放在同一交易；每列採用名冊的原分頁，沿用既有交易 ID 與批次入帳。不新增或搬動庫存工作表。名冊任一分頁讀取失敗時禁止加入清單；切換廠商使舊辨識失效。分類欄位不由 AI 猜測。此更新尚未驗證線上 OpenAI 與 Google Sheets 寫入。

## OpenAI 設定

使用者已選擇沿用既有 OpenAI 金鑰。請在原 GAS 的指令碼屬性親自新增 OPENAI_API_KEY 並填入，勿放在前端、GitHub 或 Sheet。可選 ERP_OPENAI_VISION_MODEL，預設 gpt-4.1-mini。後端使用 Responses API、嚴格 JSON Schema、store:false；此設定不代表零資料保留。實際辨識與入帳須待金鑰設定後驗證。

文件：https://developers.openai.com/api/docs/guides/images-vision
