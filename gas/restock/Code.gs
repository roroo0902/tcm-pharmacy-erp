/***** === 設定區 === *****/
// 目標庫存試算表 ID
const INVENTORY_SPREADSHEET_ID = '1jbiHJoDf730G7qLywlS4UA2tHW5lPRc6wExLW-7Pq4Q';

// 要處理的分頁名稱
const SHEET_NAMES = ['科達單方', '科達複方'];

// 「訂藥藥品進貨表」設定 (來源)
const SRC_START_ROW = 3;  
const SRC_COL_CODE = 1;       // A 欄：編號
const SRC_COL_NAME = 2;       // B 欄：藥品名稱
const SRC_COL_QTY  = 4;       // D 欄：訂貨量
const SRC_COL_LACK = 5;       // E 欄：缺藥
const SRC_COL_RATE = 6;       // F 欄：缺藥率

// D1 日期所在位置
const SRC_DATE_ROW = 1;
const SRC_DATE_COL = 4;

// 庫存表中的欄位設定 (目標)
const INV_COL_NOTE = 1;   // A 欄：備註
const INV_COL_CODE = 2;   // B 欄：編號
const INV_COL_NAME = 4;   // D 欄：藥品名稱 (您指定為 4)
const INV_COL_UPDATE = 6; // F 欄：更新時間 
const INV_COL_STOCK = 7;  // G 欄：備貨量
const INV_COL_LACK = 11;  // K 欄：缺藥
const INV_COL_RATE = 12;  // L 欄：缺藥率
const INV_COL_ORDER_QTY = 13; // M 欄：訂貨量 (新增加)

// 註記文字
const NOTE_FLAG_TEXT = '已入庫';
const NEW_ITEM_TEXT = '新增藥品'; 


/**
 * 主程式：進貨入庫同步 (標頭日期同步版)
 */
