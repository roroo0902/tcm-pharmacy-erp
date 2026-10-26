/***** === 設定區 === *****/

// 目標庫存試算表 ID（藥品庫存表(查詢用)）
const INVENTORY_SPREADSHEET_ID = '1jbiHJoDf730G7qLywlS4UA2tHW5lPRc6wExLW-7Pq4Q';

// 要處理的分頁名稱
const SHEET_NAMES = ['科達單方', '科達複方'];

// 「藥品耗損表」設定
const LOSS_DATA_START_ROW = 3;  
const COL_CODE = 2;       // B 欄：編號
const COL_NAME = 3;       // C 欄：藥品名稱
const COL_LOSS_START = 4; // D 欄：耗損量起始欄 (D=4, E=5, F=6)

// D1 日期所在位置 (耗損表)
const LOSS_DATE_HEADER_ROW = 1;
const LOSS_DATE_HEADER_COL = 4; 

// 庫存表中的欄位設定
const INV_COL_CODE = 2;   // B 欄：編號
const INV_COL_NAME = 3;   // C 欄：藥品名稱
const INV_COL_UPDATE = 6; // ★★★ F 欄：更新時間 (新增功能) ★★★
const INV_COL_STOCK = 7;  // G 欄：備貨量

// 庫存表日期標題範圍 (L~AZ)
const INV_DATE_HEADER_ROW = 1;
const INV_DATE_START_COL = 12; // L 欄
const INV_DATE_END_COL   = 52; // AZ 欄

// 註記文字
const LOSS_NOTE_FLAG_TEXT = '已扣庫存';


/**
 * 主程式：雙重比對 + 增量扣除 + 更新庫存表時間
 */
function syncLossToInventory() {
  const srcSs = SpreadsheetApp.getActiveSpreadsheet();
  let dstSs;
  
  try {
    dstSs = SpreadsheetApp.openById(INVENTORY_SPREADSHEET_ID);
  } catch (e) {
    console.error("無法開啟目標試算表，請檢查 ID 或權限。");
    return;
  }

  const tz = srcSs.getSpreadsheetTimeZone() || Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(new Date(), tz, 'MM/dd'); // 準備今天的日期字串

  SHEET_NAMES.forEach(sheetName => {
    const lossSh = srcSs.getSheetByName(sheetName);
    const invSh  = dstSs.getSheetByName(sheetName);
    
    if (!lossSh || !invSh) {
      console.log(`找不到工作表: ${sheetName}，跳過。`);
      return;
    }

    const lastLossRow = lossSh.getLastRow();
    if (lastLossRow < LOSS_DATA_START_ROW) return; 

    const lastInvRow  = invSh.getLastRow();
    if (lastInvRow < LOSS_DATA_START_ROW) return;

    // --- 1. 處理日期 (耗損表 D1) ---
    const lossHeaderVal = lossSh.getRange(LOSS_DATE_HEADER_ROW, LOSS_DATE_HEADER_COL).getValue();
    let targetDateStr;
    if (lossHeaderVal instanceof Date) {
      targetDateStr = Utilities.formatDate(lossHeaderVal, tz, 'MM/dd');
    } else {
      targetDateStr = String(lossHeaderVal).trim();
    }

    // 尋找庫存表對應日期欄 (L~AZ)
    const checkWidth = INV_DATE_END_COL - INV_DATE_START_COL + 1;
    const invHeaderVals = invSh.getRange(INV_DATE_HEADER_ROW, INV_DATE_START_COL, 1, checkWidth).getValues()[0];
    
    let targetDateCol = null;
    for (let i = 0; i < invHeaderVals.length; i++) {
      let v = invHeaderVals[i];
      if (!v) continue;
      let cellStr = (v instanceof Date) ? Utilities.formatDate(v, tz, 'MM/dd') : String(v).trim();
      
      if (cellStr === targetDateStr) {
        targetDateCol = INV_DATE_START_COL + i;
        break;
      }
    }
    
    if (!targetDateCol) {
      console.log(`【${sheetName}】在庫存表 (L~AZ) 找不到日期：${targetDateStr}，將只扣總庫存。`);
    }

    // --- 2. 建立索引 (雙重索引) ---
    const invDataRange = invSh.getRange(LOSS_DATA_START_ROW, 2, lastInvRow - LOSS_DATA_START_ROW + 1, 2); 
    const invValues = invDataRange.getValues(); 

    const codeToRow = {}; 
    const nameToRow = {}; 

    invValues.forEach((row, idx) => {
      const rowNum = LOSS_DATA_START_ROW + idx;
      const code = String(row[0]).trim();
      const name = String(row[1]).trim(); 
      if (code) codeToRow[code] = rowNum;
      if (name) nameToRow[name] = rowNum; 
    });

    // --- 3. 逐列處理耗損表 ---
    const lossDataRows = lossSh.getRange(LOSS_DATA_START_ROW, 2, lastLossRow - LOSS_DATA_START_ROW + 1, 5).getValues();
    const lossNotes = lossSh.getRange(LOSS_DATA_START_ROW, COL_LOSS_START, lastLossRow - LOSS_DATA_START_ROW + 1, 3).getNotes();

    for (let i = 0; i < lossDataRows.length; i++) {
      const rowData = lossDataRows[i];
      const rowNotes = lossNotes[i];
      const srcRowIndex = LOSS_DATA_START_ROW + i;

      const code = String(rowData[0]).trim(); 
      const name = String(rowData[1]).trim(); 
      
      const valD = Number(rowData[2]) || 0;
      const valE = Number(rowData[3]) || 0;
      const valF = Number(rowData[4]) || 0;

      let actualDeduct = 0; 
      let cellsToTag = []; 

      // 檢查 D, E, F 是否需要扣除
      if (valD > 0 && (!rowNotes[0] || rowNotes[0].indexOf(LOSS_NOTE_FLAG_TEXT) === -1)) {
        actualDeduct += valD;
        cellsToTag.push(0); 
      }
      if (valE > 0 && (!rowNotes[1] || rowNotes[1].indexOf(LOSS_NOTE_FLAG_TEXT) === -1)) {
        actualDeduct += valE;
        cellsToTag.push(1);
      }
      if (valF > 0 && (!rowNotes[2] || rowNotes[2].indexOf(LOSS_NOTE_FLAG_TEXT) === -1)) {
        actualDeduct += valF;
        cellsToTag.push(2);
      }

      // 如果本列沒有新的耗損需要處理，跳過
      if (actualDeduct <= 0) continue;

      // --- 比對與扣除 ---
      let targetRow = null;
      if (code && codeToRow[code]) {
        targetRow = codeToRow[code]; 
      } else if (!code && name && nameToRow[name]) {
        targetRow = nameToRow[name]; 
        console.log(`【${sheetName}】無編號，改以藥名「${name}」扣除庫存。`);
      }

      if (!targetRow) {
        console.log(`【${sheetName}】找不到對應項目 (編號:${code}, 名稱:${name})，跳過。`);
        continue;
      }

      // 1. 更新庫存量 (G欄)
      const stockCell = invSh.getRange(targetRow, INV_COL_STOCK);
      const oldStock  = Number(stockCell.getValue()) || 0;
      stockCell.setValue(oldStock - actualDeduct);

      // 2. 更新每日耗損 (L~AZ欄)
      if (targetDateCol) {
        const dayCell = invSh.getRange(targetRow, targetDateCol);
        const oldDay  = Number(dayCell.getValue()) || 0;
        dayCell.setValue(oldDay + actualDeduct);
      }

      // ★★★ 3. 更新庫存表的時間 (F欄) ★★★
      invSh.getRange(targetRow, INV_COL_UPDATE).setValue(todayStr);

      // 4. 在耗損表寫入「已扣庫存」註記
      cellsToTag.forEach(offset => {
        let originalNote = rowNotes[offset] || "";
        if (originalNote.indexOf(LOSS_NOTE_FLAG_TEXT) === -1) {
            let newNote = originalNote ? (originalNote + "\n" + LOSS_NOTE_FLAG_TEXT) : LOSS_NOTE_FLAG_TEXT;
            lossSh.getRange(srcRowIndex, COL_LOSS_START + offset).setNote(newNote);
        }
      });
    }
  });

  SpreadsheetApp.flush();
}

