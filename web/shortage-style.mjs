export const shortageStyle = `<style>
dialog:has(#shortage-edit), dialog:has(#sub-edit), dialog:has(#allocation-edit) {
  width: min(960px, 94vw); max-width: 960px; max-height: 88vh; overflow: auto;
  background: #fffdf4; color: #24445a;
}
dialog:has(#sub-edit) label, dialog:has(#shortage-edit) label, dialog:has(#allocation-edit) label { color: #24445a }
.sub-picker { min-width: 0; margin: 0; padding: 14px; border: 1px solid #d1bd8f; border-radius: 8px }
.sub-picker legend { padding: 0 6px; font-weight: 600 }
.sub-picker label { margin-bottom: 12px }
.sub-picker select { width: 100%; min-width: 0 }
.sub-picker small { display: block; line-height: 1.6 }
.shortage-alchemist { display: block; width: 160px; height: 160px; object-fit: contain; margin: 0 auto 12px }
.shortage-illustration { padding-block: 14px; text-align: center }

.shortage-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px }
.shortage-cards { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 12px; margin: 16px 0 20px }
#content .shortage-cards > button {
  position: relative; display: flex; justify-content: center; align-items: center; gap: clamp(8px,1vw,18px);
  padding: 16px 12px; min-width: 0; min-height: 108px; text-align: start; background: var(--quest-paper);
  color: var(--quest-ink); border: 1px solid #cfb889; line-height: 1.35;
}
.shortage-cards img { flex: none; width: clamp(56px,5vw,80px); height: 60px; object-fit: contain; image-rendering: pixelated }
.sh-metric-copy { display: grid; min-width: 0; gap: 3px; border-inline-start: 1px solid #bfaa7e; padding-inline-start: clamp(6px,1vw,16px); font-size: clamp(1rem,1.1vw,1.2rem); font-weight: 700 }
.sh-metric-value { font-size: .9rem; white-space: nowrap }
.sh-metric-value strong { margin-inline-end: .15em; font-size: clamp(1.8rem,2.3vw,2.4rem); line-height: 1.1 }
.shortage-cards button:disabled .sh-metric-value { white-space: normal; overflow-wrap: anywhere }
#content .shortage-cards button:disabled .sh-metric-value strong { margin: 0; font-size: 1rem; line-height: 1.35 }
#content .shortage-cards button[aria-pressed=false]:hover:enabled {
  background: #fbf2d9; border-color: #a5813c;
}
#content .shortage-cards button[aria-pressed=true] {
  background: #142f49; color: #fff; border-color: #a88036;
  box-shadow: inset 0 0 0 3px #edc56d;
}
#content .shortage-cards button[aria-pressed=true] strong { color: inherit }
#content .shortage-cards button[aria-pressed=true]::after {
  content: '✓'; position: absolute; inset-block-start: 5px; inset-inline-end: 5px;
  display: grid; place-items: center; width: 18px; height: 18px;
  background: #ffda85; color: #142f49; border-radius: 50%; font: bold 14px/1 sans-serif;
}
.shortage-panel .panelhead { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px }
.shortage-panel .panelhead h2 { margin: 0; text-align: left }
.shortage-panel .panelhead .actions { margin: 0 }
.shortage-filters { display: grid; grid-template-columns: minmax(0,1.5fr) repeat(3,minmax(0,1fr)); gap: 10px; margin-block: 16px }
#content .shortage-filters > * { min-width: 0; width: 100%; margin: 0 }
.shortage-section { margin: 12px 0; border: 1px solid #d6c8ab; border-radius: 6px; background: var(--quest-paper) }
.shortage-section > summary { cursor: pointer; padding: 10px 15px; font-weight: 700; color: #213b57; background: #f4eedf; border-radius: 5px }
.shortage-section[open] > summary { border-bottom: 1px solid #d6c8ab; border-radius: 5px 5px 0 0 }
.shortage-row {
  display: grid; grid-template-columns: minmax(0,1.15fr) minmax(0,.8fr) minmax(0,1.15fr) minmax(0,1.35fr);
  align-items: center; gap: 14px; padding: 14px 16px; border-bottom: 1px solid #ded5c2; text-align: left;
}
.shortage-row:last-child { border-bottom: 0; border-radius: 0 0 6px 6px }
.shortage-row > * { min-width: 0; overflow-wrap: anywhere }
.shortage-row small { display: block; line-height: 1.55 }
.sh-item b, .sh-progress strong { color: #203b55 }
.sh-item .check-label { display: flex; align-items: center; gap: 8px; margin: 0 }
.sh-item .check-label input { margin: 0 }
.sh-progress, .sh-stock { font-variant-numeric: tabular-nums }
.sh-actions { display: flex; align-items: flex-start; justify-content: flex-end; flex-wrap: wrap; gap: 8px }
.sh-actions button, .sh-more summary { min-height: 38px; padding: 8px 12px; margin: 0; font-size: 13px }
.sh-more { min-width: 0 }
.sh-more summary {
  cursor: pointer; padding: 8px 12px; background: #f0ead9; color: #39516a; border: 1px solid #c4b792;
  border-radius: 5px; box-shadow: 0 2px 0 #b7ae99; font-weight: 600;
}
.sh-more summary:hover { background: #e7ddc5 }
.sh-more[open] { flex: 1 1 100% }
.sh-more[open] button { margin: 6px 4px 0 0 }
.shortage-panel summary:focus-visible { outline: 3px solid #cda95f; outline-offset: 2px }
.sh-batch { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 16px }
@media (max-width: 1150px) {
  .shortage-row { grid-template-columns: repeat(3,minmax(0,1fr)) }
  .shortage-row .sh-actions { grid-column: 1/-1; justify-content: flex-start }
}
@media (max-width: 1050px) {
  .shortage-cards { grid-template-columns: repeat(2,minmax(0,1fr)) }
}
@media (max-width: 760px) {
  .shortage-cards { gap: 8px }
  .shortage-filters { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px }
  .shortage-row { grid-template-columns: repeat(2,minmax(0,1fr)); padding: 12px; gap: 8px }
  .sh-item { grid-column: 1/-1 }
  .sh-actions button, .sh-more summary { min-height: 44px }
  .shortage-tabs button { flex: 1 }
}
@media (max-width: 450px) {
  .shortage-row { font-size: 14px }
  #content .shortage-cards > button { min-height: 84px; gap: 6px; padding: 10px 6px }
  .shortage-cards img { width: 44px }
  .sh-metric-copy { font-size: .875rem }
  .sh-batch button { width: 100% }
}
</style>`;