function syncRestockToInventory() {
  const srcSs = SpreadsheetApp.getActiveSpreadsheet();
  let dstSs;
  
  try {
    dstSs = SpreadsheetApp.openById(INVENTORY_SPREADSHEET_ID);
  } catch (e) {
    console.error("無法開啟目標試算表，請檢查 ID 或權限。");
    return;
  }

  const tz = srcSs.getSpreadsheetTimeZone() || Session.getScriptTimeZone();

  SHEET_NAMES.forEach(sheetName => {
    const srcSh = srcSs.getSheetByName(sheetName);
    const invSh = dstSs.getSheetByName(sheetName);
    
    if (!srcSh || !invSh) {
      console.log(`找不到工作表: ${sheetName}，跳過。`);
      return;
    }

    const lastSrcRow = srcSh.getLastRow();
    if (lastSrcRow < SRC_START_ROW) return; 

    // --- 1. 讀取進貨日期 ---
    const dateVal = srcSh.getRange(SRC_DATE_ROW, SRC_DATE_COL).getValue();
    let dateStr = (dateVal instanceof Date) ? Utilities.formatDate(dateVal, tz, 'MM/dd') : String(dateVal).trim();
    if (!dateStr) dateStr = Utilities.formatDate(new Date(), tz, 'MM/dd');

    // === 新增：同步 M 欄第一列的日期標頭 ===
    // 讓庫存表的 M1 自動更新為進貨表的日期 (例如 1/25)
    invSh.getRange(1, INV_COL_ORDER_QTY).setValue(dateStr);

    // --- 2. 建立初始庫存表索引 (優化版：過濾無效空白列) ---
let lastInvRow = invSh.getLastRow();
let codeToRow = {};

if (lastInvRow >= 2) { 
  // 1. 先抓取整欄編號
  const allCodes = invSh.getRange(1, INV_COL_CODE, lastInvRow, 1).getValues();
  
  // 2. 找出真正最後一個有編號的索引，避免掃描下方大片空白
  let realLastIdx = allCodes.map(r => String(r[0]).trim()).lastIndexOf("") === -1 
                    ? allCodes.length 
                    : allCodes.findLastIndex(r => String(r[0]).trim() !== "") + 1;

  // 3. 只處理到有編號的那一列
  for (let i = 0; i < realLastIdx; i++) {
    const code = String(allCodes[i][0]).trim();
    if (code && code !== "編號" && code !== "Code") { // 排除標題與空值
      codeToRow[code] = i + 1; 
    }
  }
}

    // --- 3. 讀取來源資料 ---
    const numRows = lastSrcRow - SRC_START_ROW + 1;
    const srcData = srcSh.getRange(SRC_START_ROW, 1, numRows, 6).getValues(); 
    const srcNotesRange = srcSh.getRange(SRC_START_ROW, SRC_COL_QTY, numRows, 1);
    const srcNotes = srcNotesRange.getNotes();

    let notesUpdates = []; 

    for (let i = 0; i < srcData.length; i++) {
      const rowData = srcData[i];
      const note = srcNotes[i][0];
      
      // 已標記過的跳過
      if (note && note.includes(NOTE_FLAG_TEXT)) {
        notesUpdates.push(note); 
        continue;
      }

      const code = String(rowData[0]).trim(); // A欄
      const name = String(rowData[1]).trim(); // B欄
      const qty  = Number(rowData[3]);        // D欄
      const lackInfo = rowData[4];            // E欄
      const lackRate = rowData[5];            // F欄 (這裡建議您在試算表公式已加入 MAX(0,...) 判斷)

      if (qty <= 0 && !code && !name) {
        notesUpdates.push(note);
        continue;
      }

      // --- 同步邏輯 ---
      if (code && codeToRow[code]) {
        // === 情境 A：已有編號 -> 更新 ===
        const targetRow = codeToRow[code];
        const stockCell = invSh.getRange(targetRow, INV_COL_STOCK);
        const oldStock = Number(stockCell.getValue()) || 0;
        
        stockCell.setValue(oldStock + qty); 
        invSh.getRange(targetRow, INV_COL_UPDATE).setValue(dateStr);
        invSh.getRange(targetRow, INV_COL_LACK).setValue(lackInfo);
        invSh.getRange(targetRow, INV_COL_RATE).setValue(lackRate);
        invSh.getRange(targetRow, INV_COL_ORDER_QTY).setValue(qty); // 同步數值到 M 欄
        
      } else {
        // === 情境 B：新增藥品 ===
        console.log(`【${sheetName}】新增藥品：${code} ${name}`);

        let newRowData = new Array(13).fill(""); 
        newRowData[INV_COL_NOTE - 1]   = NEW_ITEM_TEXT;
        newRowData[INV_COL_CODE - 1]   = code;
        newRowData[INV_COL_NAME - 1]   = name;
        newRowData[INV_COL_UPDATE - 1] = dateStr;
        newRowData[INV_COL_STOCK - 1]  = qty;
        newRowData[INV_COL_LACK - 1]   = lackInfo;
        newRowData[INV_COL_RATE - 1]   = lackRate;
        newRowData[INV_COL_ORDER_QTY - 1] = qty;

        let insertAtRow = -1;
        // (排序插入邏輯保持不變...)
        if (code) {
          const startSearchRow = 3; 
          const currentLastRow = invSh.getLastRow();
          const searchHeight = currentLastRow - startSearchRow + 1;
          if (searchHeight > 0) {
            const currentCodes = invSh.getRange(startSearchRow, INV_COL_CODE, searchHeight, 1).getValues().flat();
            for (let j = 0; j < currentCodes.length; j++) {
              let existingCode = String(currentCodes[j]).trim();
              if (!existingCode || existingCode === "編號") continue;
              if (existingCode > code) {
                insertAtRow = j + startSearchRow; 
                break;
              }
            }
          }
          if (insertAtRow === -1) {
             insertAtRow = invSh.getLastRow() + 1;
          }
        } else if (name) {
          insertAtRow = invSh.getLastRow() + 1;
        }

        if (insertAtRow !== -1) {
          invSh.insertRowBefore(insertAtRow);
          invSh.getRange(insertAtRow, 1, 1, newRowData.length).setValues([newRowData]);
          // 更新索引偏移
          for (let key in codeToRow) {
            if (codeToRow[key] >= insertAtRow) codeToRow[key]++;
          }
          if (code) codeToRow[code] = insertAtRow;
        }
      }

      let newNote = note ? (note + "\n" + NOTE_FLAG_TEXT) : NOTE_FLAG_TEXT;
      notesUpdates.push([newNote]);
    }

    if (notesUpdates.length > 0) {
      const notesMatrix = notesUpdates.map(n => Array.isArray(n) ? n : [n]);
      srcNotesRange.setNotes(notesMatrix);
    }
  });

  SpreadsheetApp.flush();
}

