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

#content #loss-table tbody td{vertical-align:middle;text-align:center;line-height:1.5}
#content #loss-table tbody td:first-child:not([colspan]){padding:16px;text-align:center!important}
#content #loss-table tbody td:first-child::before{display:none!important}
#loss-table .aligned-drug{display:inline-flex;align-items:center;gap:10px;text-align:left;max-width:100%}
#loss-table .aligned-drug-text{display:block;min-width:0;white-space:normal;line-height:1.5}
#loss-table .aligned-drug-icon{display:block;flex:0 0 40px;width:40px;height:44px;background:url('./web/assets/herbal-powder.png') center/contain no-repeat;image-rendering:pixelated}
#loss-table tr[data-category="複方"] .aligned-drug-icon{background-image:url('./web/assets/potion-categories.png');background-size:200% 100%;background-position:right center}
#content #loss-table .quantity-stepper .quantity-clear{display:flex;align-items:center;justify-content:center;justify-self:stretch;box-sizing:border-box;line-height:1;height:28px;min-height:28px;padding:0 4px;margin:0}
@media(max-width:760px){#content #loss-table .quantity-stepper .quantity-clear{height:44px;min-height:44px}}
@media(max-width:760px){
 #content .tablewrap:has(#loss-table){overflow:visible;max-width:100%}
 #content #loss-table{display:block;width:100%;min-width:0;white-space:normal}
 #content #loss-table thead,#content #loss-table tbody{display:block}
 #content #loss-table thead tr{display:flex;flex-wrap:wrap;gap:8px;padding:8px}
 #content #loss-table thead th{min-width:0!important;width:auto!important;padding:0;border:0}
 #content #loss-table thead th:not(:has(button)){display:none}
 #content #loss-table tbody tr{display:block;border:1px solid #ccc7b6;border-radius:8px;margin:12px 0;padding:8px;background:#fffdf5}
 #content #loss-table tbody td{display:flex!important;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;min-width:0!important;width:auto!important;padding:8px!important;border:0;text-align:right!important;line-height:1.5;white-space:normal;overflow-wrap:anywhere}
 #content #loss-table tbody td:not(:first-child)::before{content:attr(data-label);font-size:12px;color:#526c7a;text-align:left;margin-right:auto}
 #content #loss-table tbody td:first-child{display:block!important;text-align:center!important;padding:12px 44px!important}
 #content #loss-table tbody td .muted,#content #loss-table tbody td small{flex-basis:100%;line-height:1.5}
 #content #loss-table .quantity-stepper{margin:0 0 0 auto;flex:none}
 #content #loss-table .quantity-clear{display:flex;align-items:center;justify-content:center}
}
</style>`;
