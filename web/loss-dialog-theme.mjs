// Both dialogs are also used in the Apps Script host, which loads the bundled module.
export const lossDialogTheme = `
:is(#loss-slips,#loss-check-result){box-sizing:border-box;width:min(650px,94vw);max-height:90dvh;overflow:auto;padding:clamp(14px,3vw,26px);background:linear-gradient(145deg,#172e46,#0a2036);color:#fff3d4;border:5px double #efc767;border-radius:3px;box-shadow:0 5px 0 #09192a,0 16px 45px #09192a66;color-scheme:dark}
:is(#loss-slips,#loss-check-result)::backdrop{background:#102033a8}
:is(#loss-slips,#loss-check-result) button:focus-visible{outline:3px solid white;outline-offset:2px}
#loss-slips footer{grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-flow:row;align-items:stretch}
#loss-slips footer button{display:grid;grid-template-rows:40px 1fr;align-items:center;justify-items:center;gap:6px;padding:10px 3px;line-height:1.4;text-align:center}
#loss-slips footer img{height:40px;width:58px;object-fit:contain;image-rendering:pixelated}
#loss-slips #slip-remove-help{margin:14px 0 0;padding-top:10px;border-top:1px solid #aa905f;text-align:center;color:#efdbb0;font-size:.9em}
#loss-slips [role=status]{margin:12px 0 0;line-height:1.5;color:#fff3d4}
#loss-check-result{width:min(460px,94vw)}
#loss-check-result header{display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:2px solid #eac474;font-size:1.15em;font-weight:bold;color:#ffe2a0}
#loss-check-result header img{width:32px;height:30px;object-fit:contain;image-rendering:pixelated}
#loss-check-result .loss-outcome{display:flex;align-items:center;gap:18px;margin:18px 0}
#loss-check-result .loss-outcome img{width:clamp(64px,19vw,112px);height:76px;object-fit:contain;image-rendering:pixelated}
#loss-check-result .loss-outcome div{border-left:1px solid #d4ac64;padding-left:16px;overflow-wrap:anywhere}
#loss-check-result h2{margin:0;padding:0;color:#ffe5a0;font-size:1.55rem;border:0}
#loss-check-result h2::before{content:none}
#loss-check-result .loss-context{margin:4px 0 0;color:#efe2c7}
#loss-check-detail{border-block:1px solid #bca16d;padding:14px 0;line-height:1.6;color:#fff3d4;margin:0;font-size:1.08em}
#loss-check-result details{margin-top:10px;overflow-wrap:anywhere}
#loss-check-result button{display:block;margin:16px auto 0;min-width:118px;min-height:44px;background:#19334e;color:#fff1d0;border:2px solid #dfb75d;box-shadow:0 3px 0 #805b28}
#loss-check-result button:hover{background:#274968}
`;
