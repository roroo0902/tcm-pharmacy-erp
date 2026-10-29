// Blank means untouched; loss zero is an explicit correction, not a cleared field.
export function adjustedQuantity(value,delta,{min=0,max=1000000,base=0}={}){
 if(value===''&&delta<0&&min>0)return '';
 const n=value===''?base:Number(value);
 if(!Number.isInteger(n)||n<0||n>max)return value;
 return String(Math.min(max,Math.max(min,n+delta)));
}
export function quantitySteppers(root,selector,{base=()=>0}={}){
 if(!document.getElementById('quantity-stepper-style')){
  const style=document.createElement('style');style.id='quantity-stepper-style';
  style.textContent=`.quantity-stepper{display:grid;grid-template-columns:44px minmax(78px,1fr) 44px;gap:8px;align-items:center;width:224px;max-width:100%;text-align:center}.quantity-stepper input{width:100%!important;min-width:0!important;max-width:none!important;text-align:center!important;margin:0;font-size:18px;font-weight:700;min-height:48px;appearance:textfield}.quantity-stepper input::-webkit-inner-spin-button,.quantity-stepper input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.quantity-stepper .quantity-adjust{padding:0;min-width:44px;min-height:48px;font-size:27px;line-height:1;background:#d9b969;color:#14283f;border:1px solid #b89a54;border-radius:9px;box-shadow:0 3px 0 #a58b50}.quantity-stepper .quantity-clear{grid-column:1/-1;justify-self:start;min-height:44px;padding:4px 8px;background:transparent;color:inherit;box-shadow:none;border:0;text-decoration:underline;font-size:14px}.quantity-stepper button:disabled{opacity:.45}.quantity-stepper:focus-within{outline:2px solid #b89a54;outline-offset:3px;border-radius:8px}`;
  document.head.append(style);
 }
 root.querySelectorAll(selector).forEach(input=>{
  if(input.closest('.quantity-stepper'))return;
  const group=document.createElement('div');group.className='quantity-stepper';
  const label=input.getAttribute('aria-label')||'瓶數';
  input.before(group);group.append(input);
  const set=value=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};
  const button=(text,name,action,css)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.className=css;b.setAttribute('aria-label',label+' '+name);b.onclick=()=>{if(!input.disabled&&!input.readOnly)action();};return b;};
  const change=delta=>set(adjustedQuantity(input.value,delta,{min:Number(input.min||0),max:Number(input.max||1000000),base:base(input)}));
  const minus=button('−','減少一瓶',()=>change(-1),'quantity-adjust');
  const plus=button('＋','增加一瓶',()=>change(1),'quantity-adjust');
  const clear=button('清除','清除輸入',()=>set(''),'quantity-clear');
  group.prepend(minus);group.append(plus,clear);
 });
}
