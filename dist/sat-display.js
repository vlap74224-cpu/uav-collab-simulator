/* Cumulative SAT visibility. Business data and decision clocks stay intact. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SatDisplay=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const modes=Object.freeze(['l1','l12','l123']);
 const labels=Object.freeze({l1:'仅 L1',l12:'L1＋L2',l123:'L1＋L2＋L3'});
 const normalize=value=>modes.includes(value)?value:'l123';
 function visible(level,mode){mode=normalize(mode);return level==='action'||level==='reason'&&mode!=='l1'||level==='projection'&&mode==='l123';}
 function apply(root,mode){
  mode=normalize(mode);const body=root.body||root;
  body.setAttribute('data-sat-display',mode);
  for(const section of root.querySelectorAll('[data-level]')){
   const level=section.getAttribute('data-level');if(!['action','reason','projection'].includes(level))continue;
   const shown=visible(level,mode);section.hidden=!shown;section.setAttribute('aria-hidden',String(!shown));
  }
  for(const button of root.querySelectorAll('[data-sat-display-mode]'))button.setAttribute('aria-pressed',String(button.getAttribute('data-sat-display-mode')===mode));
  const label=root.querySelectorAll('#satDisplayLabel')[0];if(label){label.textContent=labels[mode];label.setAttribute('aria-label','AI信息显示层级：'+labels[mode]);}
  return mode;
 }
 function bind(root,onChange){
  const picker=root.querySelectorAll('#satDisplayControls')[0],label=root.querySelectorAll('#satDisplayLabel')[0];
  for(const button of root.querySelectorAll('[data-sat-display-mode]'))button.addEventListener('click',()=>{onChange(normalize(button.getAttribute('data-sat-display-mode')));if(picker)picker.open=false;label?.focus?.();});
  root.addEventListener?.('click',event=>{if(!picker?.open)return;for(let node=event.target;node;node=node.parentElement)if(node===picker)return;picker.open=false;});
  root.addEventListener?.('keydown',event=>{if(event.key==='Escape'&&picker?.open){picker.open=false;event.preventDefault();label?.focus?.();}});
 }
 return Object.freeze({modes,labels,normalize,visible,apply,bind});
});
