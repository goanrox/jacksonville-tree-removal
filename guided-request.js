(function(){
 'use strict';
 document.querySelectorAll('[data-guided-form]').forEach(function(form){
  var steps=Array.from(form.querySelectorAll('[data-step]')), current=0;
  var next=form.querySelector('[data-next]'),back=form.querySelector('[data-back]'),send=form.querySelector('[type=submit]');
  var indicator=form.querySelector('.step-indicator');
  var milestones=Array.from(indicator.querySelectorAll('.milestone'));
  var reassure=['Step 1 of 3 · Pick what looks closest — you’re on your way.',
                'Step 2 of 3 · Where’s the property? Almost there.',
                'Step 3 of 3 · How can we reach you? Help is on the way.'];
  var error=form.querySelector('.form-error');
  var phone=form.elements.phone;
  function validatePhone(){var n=phone.value.replace(/\D/g,'');phone.setCustomValidity(n.length>=10&&n.length<=15?'':'Please enter a phone number with 10 to 15 digits.');}
  phone.addEventListener('input',function(){phone.setCustomValidity('');});
  function validStep(index){
   if(index===2)validatePhone();
   var fields=Array.from(steps[index].querySelectorAll('input,textarea,select'));
   var invalid=fields.find(function(field){return !field.checkValidity();});
   if(invalid){error.textContent=index===0?'Choose the closest match, or select “Help me find a starting point.”':'Please check the highlighted field before continuing.';
    invalid.focus();invalid.reportValidity();return false;}
   error.textContent='';return true;
  }
  function summary(){
   var chosen=form.querySelector('input[name=service]:checked');
   form.querySelector('[data-summary]').textContent=(chosen?chosen.value:'No service selected')+'\n'+form.elements.address.value+(form.elements.details.value?'\n'+form.elements.details.value:'');
  }
  function show(index,focus){
   current=index;
   steps.forEach(function(step,i){step.hidden=i!==index;});
   next.hidden=index===2;back.hidden=index===0;send.hidden=index!==2;
   indicator.querySelector('[data-step-status]').textContent=reassure[index];
   milestones.forEach(function(ms,i){
    ms.classList.toggle('is-active',i===index);
    ms.classList.toggle('is-done',i<index);
    if(i===index)ms.querySelector('.milestone-dot').setAttribute('aria-current','step');
    else ms.querySelector('.milestone-dot').removeAttribute('aria-current');
   });
   if(index===2)summary();
   if(focus){var legend=steps[index].querySelector('legend');legend.tabIndex=-1;legend.focus({preventScroll:true});form.closest('.request-shell').scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
  }
  // Only a known service from the referring page can be preselected. Never prefill consent or personal data.
  var prefill=new URLSearchParams(window.location.search).get('service');
  if(!prefill&&window.location.pathname==='/tree-removal.html')prefill='Full tree removal';
  if(!prefill&&window.location.pathname==='/emergency-storm-tree-removal.html')prefill='Non-emergency storm damage';
  var selected=Array.from(form.querySelectorAll('[name=service]')).find(function(r){return r.value===prefill;});
  if(selected)selected.checked=true;
  form.querySelectorAll('[data-town]').forEach(function(button){button.addEventListener('click',function(){
   var address=form.elements.address;
   // Town shortcuts fill an empty location or replace another town shortcut, never a typed street address.
   var towns=Array.from(form.querySelectorAll('[data-town]')).map(function(b){return b.dataset.town;});
   if(!address.value.trim()||towns.includes(address.value))address.value=button.dataset.town;
   else {error.textContent='Your typed address is kept. Edit the location field if you want to change it.';}
   address.focus();
  });});
  next.addEventListener('click',function(){if(validStep(current))show(current+1,true);});
  back.addEventListener('click',function(){error.textContent='';show(current-1,true);});
  form.querySelector('[data-edit]').addEventListener('click',function(){show(0,true);});
  form.addEventListener('submit',function(event){
   if(current<2){event.preventDefault();event.stopImmediatePropagation();if(validStep(current))show(current+1,true);return;}
   for(var i=0;i<3;i++){show(i,false);if(!validStep(i)){event.preventDefault();event.stopImmediatePropagation();show(i,true);return;}}
  },true);
  // Native validation remains available without JS; JS validates the visible step and the full request before POST.
  form.noValidate=true;indicator.hidden=false;form.querySelector('.request-summary').hidden=false;show(0,false);
 });
})();
