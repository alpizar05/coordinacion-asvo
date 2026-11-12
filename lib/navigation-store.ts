import {cleanNavigationContext,navigationContextPersistable,navigationStoreKey,navigationStorePrefix,type ListContext} from './navigation-context';

type StorageLike=Pick<Storage,'getItem'|'setItem'|'removeItem'|'key'|'length'>;
const contextId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** No browser/global access until called; unit tests inject storage and a clock. */
export function createNavigationStore(subject:string,getStorage:()=>StorageLike,now=()=>Date.now()){
  const key=navigationStoreKey(subject);
  let memory:Record<string,ListContext>={};
  function load(){
    let disk:Record<string,unknown>={};
    try{const value=JSON.parse(getStorage().getItem(key)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))disk=value;}catch{}
    const result:Record<string,ListContext>={};
    for(const [id,value]of Object.entries({...disk,...memory})){
      const clean=cleanNavigationContext(value,now());if(contextId.test(id)&&clean)result[id]=clean;
    }
    memory=Object.fromEntries(Object.entries(result).sort((a,b)=>a[1].time-b[1].time).slice(-20));
    return memory;
  }
  function write(){try{getStorage().setItem(key,JSON.stringify(Object.fromEntries(Object.entries(memory).filter(([,value])=>navigationContextPersistable(value)))));}catch{}}
  return {
    key,
    read(id:string){if(!contextId.test(id))return null;load();write();return cleanNavigationContext(memory[id],now());},
    save(id:string,value:unknown){if(!contextId.test(id))return;load();delete memory[id];const clean=cleanNavigationContext(value,now());if(clean)memory[id]=clean;memory=Object.fromEntries(Object.entries(memory).slice(-20));write();},
    purge(){load();write();},
    activate(){try{const storage=getStorage(),keys=Array.from({length:storage.length},(_,i)=>storage.key(i));for(const existing of keys)if(existing?.startsWith('asvo:list-context:')&&existing!==key)storage.removeItem(existing);}catch{}load();write();},
    clear(){memory={};try{getStorage().removeItem(key);}catch{}},
  };
}
