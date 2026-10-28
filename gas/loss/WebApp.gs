// Deploy with access MYSELF. GET/POST display drafts only; authenticated confirmation commits.
function doGet(){loss3Actor_();return HtmlService.createHtmlOutput(loss3Html_(JSON.stringify(loss3SourceDraft_()))).setTitle('每日耗損｜當日累計');}
function doPost(e){loss3Actor_();const text=String(e&&e.parameter&&e.parameter.payload||'');if(text.length>300000)throw Error('清單過大');loss3Draft_(text);return HtmlService.createHtmlOutput(loss3Html_(text)).setTitle('每日耗損｜確認差額');}
