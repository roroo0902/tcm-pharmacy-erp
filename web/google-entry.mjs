import {LOSS_ENDPOINT} from './loss-cloud.mjs';

export const ENTRY_KEY='tcm-google-entry-v1';
const pages=new Set(['shortage','cloud','overview','receive','photoReceive','loss','orders','orderPlanning','items','history','backup']);
export const safePage=value=>pages.has(value)?value:'overview';
export function googleEntryUrl(hash=''){
 const url=new URL(LOSS_ENDPOINT);url.searchParams.set('page',safePage(hash.replace(/^#/,'')));return url.href;
}
const isOrderId=value=>typeof value==='string'&&/^ERP-[a-zA-Z0-9-]{8,80}$/.test(value);
export function orderEntryRequest(params={}){
 const {page,orderId:id,output,previous}=params;
 if(page!=='history'||!isOrderId(id)||!['print','pdf','mail'].includes(output))return null;
 if(previous!=null&&previous!=='single'&&(!isOrderId(previous)||previous===id))return null;
 return {id,output,mergeIds:previous==null?null:previous==='single'?[]:[previous]};
}
export function orderEntryUrl(id,output,mergeIds){
 const url=new URL(googleEntryUrl('#history'));
 const previous=Array.isArray(mergeIds)?mergeIds[0]||'single':undefined;
 if(orderEntryRequest({page:'history',orderId:id,output,previous})){
  url.searchParams.set('orderId',id);
  url.searchParams.set('output',output);
  if(previous)url.searchParams.set('previous',previous);
 }
 return url.href;
}
export function entryPreference(storage,remember){
 try{
  if(remember===true)storage.setItem(ENTRY_KEY,'google');
  if(remember===false)storage.removeItem(ENTRY_KEY);
  return storage.getItem(ENTRY_KEY)==='google';
 }catch{return false;}
}
export function autoOpenGoogle(storage,search,hash){
 return !new URLSearchParams(search).has('stay')&&hash!=='#backup'&&entryPreference(storage);
}
// The outer Apps Script URL and inner HtmlService frame have different hashes.
// Read only the allow-listed page parameter; never accept an external redirect URL.
export function restoreGooglePage(google,location){
 if(!google?.script?.run||!google.script.url?.getLocation)return Promise.resolve();
 return new Promise(resolve=>{
  let settled=false;
  const timer=setTimeout(()=>{settled=true;resolve();},4000);
  google.script.url.getLocation(info=>{
   if(settled)return;settled=true;
   clearTimeout(timer);
   if(info?.parameter?.page)location.hash=safePage(info.parameter.page);
   resolve(orderEntryRequest(info?.parameter));
  });
 });
}
export function openRememberedEntry(){
 if(globalThis.google?.script?.run)return false;
 let storage;
 try{storage=localStorage;}catch{return false;}
 if(!autoOpenGoogle(storage,location.search,location.hash))return false;
 location.replace(googleEntryUrl(location.hash));
 return true;
}
export function mountGoogleEntry(){
 const notice=document.querySelector('.notice');if(!notice)return;
 if(globalThis.google?.script?.run){
  const status=document.createElement('p');status.className='google-session';
  status.textContent='已沿用此瀏覽器的 Google 登入狀態，可直接核對與同步。';notice.append(status);
  const settings=document.createElement('a');settings.textContent='切換操作入口';
  settings.href='https://roroo0902.github.io/tcm-pharmacy-erp/?stay=1';settings.target='_top';
  document.querySelector('footer')?.append(settings);return;
 }
 let storage;try{storage=localStorage;}catch{}
 const box=document.createElement('section');box.className='google-entry';box.setAttribute('aria-label','Google 藥庫操作入口');
 box.innerHTML='<strong>沿用 Google 登入，直接開啟藥庫</strong><p>固定使用同一個 Safari 或 Chrome，之後沿用該瀏覽器的 Google 登入狀態。首次開啟或 Google 要求驗證時仍需登入。</p><div class="google-entry-actions"><a class="button" id="open-google-pharmacy" target="_self">開啟 Google 藥庫</a><label class="google-entry-remember"><input id="remember-google-entry" type="checkbox" checked>記住這台瀏覽器，下次自動開啟</label><button class="secondary" id="stay-github" type="button">留在 GitHub 操作</button></div><p id="google-entry-status" role="status"></p><details><summary>無法開啟或想取消記住？</summary><p>請用管理藥庫的 Google 帳號開啟。如果同時登入多個帳號而無法開啟，請改用只登入藥庫帳號的瀏覽器設定檔。手機請固定使用 Safari 或 Chrome 開啟。</p><p>可用本頁「留在 GitHub 操作」取消自動開啟；若已跳轉，可由 Google 藥庫頁尾的「切換操作入口」返回。切換前請先完成目前未送出的資料，兩個入口不會自動搬移草稿。</p></details>';
 notice.before(box);
 const open=box.querySelector('#open-google-pharmacy'),check=box.querySelector('input'),status=box.querySelector('[role="status"]');
 open.href=googleEntryUrl(location.hash);
 open.addEventListener('click',()=>{
  entryPreference(storage,check.checked);open.href=googleEntryUrl(location.hash);
 });
 box.querySelector('#stay-github').onclick=()=>{
  entryPreference(storage,false);check.checked=false;
  status.textContent='已取消自動開啟。此頁仍使用原本的「登入 Google 同步」。';
 };
 check.onchange=()=>{if(!check.checked){entryPreference(storage,false);status.textContent='已取消記住此瀏覽器。';}};
 window.addEventListener('hashchange',()=>{open.href=googleEntryUrl(location.hash);});
}
