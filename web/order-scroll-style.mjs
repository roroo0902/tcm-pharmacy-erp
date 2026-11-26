// Styles are embedded in the editor so the hosted and module entry points share the same scrolls.
export const orderScrollStyle = `
.pdf-editor details[data-section] {
  --roll-paper: linear-gradient(180deg, #a57232 0%, #e9bb65 5%, #fff4cd 17%, #fff6d9 37%, #f9e8b5 65%, #e6c68d 82%, #c79a50 93%, #9c692d 100%);
  --rod: linear-gradient(180deg, #74451e, #d29b4c 22%, #a9672b 45%, #71401f 76%, #4e301c);
  --ink: #172e47;
  --inset: clamp(10px, 2vw, 22px);
  position: relative;
  box-sizing: border-box;
  margin: 16px 10px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--ink);
}
.pdf-editor details[data-section] > summary {
  position: relative;
  z-index: 1;
  display: list-item;
  list-style-position: inside;
  box-sizing: border-box;
  padding: 12px 32px;
  border: 1px solid #ad7d41;
  border-radius: 14px / 48%;
  color: var(--ink);
  background: var(--roll-paper);
  box-shadow: inset 0 1px #fff3c1, inset 0 -2px #ad7c3f, 0 3px 2px #07132299;
  cursor: pointer;
  font-weight: 700;
  line-height: 1.5;
}
.pdf-editor details[data-section] > summary:focus-visible {
  outline: 3px solid #65cfff;
  outline-offset: 3px;
}
.pdf-editor details[data-section] > summary::before,
.pdf-editor details[data-section] > summary::after {
  content: "";
  position: absolute;
  pointer-events: none;
  top: -1px;
  bottom: -1px;
  width: 19px;
  border: 1px solid #95652c;
  border-radius: 50%;
  background: radial-gradient(ellipse at 58% 51%, #805025 0 8%, #edc67e 10% 19%, #aa722e 22% 26%, #ffde93 29% 40%, #bd893b 44% 49%, #fbd591 54% 64%, #cb923f 69% 73%, #f7d99a 80%);
}
.pdf-editor details[data-section] > summary::before { left: -4px; }
.pdf-editor details[data-section] > summary::after { right: -4px; transform: scaleX(-1); }
.pdf-editor details[data-section][open] {
  padding: 0 var(--inset) 30px;
  margin-bottom: 20px;
  border-inline: 1px solid #bd914e;
  border-radius: 8px;
  background: linear-gradient(90deg, #e6c995 0%, #f9eaca 2%, #fff6e2 10%, #fffaee 52%, #fcf0d5 94%, #e3bf83 100%);
  box-shadow: inset 0 0 13px #c1954d66, 0 4px 7px #06142655;
}
.pdf-editor details[data-section][open] > summary {
  margin: 0 calc(-1 * var(--inset)) 15px;
  border-radius: 7px;
}
.pdf-editor details[data-section][open] > summary::before,
.pdf-editor details[data-section][open] > summary::after {
  top: 13%;
  bottom: 13%;
  width: 9px;
  border-radius: 4px;
  background: var(--rod);
  box-shadow: inset 2px 0 #edc06c;
}
.pdf-editor details[data-section][open] > summary::before { left: -9px; }
.pdf-editor details[data-section][open] > summary::after { right: -9px; }
.pdf-editor details[data-section][open]::before,
.pdf-editor details[data-section][open]::after {
  content: "";
  position: absolute;
  border: 1px solid #966a32;
  pointer-events: none;
}
.pdf-editor details[data-section][open]::before {
  inset: auto -9px 2px;
  height: 16px;
  border-radius: 4px;
  background: var(--rod);
}
.pdf-editor details[data-section][open]::after {
  inset: auto -1px 0;
  height: 20px;
  border-radius: 5px;
  background: var(--roll-paper);
  box-shadow: inset 3px 0 #dab46b, inset -3px 0 #dab46b;
}
.pdf-editor details[data-section] .pdf-shortage-group + .pdf-shortage-group {
  border-top: 1px solid #ba9a68;
  margin-top: 16px;
  padding-top: 14px;
}
.pdf-editor details[data-section] :is(h3,h4,label,p,[role=status]) { color: var(--ink); }
.pdf-editor .pdf-shortage-group :is(h3,h4) {
  border-inline-start: 4px solid #bd9048;
  margin: 0 0 7px;
  padding-inline-start: 9px;
}
@media(max-width:600px) {
  .pdf-editor details[data-section] { margin-inline: 7px; --inset: 8px; }
  .pdf-editor details[data-section] > summary { padding-inline: 25px; }
  .pdf-editor details[data-section] > summary::before,
  .pdf-editor details[data-section] > summary::after { width: 15px; }
}
`;
