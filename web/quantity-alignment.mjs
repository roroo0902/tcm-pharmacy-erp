// Shared quantity geometry for all supplier/category rows; no transaction behavior.
export const quantityAlignment = `
#content .quantity-stepper .quantity-clear{grid-column:2!important;grid-row:2!important;justify-self:stretch!important;display:flex;justify-content:center;align-items:center}
#content .ai-item label:has(.quantity-stepper){text-align:center}
#content .ai-item .quantity-stepper{margin-inline:auto}
@media(min-width:761px){
 #content :is(#receipt-grid,#order-grid,#loss-table) tbody td{vertical-align:middle;padding-top:34px;padding-bottom:34px}
 #content :is(#receipt-grid,#order-grid,#loss-table) .quantity-stepper{position:relative;grid-template-columns:26px 72px 26px!important;gap:6px!important;width:136px!important;margin-inline:auto!important}
 #content :is(#receipt-grid,#order-grid,#loss-table) .quantity-stepper input{height:34px;min-height:34px}
 #content :is(#receipt-grid,#order-grid,#loss-table) .quantity-stepper .quantity-unit{position:absolute;left:calc(100% + 6px);top:0;height:34px;display:flex;align-items:center}
 #content :is(#receipt-grid,#order-grid,#loss-table) .quantity-stepper .quantity-clear{position:absolute;grid-column:auto!important;grid-row:auto!important;left:32px;top:40px;width:72px;height:28px;min-height:28px;margin:0;padding:0}
}
@media(max-width:760px){
 #content :is(#receipt-grid,#order-grid,#loss-table) .quantity-stepper{position:relative;grid-template-columns:32px 72px 32px 16px!important;gap:6px!important;width:170px!important}
 #content :is(#receipt-grid,#order-grid,#loss-table) .quantity-stepper .quantity-unit{position:static;grid-column:4;grid-row:1;align-self:center}
 #content :is(#receipt-grid,#order-grid,#loss-table) .quantity-stepper .quantity-clear{position:static;width:72px!important;height:44px;min-height:44px;margin:0;padding:0}
 #content :is(#receipt-grid,#order-grid,#loss-table) td:has(>.quantity-stepper)::before{align-self:flex-start;padding-top:10px}
}
`;
