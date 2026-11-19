const encoder = new TextEncoder();
const cookieName = '__Host-stake-session';
const json = (data, status = 200, headers = {}) => Response.json(data, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const fail = (message, status = 400) => { throw Object.assign(new Error(message), {status}); };
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2,'0')).join('');
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async value => hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
export async function passwordHash(password, salt = random()) {
 const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
 const bits = await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256);
 return `pbkdf2$100000$${salt}$${hex(bits)}`;
}
export function equal(a,b) { if(a.length !== b.length) return false; let diff=0; for(let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i); return diff===0; }
const checkPassword = value => { if(typeof value !== 'string' || value.length < 16 || value.length > 128) fail('Use a password between 16 and 128 characters.'); };
const cookie = (token, age=28800) => `${cookieName}=${token}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}`;
async function body(request) {
 if(!request.headers.get('content-type')?.startsWith('application/json')) fail('JSON required.',415);
 const raw = await request.text(); if(raw.length > 20000) fail('Request too large.',413);
 try { return JSON.parse(raw); } catch { fail('Invalid JSON.'); }
}
async function session(request, db) {
 const token = request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 if(!token || !/^[a-f0-9]{64}$/.test(token)) return null;
 return db.prepare('SELECT u.username,u.calendar_id,u.role,u.must_change FROM sessions s JOIN users u ON u.username=s.username WHERE s.token_hash=? AND s.expires>?').bind(await digest(token),Date.now()).first();
}
export function canManage(user, calendarId) { return !!user && (user.role==='stake' || user.calendar_id===calendarId); }
export function validateEvent(event) {
 for(const [field,max] of [['title',160],['place',300],['description',5000]]) if(typeof event[field]!=='string' || event[field].length>max || (field!=='description' && !event[field].trim())) fail(`Invalid ${field}.`);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(event.date) || !Number.isFinite(Date.parse(event.date+'T12:00:00Z')) || new Date(event.date+'T12:00:00Z').toISOString().slice(0,10)!==event.date) fail('Invalid date.');
 for(const field of ['startTime','endTime']) if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(event[field])) fail('Invalid time.');
 if(event.endTime<=event.startTime) fail('End time must be later than start time.');
}
async function limit(db,key,max) {
 const now=Date.now();
 const row=await db.prepare('INSERT INTO login_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<? THEN excluded.expires ELSE expires END RETURNING count').bind(key,now+900000,now,now).first();
 if(row.count>max) fail('Too many attempts. Try again in 15 minutes.',429);
}
async function api(request,env) {
 const path=new URL(request.url).pathname, method=request.method, db=env.DB;
 if(!db) return json({error:'Account service has not been configured.'},503);
 if(!['GET','HEAD'].includes(method) && request.headers.get('origin')!==new URL(request.url).origin) fail('Request origin rejected.',403);
 if(path==='/api/events' && method==='GET') return json({timezone:'America/Boise',events:(await db.prepare('SELECT id,calendarId,title,date,startTime,endTime,place,description FROM events ORDER BY date,startTime').all()).results});
 if(path==='/api/login' && method==='POST') {
  const data=await body(request); const username=String(data.username||'').toLowerCase();
  await limit(db,'ip:'+await digest(request.headers.get('CF-Connecting-IP')||'unknown'),40);
  await limit(db,'user:'+await digest(username),10);
  if(typeof data.password!=='string' || data.password.length>128) fail('Invalid username or password.',401);
  const user=await db.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
  const salt=user?.password_hash?.split('$')[2]||'unconfigured-account-dummy-salt';
  const candidate=await passwordHash(data.password,salt);
  if(!user?.password_hash || !equal(candidate,user.password_hash)) fail('Invalid username or password.',401);
  const token=random();
  await db.batch([db.prepare('DELETE FROM sessions WHERE expires<?').bind(Date.now()),db.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await digest(token),username,Date.now()+28800000)]);
  return json({user:{username,role:user.role,calendarId:user.calendar_id,mustChange:!!user.must_change}},200,{'Set-Cookie':cookie(token)});
 }
 // Initial Stake setup requires a private Cloudflare secret; no public registration.
 if(path==='/api/setup' && method==='POST') {
  if(!env.SETUP_TOKEN || !equal(request.headers.get('authorization')||'',`Bearer ${env.SETUP_TOKEN}`)) fail('Setup unavailable.',403);
  const {password}=await body(request); checkPassword(password);
  const result=await db.prepare("UPDATE users SET password_hash=?,must_change=0 WHERE username='stake' AND password_hash IS NULL").bind(await passwordHash(password)).run();
  if(!result.meta.changes) fail('Stake account is already initialized.',409);
  return json({ok:true});
 }
 const user=await session(request,db);
 if(path==='/api/me' && method==='GET') return json({user:user?{username:user.username,role:user.role,calendarId:user.calendar_id,mustChange:!!user.must_change}:null});
 if(!user) fail('Please sign in.',401);
 if(path==='/api/logout' && method==='POST') {
  await db.prepare('DELETE FROM sessions WHERE username=?').bind(user.username).run();
  return json({ok:true},200,{'Set-Cookie':cookie('',0)});
 }
 if(path==='/api/password' && method==='POST') {
  const {password}=await body(request); checkPassword(password);
  await db.batch([db.prepare('UPDATE users SET password_hash=?,must_change=0 WHERE username=?').bind(await passwordHash(password),user.username),db.prepare('DELETE FROM sessions WHERE username=?').bind(user.username)]);
  return json({ok:true},200,{'Set-Cookie':cookie('',0)});
 }
 if(user.must_change) fail('Change your temporary password first.',403);
 if(path==='/api/accounts' && user.role==='stake') {
  if(method==='GET') return json({accounts:(await db.prepare('SELECT username,calendar_id AS calendarId,role,password_hash IS NOT NULL AS active FROM users').all()).results});
  if(method==='POST') {
   const {username,password}=await body(request); checkPassword(password);
   if(username==='stake') fail('Use Change password for your own account.');
   const result=await db.batch([db.prepare("UPDATE users SET password_hash=?,must_change=1 WHERE username=? AND role='ward'").bind(await passwordHash(password),username),db.prepare('DELETE FROM sessions WHERE username=?').bind(username)]);
   if(!result[0].meta.changes) fail('Unknown account.',404);
   return json({ok:true});
  }
 }
 if(path==='/api/events' && method==='POST') {
  const event=await body(request); validateEvent(event);
  if(!canManage(user,event.calendarId)) fail('You can only manage your own ward.',403);
  if(!await db.prepare('SELECT username FROM users WHERE calendar_id=?').bind(event.calendarId).first()) fail('Unknown calendar.');
  const id=crypto.randomUUID();
  await db.prepare('INSERT INTO events(id,calendarId,title,date,startTime,endTime,place,description) VALUES(?,?,?,?,?,?,?,?)').bind(id,event.calendarId,event.title.trim(),event.date,event.startTime,event.endTime,event.place.trim(),event.description).run();
  return json({id},201);
 }
 if(path.startsWith('/api/events/') && ['PUT','DELETE'].includes(method)) {
  const id=decodeURIComponent(path.slice('/api/events/'.length));
  const existing=await db.prepare('SELECT calendarId FROM events WHERE id=?').bind(id).first();
  if(!existing) fail('Event not found.',404);
  if(!canManage(user,existing.calendarId)) fail('You can only manage your own ward.',403);
  if(method==='DELETE') await db.prepare('DELETE FROM events WHERE id=?').bind(id).run();
  else {
   const event=await body(request); validateEvent(event);
   if(!canManage(user,event.calendarId)) fail('You can only manage your own ward.',403);
   if(!await db.prepare('SELECT username FROM users WHERE calendar_id=?').bind(event.calendarId).first()) fail('Unknown calendar.');
   await db.prepare('UPDATE events SET calendarId=?,title=?,date=?,startTime=?,endTime=?,place=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(event.calendarId,event.title.trim(),event.date,event.startTime,event.endTime,event.place.trim(),event.description,id).run();
  }
  return json({ok:true});
 }
 fail('Not found.',404);
}
export default {async fetch(request,env) {
 try { if(new URL(request.url).pathname.startsWith('/api/')) return await api(request,env); return env.ASSETS.fetch(request); }
 catch(error) { if(!error.status) console.error('Calendar API failure'); return json({error:error.status?error.message:'The service is unavailable. Please try again.'},error.status||503); }
}};
