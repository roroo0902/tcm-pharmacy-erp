export function pageScope(){let revision=0;return {invalidate(){revision++;},wrap(fn){const current=revision;return (...args)=>current===revision?fn(...args):undefined;}};}
export function protectDraft(cleanup,isDirty,leaveMessage){cleanup.hasUnsavedChanges=isDirty;cleanup.leaveMessage=leaveMessage;return cleanup;}
export function allowLeave(cleanup,confirm){return !cleanup.hasUnsavedChanges?.()||confirm(cleanup.leaveMessage||'本頁有尚未完成的輸入，離開會清除這些內容。確定離開？');}
