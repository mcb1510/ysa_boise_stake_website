const $=id=>document.getElementById(id);
let user, wards=[], events=[];
const tell=(text,error=false)=>{$('message').textContent=text;$('message').classList.toggle('error',error);};
async function api(path,method='GET',data) {
 const response=await fetch('/api/'+path,{method,headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
 let value;try{value=await response.json();}catch{throw new Error('The account service is not activated yet.');}
 if(!response.ok)throw new Error(value.error||'Request failed.');return value;
}
function busy(form,action){form.addEventListener('submit',async e=>{e.preventDefault();const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{await action(Object.fromEntries(new FormData(form)));}catch(error){tell(error.message,true);}finally{buttons.forEach(b=>b.disabled=false);}});}
function clear(){ $('eventForm').reset();$('formTitle').textContent='Add event';if(user?.role==='ward')$('calendarSelect').value=user.calendarId; }
async function loadEvents(){events=(await api('events')).events;const list=$('eventList');list.replaceChildren();for(const event of events.filter(e=>user.role==='stake'||e.calendarId===user.calendarId)){
 const card=document.createElement('article');card.className='item';const title=document.createElement('strong');title.textContent=event.title;const info=document.createElement('p');info.textContent=`${event.date} · ${event.startTime}–${event.endTime} · ${wards.find(w=>w.id===event.calendarId)?.name||event.calendarId}`;const edit=document.createElement('button');edit.textContent='Edit';edit.onclick=()=>{for(const [name,value]of Object.entries(event)){const input=$('eventForm').elements.namedItem(name);if(input)input.value=value;}$('formTitle').textContent='Edit event';$('eventForm').scrollIntoView({behavior:'smooth'});};const remove=document.createElement('button');remove.textContent='Delete';remove.onclick=async()=>{if(!confirm(`Delete “${event.title}”?`))return;remove.disabled=true;try{await api('events/'+encodeURIComponent(event.id),'DELETE');clear();await loadEvents();tell('Event deleted.');}catch(e){tell(e.message,true);}finally{remove.disabled=false;}};const row=document.createElement('div');row.className='row';row.append(edit,remove);card.append(title,info,row);list.append(card);
 }if(!list.children.length)list.textContent='No events yet.';}
async function refresh(){
 user=(await api('me')).user;$('login').hidden=!!user;$('logout').hidden=!user;$('signedIn').hidden=!user;if(!user){$('identity').textContent='Sign in to manage your ward’s events.';return;}
 $('identity').textContent=`Signed in as ${user.username}`;$('editor').hidden=user.mustChange;$('accounts').hidden=user.role!=='stake'||user.mustChange;
 $('passwordPanel').open=user.mustChange;if(user.mustChange){tell('Choose your own password before editing events.');return;}
 wards=await fetch('data/wards.json').then(r=>r.json());$('calendarSelect').replaceChildren();for(const ward of wards.filter(w=>user.role==='stake'||w.id===user.calendarId)){$('calendarSelect').add(new Option(ward.name,ward.id));}
 if(user.role==='stake'){const {accounts}=await api('accounts');$('accountSelect').replaceChildren();for(const account of accounts.filter(a=>a.role==='ward'))$('accountSelect').add(new Option(`${account.username} (${account.active?'active':'not set up'})`,account.username));}
 clear();await loadEvents();
}
busy($('login'),async data=>{await api('login','POST',data);$('login').reset();tell('Signed in.');await refresh();});
busy($('password'),async data=>{if(data.password!==data.confirmation)throw new Error('Passwords do not match.');await api('password','POST',{password:data.password});$('password').reset();await refresh();tell('Password updated. Sign in with your new password.');});
busy($('eventForm'),async data=>{const id=data.id;delete data.id;await api(id?'events/'+encodeURIComponent(id):'events',id?'PUT':'POST',data);clear();await loadEvents();tell('Event saved.');});
busy($('accountForm'),async data=>{await api('accounts','POST',data);$('accountForm').reset();await refresh();tell('Temporary password set. Share it privately with that ward editor.');});
$('cancel').onclick=clear;$('logout').onclick=async()=>{try{await api('logout','POST');await refresh();tell('Signed out.');}catch(e){tell(e.message,true);}};
refresh().catch(e=>tell(e.message,true));
