import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../worker/index.mjs';

function environment(){const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../migrations/0001_calendar.sql',import.meta.url),'utf8'));return {SETUP_TOKEN:'private-test-setup-token',DB:{prepare(sql){let values=[];return {bind(...args){values=args;return this;},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){const r=sqlite.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)}};}};},async batch(statements){sqlite.exec('BEGIN');try{const results=await Promise.all(statements.map(s=>s.run()));sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};}
const password='a long unique test password';
async function call(env,path,method='GET',data,session='',extra={}){return worker.fetch(new Request('https://stake.test/api/'+path,{method,headers:{Origin:'https://stake.test','Content-Type':'application/json',Cookie:session,...extra},body:data?JSON.stringify(data):undefined}),env);}
async function login(env,username,pass=password){const r=await call(env,'login','POST',{username,password:pass});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
const event={calendarId:'table-rock',title:'Dinner',date:'2026-12-05',startTime:'18:00',endTime:'20:00',place:'Chapel',description:'Everyone welcome.'};
test('setup, ward ownership, Stake management, sessions and password resets',async()=>{
 const env=environment();
 assert.equal((await call(env,'events','POST',event)).status,401);
 assert.equal((await call(env,'setup','POST',{password})).status,403);
 assert.equal((await call(env,'setup','POST',{password},'',{Authorization:'Bearer '+env.SETUP_TOKEN})).status,200);
 assert.equal((await call(env,'setup','POST',{password},'',{Authorization:'Bearer '+env.SETUP_TOKEN})).status,409);
 const stake=await login(env,'stake');
 assert.equal((await call(env,'accounts','POST',{username:'table-rock',password},stake)).status,200);
 let ward=await login(env,'table-rock');
 assert.equal((await call(env,'events','POST',event,ward)).status,403);
 assert.equal((await call(env,'password','POST',{password:password+' changed'},ward)).status,200);
 assert.equal((await call(env,'events','POST',event,ward)).status,401);
 ward=await login(env,'table-rock',password+' changed');
 const created=await call(env,'events','POST',event,ward);assert.equal(created.status,201);const {id}=await created.json();
 assert.equal((await call(env,'events','POST',{...event,calendarId:'overland'},ward)).status,403);
 assert.equal((await call(env,'events/'+id,'PUT',{...event,calendarId:'overland'},ward)).status,403);
 assert.equal((await call(env,'accounts','GET',null,ward)).status,404);
 assert.equal((await call(env,'events/'+id,'PUT',{...event,calendarId:'overland'},stake)).status,200);
 assert.equal((await call(env,'events/'+id,'DELETE',null,ward)).status,403);
 assert.equal((await call(env,'events/'+id,'DELETE',null,stake)).status,200);
 assert.equal((await call(env,'accounts','POST',{username:'table-rock',password},stake)).status,200);
 assert.equal((await call(env,'events','POST',event,ward)).status,401);
 assert.equal((await call(env,'events','POST',{...event,date:'2026-02-30'},stake)).status,400);
 assert.equal((await call(env,'events','POST',event,stake,{Origin:'https://evil.test'})).status,403);
 assert.equal((await call(env,'logout','POST',null,stake)).status,200);
 assert.equal((await call(env,'events','POST',event,stake)).status,401);
});
test('login attempts are throttled and unavailable service fails closed',async()=>{
 const env=environment();for(let i=0;i<10;i++)assert.equal((await call(env,'login','POST',{username:'unknown',password})).status,401);
 assert.equal((await call(env,'login','POST',{username:'unknown',password})).status,429);
 assert.equal((await call({},'me')).status,503);
});
