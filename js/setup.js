const form=document.getElementById('setup'), message=document.getElementById('message');
form.addEventListener('submit',async event=>{
 event.preventDefault();
 const data=Object.fromEntries(new FormData(form));
 if(data.password!==data.confirmation){message.textContent='Passwords do not match.';return;}
 const button=form.querySelector('button');button.disabled=true;
 try {
  const response=await fetch('/api/setup',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.token},body:JSON.stringify({password:data.password})});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'Setup failed.');
  form.reset();form.hidden=true;
  message.textContent='Stake password created. Sign in as stake. Remove SETUP_TOKEN from Cloudflare runtime secrets and build secrets after setup.';
 }catch(error){message.textContent=error.message;}finally{button.disabled=false;}
});
