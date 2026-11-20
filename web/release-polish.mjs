// The same bundle is used by Pages and the older, versioned Apps Script shell.
const styleId='erp-release-workbench-style', markerId='erp-ui-release';
export const erpUiRelease='介面版本 2026.11.20 R1';

const workbenchCss=`
#erp-ui-release {
  display:table; margin-top:8px; padding:3px 8px; border:1px solid #b79b60;
  color:#fff1c5; background:#18324c; border-radius:5px; font-size:12px;
  line-height:1.5; font-variant-numeric:tabular-nums; letter-spacing:.04em;
}
/* Dark dialog notes keep their inherited color; this targets parchment cells only. */
#confirm .direct-review-table td .muted {color:#344b60;font-size:12px;line-height:1.5}
#content :is(#order-state,#order-grid-state,#receipt-state,#loss-state,#sh-state):not(:empty),
#content #sh-list > :is([role="status"],[role="alert"]) {
  padding:10px 12px; margin-block:10px; border:1px solid #a6b7bf;
  border-inline-start:4px solid #436780; border-radius:6px;
  color:#18374c; background:#edf3f4; line-height:1.55; overflow-wrap:anywhere;
}
#content #order-state.error,#content #sh-list > [role="alert"] {
  border-color:#a27062;color:#682e24;background:#fff0ec;
}
#content :is(#og-summary,#receipt-summary,#loss-summary,#order-total) {
  padding:8px 12px;border:1px solid #d4be89;border-radius:6px;
  color:#25384c;background:#fff5da;font-size:14px;font-weight:700;
  font-variant-numeric:tabular-nums;line-height:1.55;overflow-wrap:anywhere;
}
#content .actions:has(> :is(#og-summary,#receipt-summary,#loss-summary)) {
  gap:10px 12px;align-items:center;margin-block:14px;
}
#content :is(#og-submit,#receipt-submit,#loss-submit,#order-confirm):not(:disabled) {
  background:#efd08a;color:#2b2316;border-color:#795b30;
  box-shadow:0 2px 0 #795b30;font-weight:750;
}
#content :is(#og-submit,#receipt-submit,#loss-submit,#order-confirm):not(:disabled):hover {
  background:#ffe2a0;
}
#content :is(#order-grid,#receipt-grid,#loss-table,.order-grid) tbody tr:focus-within > td {
  background-color:#f4ebd2;
}
#content .shortage-cards > button {border-radius:7px;line-height:1.45;box-shadow:0 2px 0 #ad925e}
#content .shortage-cards > button strong {color:#18374c;font-variant-numeric:tabular-nums}
#content .shortage-cards > button:disabled strong {font-size:clamp(1rem,2vw,1.2rem)}
#content .shortage-cards > button:disabled {opacity:1;color:#465a68;background:#eeeae0;border-style:dashed;box-shadow:none}
#content #sh-list .shortage-row {background:#fffaf0;border-bottom-color:#d9c8a5}
#content #sh-list .shortage-row small {color:#42576a;line-height:1.55}
body:is([data-page=orders],[data-page=orderPlanning],[data-page=receive],[data-page=loss],[data-page=shortage]) #content :is(.actions,.shortage-cards,.shortage-filters,#order-grid,#receipt-grid,#loss-table,.order-grid) :is(button,input,select,a):focus-visible {
  outline:2px solid #123d66;outline-offset:2px;box-shadow:0 0 0 2px #fff8e8,0 0 0 6px #fff8e8;
}
@media (max-width:760px) {
  #content :is(#og-summary,#receipt-summary,#loss-summary,#og-recovery-status,#receipt-pending-status):not(:empty) {flex:1 1 100%}
  #content .actions:has(> :is(#og-summary,#receipt-summary,#loss-summary)) > button {
    flex:1 1 12rem;min-height:44px;white-space:normal;overflow-wrap:anywhere;
  }
  body #content :is(#order-grid,#receipt-grid,#loss-table) .quantity-stepper :is(.quantity-adjust,.quantity-clear) {min-height:44px}
  #content .tablewrap:has(:is(#receipt-grid,#loss-table)) {max-width:100%;overflow-x:auto;border:1px solid #c7b687;border-radius:7px}
  #content :is(#order-grid,#receipt-grid,#loss-table) .quantity-stepper {
    max-width:100%;width:204px;grid-template-columns:44px minmax(48px,1fr) 44px 16px;
  }
  #content :is(#order-grid,#receipt-grid,#loss-table) .quantity-stepper input {width:100%;min-width:0}
  #content :is(#order-grid,#receipt-grid,#loss-table) .quantity-stepper .quantity-adjust {width:44px;min-width:44px}
  #content #order-grid tbody td:first-child:not([colspan]) {background-color:#f1e5c7;border-radius:5px}
  #content #order-grid tbody td[data-label]::before {font-size:13px;color:#354c60}
  #content .shortage-cards {gap:8px;margin-block:12px}
  #content .shortage-cards > button {min-width:0;padding:12px 6px;overflow-wrap:anywhere}
  #content #sh-list .shortage-row {padding:12px;gap:10px;border-color:#c7b687}
  #content #sh-list .shortage-row .actions > button {min-height:44px;flex:1 1 7rem;white-space:normal}
  #content .shortage-filters > * {min-width:min(100%,9rem)}
}
`;

export function mountReleasePolish(doc=document){
 if(!doc.getElementById(styleId)){
  const style=doc.createElement('style');style.id=styleId;style.textContent=workbenchCss;
  doc.head.append(style);
 }
 if(!doc.getElementById(markerId)){
  const hero=doc.querySelector('.hero-copy')||doc.querySelector('#title')?.parentElement;
  if(hero){
   const marker=doc.createElement('small');marker.id=markerId;marker.textContent=erpUiRelease;
   hero.append(marker);
  }
 }
}
