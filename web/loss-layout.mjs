// Keep daily-loss layout with its module so both hosted and static pages use it.
export const lossLayout = `<style>
#content #loss-table th:nth-child(-n+2),
#content #loss-table td:nth-child(-n+2){text-align:center;vertical-align:middle}
#content #loss-table tbody td:first-child:not([colspan]){padding-left:54px;padding-right:54px}
#content #loss-table td:nth-child(5){min-width:188px}
#content #loss-table .quantity-stepper{grid-template-columns:26px 72px 26px 16px;gap:6px;width:158px;margin-inline:auto}
#content #loss-table .quantity-stepper input{height:34px;min-height:34px;padding:4px 6px;font-size:14px;font-weight:400}
#content #loss-table .quantity-stepper .quantity-adjust{width:26px;min-width:26px;height:28px;min-height:28px;font-size:18px;padding:0;border-radius:5px}
#content #loss-table .quantity-stepper .quantity-clear{display:flex;align-items:center;justify-content:center;align-self:center;height:22px;min-height:22px;padding:0 4px;font-size:12px;line-height:1;margin:0;justify-self:center}
@media(max-width:760px){
 #content #loss-table .quantity-stepper{grid-template-columns:32px 72px 32px 16px;width:170px}
 #content #loss-table .quantity-stepper input{height:40px;min-height:40px;font-size:16px}
 #content #loss-table .quantity-stepper .quantity-adjust{width:32px;min-width:32px;height:40px;min-height:40px}
}
</style>`;