/**
 * 顯示確認視窗 (進貨版)
 */
function openRestockConfirmDialog() {
  let confirmImgUrl = "https://drive.google.com/file/d/1NEkmV-8IbZpDvQ1IAZ0QWbvgd67SrIgv/view?usp=sharing"; 
  let successImgUrl = "https://drive.google.com/file/d/19CdDHant8dNdbkCYnOAkGHhQt08f6pEV/view?usp=sharing"; 

  const convertDriveLink = (url) => {
    if (url.indexOf("drive.google.com") !== -1) {
      const idMatch = url.match(/[-\w]{25,}/);
      if (idMatch) return "https://drive.google.com/thumbnail?id=" + idMatch[0] + "&sz=w1000";
    }
    return url; 
  };
  confirmImgUrl = convertDriveLink(confirmImgUrl);
  successImgUrl = convertDriveLink(successImgUrl);

  const htmlString = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body { font-family: '微軟正黑體', sans-serif; text-align: center; padding: 20px; background-color: #f0fdf4; transition: background 0.5s; }
          .character-img { width: 100%; max-width: 280px; height: 250px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); object-fit: cover; object-position: top center; }
          h2 { color: #15803d; margin: 10px 0; }
          p { color: #666; font-size: 15px; margin-bottom: 25px; }
          button { border: none; padding: 10px 30px; border-radius: 50px; font-size: 15px; cursor: pointer; font-weight: bold; margin: 5px; }
          .btn-yes { background: linear-gradient(135deg, #86efac 0%, #22c55e 100%); color: #fff; box-shadow: 0 4px 10px rgba(34, 197, 94, 0.4); text-shadow: 0 1px 2px rgba(0,0,0,0.2); }
          .btn-no { background-color: #f0f0f0; color: #777; }
          #loading { display: none; margin-top: 20px; color: #16a34a; font-weight: bold; animation: pulse 1.5s infinite; }
          @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
          #final-btn-box { display: none; margin-top: 20px; }
        </style>
      </head>
      <body>
        <img id="main-img" src="${confirmImgUrl}" class="character-img" onerror="this.src='https://i.imgur.com/8y7F5sQ.png'">
        <h2 id="dialog-title">確認進貨入庫？</h2>
        <p id="dialog-text">系統將依據「訂藥進貨表」<br>將數量<b>加入</b>庫存，並更新時間！</p>
        <div id="confirm-btn-box">
          <button class="btn-no" onclick="google.script.host.close()">取消</button>
          <button class="btn-yes" onclick="runSync()">確定入庫</button>
        </div>
        <div id="loading">✨ 正在搬運藥品入庫中...</div>
        <div id="final-btn-box">
          <button class="btn-no" onclick="google.script.host.close()">關閉視窗</button>
        </div>
        <script>
          function runSync() {
            document.getElementById('confirm-btn-box').style.display = 'none';
            document.getElementById('loading').style.display = 'block';
            google.script.run.withSuccessHandler(onSuccess).syncRestockToInventory();
          }
          function onSuccess() {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('main-img').src = "${successImgUrl}";
            document.getElementById('dialog-title').innerText = "入庫成功！";
            document.getElementById('dialog-text').innerHTML = "庫存已增加<br>日期與缺藥資訊已更新 ✅";
            document.getElementById('final-btn-box').style.display = 'block';
            document.body.style.backgroundColor = "#dcfce7";
          }
        </script>
      </body>
    </html>
  `;
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(htmlString).setWidth(360).setHeight(500), ' ');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('💊 庫存管理系統')
    .addItem('▶️ 執行進貨入庫', 'openRestockConfirmDialog')
    .addToUi();
}