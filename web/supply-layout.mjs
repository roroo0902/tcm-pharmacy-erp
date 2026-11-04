// Match daily-loss controls while retaining the quantity units.
export const supplyLayout = `<style>
#content :is(#order-grid,#receipt-grid) th:nth-child(-n+2),
#content :is(#order-grid,#receipt-grid) td:nth-child(-n+2){text-align:center;vertical-align:middle}
#content :is(#order-grid,#receipt-grid) tbody td:first-child:not([colspan]){padding-left:54px;padding-right:54px}
#content :is(#order-grid,#receipt-grid) td.receipt-quantity{min-width:198px}
#content :is(#order-grid,#receipt-grid) .quantity-stepper{grid-template-columns:26px 72px 16px 26px;gap:6px;width:158px;margin-inline:auto}
#content :is(#order-grid,#receipt-grid) .quantity-stepper input{height:34px;min-height:34px;padding:4px 6px;font-size:14px;font-weight:400}
#content :is(#order-grid,#receipt-grid) .quantity-stepper .quantity-adjust{width:26px;min-width:26px;height:28px;min-height:28px;font-size:18px;padding:0;border-radius:5px}
#content :is(#order-grid,#receipt-grid) .quantity-stepper .quantity-clear{height:22px;min-height:22px;padding:0 4px;font-size:12px;justify-self:center}
@media(max-width:760px){
 #content :is(#order-grid,#receipt-grid) .quantity-stepper{grid-template-columns:32px 72px 16px 32px;width:170px}
 #content :is(#order-grid,#receipt-grid) .quantity-stepper input{height:40px;min-height:40px;font-size:16px}
 #content :is(#order-grid,#receipt-grid) .quantity-stepper .quantity-adjust{width:32px;min-width:32px;height:40px;min-height:40px}
}
#content #order-grid .quantity-stepper{grid-template-columns:26px 72px 16px 26px;width:158px}
#content :is(#order-grid,#receipt-grid) th .sort-heading{width:100%;text-align:center}
@media(max-width:760px){#content #order-grid .quantity-stepper{grid-template-columns:32px 72px 16px 32px;width:170px}}
@media(max-width:760px){#content #order-grid tbody td:first-child{text-align:center!important}}
</style>`;
