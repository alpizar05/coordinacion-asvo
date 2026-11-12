import test from 'node:test';import assert from 'node:assert/strict';
import {createNavigationStore} from '../../lib/navigation-store.ts';
import {navigationStoreKey,navigationLifetime} from '../../lib/navigation-context.ts';
import {id,frame,context,MemoryStorage} from './fixtures.mjs';
test('keys separate users, escape keys and preserve path/criteria separation',()=>{
 assert.notEqual(navigationStoreKey('a'),navigationStoreKey('b'));assert.match(navigationStoreKey('a:b'),/a%3Ab$/);
 const storage=new MemoryStorage(),store=createNavigationStore('a',()=>storage,()=>1_000_000);store.save(id(1),context());store.save(id(2),context(1_000_000,{frames:[frame(2,{destination:'/coordinacion/inscripciones?estado=confirmada'})]}));assert.notDeepEqual(store.read(id(1)),store.read(id(2)));
 assert.equal(createNavigationStore('b',()=>storage,()=>1_000_000).read(id(1)),null);
});
test('reload reads metadata without retaining arbitrary data or mutable references',()=>{
 const storage=new MemoryStorage(),store=createNavigationStore('a',()=>storage,()=>1_000_000);store.save(id(1),{...context(),email:'sensitive@example.test',secret:'TOKEN'});
 const copy=store.read(id(1));copy.frames[0].destination='https://evil.invalid';assert.notEqual(store.read(id(1)).frames[0].destination,copy.frames[0].destination);
 const serialized=storage.getItem(store.key);assert.ok(!serialized.includes('TOKEN'));assert.ok(!serialized.includes('sensitive@'));
 assert.deepEqual(createNavigationStore('a',()=>storage,()=>1_000_000).read(id(1)),context());
});
test('free searches remain in memory, including searches entered as email or identification',()=>{
 for(const [path,key]of [['/coordinacion/registro','buscar'],['/coordinacion/convocatorias','salidaBuscar'],['/coordinacion/convocatorias','serieBuscar']])for(const search of ['Ana','603710817','persona@example.test']){
  const storage=new MemoryStorage(),store=createNavigationStore('a',()=>storage,()=>1_000_000);
  store.save(id(1),context(1_000_000,{frames:[frame(1,{destination:path+'?'+key+'='+encodeURIComponent(search)})]}));
  assert.ok(store.read(id(1)));assert.equal(storage.getItem(store.key),'{}');
  assert.equal(createNavigationStore('a',()=>storage,()=>1_000_000).read(id(1)),null);
 }
});
test('expiration, logout, subject change and the twenty-context bound clean storage',()=>{
 let now=1_000_000;const storage=new MemoryStorage(),store=createNavigationStore('a',()=>storage,()=>now);
 for(let n=1;n<=21;n++)store.save(id(n),context(now++));assert.equal(store.read(id(1)),null);assert.ok(store.read(id(21)));
 now+=navigationLifetime;store.purge();assert.equal(storage.getItem(store.key),'{}');
 now=1_000_000;store.save(id(1),context());const other=createNavigationStore('b',()=>storage,()=>now);other.activate();assert.equal(storage.getItem(store.key),null);
 other.save(id(1),context());other.clear();assert.equal(other.read(id(1)),null);
});
test('malformed storage, invalid keys, unavailable storage and quotas fail safely',()=>{
 const storage=new MemoryStorage(),store=createNavigationStore('a',()=>storage,()=>1_000_000);storage.setItem(store.key,'broken');assert.equal(store.read(id(1)),null);
 for(const value of ['[]','null']){storage.setItem(store.key,value);assert.equal(store.read(id(1)),null);}
 store.save('token',context());assert.equal(store.read('token'),null);
 const quota=new MemoryStorage();quota.setItem=()=>{throw Error('quota');};const quotaStore=createNavigationStore('a',()=>quota,()=>1_000_000);quotaStore.save(id(1),context());assert.ok(quotaStore.read(id(1)));
 const unavailable=createNavigationStore('a',()=>{throw Error('denied');},()=>1_000_000);unavailable.save(id(1),context());assert.ok(unavailable.read(id(1)));unavailable.clear();assert.equal(unavailable.read(id(1)),null);
});
