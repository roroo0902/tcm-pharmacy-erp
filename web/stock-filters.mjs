export const stockFilterStyles = `<style>
.stock-filter-tabs{display:flex;align-items:end;flex-wrap:wrap;gap:6px 10px;margin:2px 0 12px}
.stock-filter-tabs button{font-weight:700;line-height:1.15;letter-spacing:0;transform:none}
#content .stock-sign{position:relative;width:96px;height:64px;padding:0;border:0;border-radius:0;box-shadow:none;color:#39230e;background:transparent url("./web/assets/photo-supplier-sign.webp") center/100% 100% no-repeat}
#content .stock-sign.stock-all{width:122px}
/* The painted board occupies x=7–88%, y=42–91% of the hanging-sign sprite. */
.stock-sign .sign-face{position:absolute;inset:42% 12% 9% 7%;display:grid;grid-template-columns:16px minmax(0,1fr) 16px;align-items:center;font-size:15px}
.stock-all .sign-face{grid-template-columns:24px minmax(0,1fr) 24px}
.stock-label{grid-column:2;grid-row:1;text-align:center;overflow-wrap:anywhere}
.stock-sign .stock-sprite,.stock-tool .stock-sprite{grid-column:1;grid-row:1;justify-self:center}
.stock-tick,.stock-trailing{grid-column:3;grid-row:1;justify-self:center}
.stock-trailing{display:inline-flex;align-items:center;gap:2px}
#content .stock-sign[aria-pressed=true]{color:#fff}
.stock-sign[aria-pressed=true]::before{content:'';position:absolute;inset:0;background:inherit;clip-path:polygon(8% 51%,12% 44%,83% 44%,88% 52%,88% 95%,85% 100%,11% 100%,7% 94%);filter:hue-rotate(174deg) saturate(.9) brightness(.43)}
.stock-tick{color:#efc45f}
.stock-sprite{width:28px;height:28px;flex:none;display:inline-block;background:url("./web/assets/overview-filter-icons.webp") no-repeat;background-size:700% 100%;background-position:var(--sprite) center}
.stock-sign .stock-sprite{width:24px;height:24px}
#content .stock-tool{display:inline-grid;grid-template-columns:28px minmax(0,auto) 28px;align-items:center;justify-content:center;gap:2px;min-height:44px;max-width:100%;padding:5px 10px;background:#fff7e4;color:#193650;border:3px double #b99450;border-radius:6px;box-shadow:0 2px 0 #aa9060;font-size:14px;overflow-wrap:anywhere}
#content .stock-tool[aria-pressed=true],#content .stock-tool.is-active{background:#193650;color:white}
#content :is(.stock-sign,.stock-tool):focus-visible{outline:3px solid #35658b;outline-offset:2px}
.stock-more{position:relative;max-width:100%}
.stock-options{position:absolute;z-index:5;inset-inline-end:0;top:calc(100% + 4px);width:max-content;min-width:100%;max-width:min(17rem,90vw);max-height:16rem;overflow:auto;padding:3px;background:#fff9e9;border:1px solid #bc9a55;border-radius:5px;box-shadow:0 3px 10px #37270133}
#content .stock-options .stock-tool{width:100%;grid-template-columns:3.5em minmax(0,1fr) 3.5em;justify-content:stretch;border:0;border-radius:2px;box-shadow:none;text-align:start}
.stock-options small{font-size:12px}
.stock-options p{margin:6px 8px}
@media(max-width:600px){#cloud-categories{align-items:end;gap:7px}#cloud-categories .stock-more{position:static}#cloud-categories{position:relative}.stock-options{inset-inline:0;width:auto;max-width:100%}}
.cloud-selector-label{display:flex;align-items:center;margin:14px 0 8px}
.cloud-selector-label::after{content:'';flex:1;border-top:1px solid #cfb273}
.cloud-selector-label span{display:inline-flex;align-items:center;gap:7px;padding:4px 10px;border:1px solid #bd9652;border-radius:5px;background:transparent;color:#193650;font-size:1rem;font-weight:700;line-height:1.35}
.cloud-selector-label svg{width:1.2em;height:1.2em;flex:none;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.loss-selector .cloud-selector-label,#receipt-panel .receipt-filters .cloud-selector-label{width:100%}
</style>`;

const headingIcons = {
  '廠商': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18M5 3v18M10 4v4m8-4v4"/><rect x="8" y="8" width="13" height="10" rx="1.5"/><path d="M11 12h7"/></svg>',
  '類別': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18a9 9 0 0 1-18 0ZM7 21h10m-9-1 1-2m7 2-1-2M12 10l7-7a1.6 1.6 0 0 1 2.3 2.2L17 10"/></svg>',
};

export function filterHeading(label, id) {
  return `<div class="cloud-selector-label" id="${id}"><span>${headingIcons[label]}${label}</span></div>`;
}

const symbols=['','單方','複方','成方','膠囊','藥錠'];
export const tick='<span class="stock-tick" aria-hidden="true">✓</span>';
export function icon(name){
 const index=symbols.indexOf(name);
 return `<i class="stock-sprite" aria-hidden="true" style="--sprite:${100*(index<0?6:index)/6}%"></i>`;
}
export function sign(value,selected,key,esc){
 const active=value===selected;
 return `<button type="button" class="stock-sign ${value?'':'stock-all'}" data-${key}="${esc(value)}" aria-pressed="${active}"><span class="sign-face">${value?'':icon('')}<span class="stock-label">${esc(value||'全部')}</span>${active?tick:''}</span></button>`;
}
export function categoryButton(value,category,esc,enabled=true){
 const active=value===category;
 return `<button type="button" class="stock-tool" data-category="${esc(value)}" aria-pressed="${active}" ${enabled?'':'disabled'}>${icon(value)}<span class="stock-label">${esc(value)}</span>${active?tick:''}${enabled?'':'<small class="stock-trailing">未啟用</small>'}</button>`;
}