/**
 * 顯示確認視窗 (UI)
 */
function openCuteConfirmDialog() {
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
          body { font-family: '微軟正黑體', sans-serif; text-align: center; padding: 20px; background-color: #fdfdfd; transition: background 0.5s; }
          .character-img { width: 100%; max-width: 280px; height: 250px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); object-fit: cover; object-position: top center; }
          h2 { color: #4a4a4a; margin: 10px 0; }
          p { color: #666; font-size: 15px; margin-bottom: 25px; }
          button { border: none; padding: 10px 30px; border-radius: 50px; font-size: 15px; cursor: pointer; font-weight: bold; margin: 5px; }
          .btn-yes { background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%); color: #d6336c; box-shadow: 0 4px 10px rgba(255, 154, 158, 0.4); }
          .btn-no { background-color: #f0f0f0; color: #777; }
          #loading { display: none; margin-top: 20px; color: #d6336c; font-weight: bold; animation: pulse 1.5s infinite; }
          @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
          #final-btn-box { display: none; margin-top: 20px; }
        </style>
      </head>
      <body>
        <img id="main-img" src="${confirmImgUrl}" class="character-img" onerror="this.src='https://i.imgur.com/8y7F5sQ.png'">
        <h2 id="dialog-title">確認同步庫存？</h2>
        <p id="dialog-text">系統將會分別扣除D、E、F 欄的耗損量<br>並自動以「編號」或「藥名」扣除庫存！</p>
        <div id="confirm-btn-box">
          <button class="btn-no" onclick="google.script.host.close()">取消</button>
          <button class="btn-yes" onclick="runSync()">確定</button>
        </div>
        <div id="loading">✨ 正在比對資料並更新庫存...</div>
        <div id="final-btn-box">
          <button class="btn-no" onclick="google.script.host.close()">關閉視窗</button>
        </div>
        <script>
          function runSync() {
            document.getElementById('confirm-btn-box').style.display = 'none';
            document.getElementById('loading').style.display = 'block';
            google.script.run.withSuccessHandler(onSuccess).syncLossToInventory();
          }
          function onSuccess() {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('main-img').src = "${successImgUrl}";
            document.getElementById('dialog-title').innerText = "執行成功！";
            document.getElementById('dialog-text').innerHTML = "庫存已更新完成<br>大家辛苦了 ❤️";
            document.getElementById('final-btn-box').style.display = 'block';
            document.body.style.backgroundColor = "#fff0f5";
          }
        </script>
      </body>
    </html>
  `;
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(htmlString).setWidth(360).setHeight(500), ' ');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('💊 庫存管理系統')
    .addItem('▶️ 執行庫存同步', 'openCuteConfirmDialog')
    .addToUi();
}