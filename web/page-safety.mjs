export function pageScope(){let revision=0;return {invalidate(){revision++;},wrap(fn){const current=revision;return (...args)=>current===revision?fn(...args):undefined;}};}
export function protectDraft(cleanup,isDirty){cleanup.hasUnsavedChanges=isDirty;return cleanup;}
export function allowLeave(cleanup,confirm){return !cleanup.hasUnsavedChanges?.()||confirm('本頁有尚未完成的輸入，離開會清除這些內容。確定離開？');}
