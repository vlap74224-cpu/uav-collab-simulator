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
  return mode;
 }
 function bind(root,onChange){for(const button of root.querySelectorAll('[data-sat-display-mode]'))button.addEventListener('click',()=>onChange(normalize(button.getAttribute('data-sat-display-mode'))));}
 return Object.freeze({modes,labels,normalize,visible,apply,bind});
});
