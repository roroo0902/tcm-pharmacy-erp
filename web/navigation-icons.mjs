// Inline paths also work inside the cross-origin Apps Script shell.
const icons={"cloud": "<path d=\"m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15M15 6v15\"/>", "overview": "<path d=\"M3 9h18v11H3V9Zm2 0V4h14v5M3 14h18M10 12h4v4h-4Z\"/>", "orders": "<path d=\"M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6M9 16h3\"/>", "receive": "<path d=\"M3 15v6h18v-6M12 3v13m-5-5 5 5 5-5\"/>", "loss": "<path d=\"M9 3h6M10 3v6l-5 9q-1 3 3 3h8q4 0 3-3l-5-9V3M8 15h8M10 18h4\"/>", "history": "<path d=\"M4 4h7q1 0 1 2v15q0-2-2-2H4V4Zm16 0h-7q-1 0-1 2v15q0-2 2-2h6V4ZM7 8h2M7 12h2M15 8h2M15 12h2\"/>", "items": "<path d=\"M12 21V9M12 15C4 16 3 11 3 6c6 0 9 3 9 9Zm0-4c0-5 3-8 9-8 0 6-3 9-9 8Z\"/>", "backup": "<path d=\"M4 3h13l3 3v15H4V3Zm4 0v7h8V3M8 21v-7h8v7M13 5v3\"/>", "photoReceive": "<path d=\"M3 15v6h18v-6M12 3v13m-5-5 5 5 5-5\"/>"};
export function restoreNavigationIcons(root=document){
 for(const link of root.querySelectorAll("nav a")){
  const icon=icons[link.getAttribute("href")?.replace(/^#/,"")];
  if(!icon)continue;
  const svg=link.querySelector("svg");
  if(svg){if(svg.querySelector("use")){svg.setAttribute("viewBox","0 0 24 24");svg.innerHTML=icon;}}
  else link.insertAdjacentHTML("afterbegin",`<svg aria-hidden="true" viewBox="0 0 24 24">${icon}</svg>`);
 }
}
