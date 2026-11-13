import {loadStore,STORE_KEY} from './model.js';

// Best-effort stale-page detection, not a lock: localStorage read + write is not
// atomic across tabs. No automatic merge, retry, deletion or baseline refresh.
export function createLearningStorage({storage,onBlocked=()=>{}}={}){
 let baseline,initial,mode='persistent',reason='',busy=false;
 try{initial=baseline=storage.getItem(STORE_KEY);}catch{mode='temporary';reason='initial-read-failed';}
 const getState=()=>Object.freeze({mode,reason});
 const error=code=>Object.assign(new Error(code),{code});
 const block=why=>{
  if(mode==='blocked')return false;
  mode='blocked';reason=why;
  // Set the terminal state before notifying, even if the owner reenters/throws.
  try{onBlocked(getState());}catch{}
  return false;
 };
 const check=()=>{
  if(mode==='blocked')return false;
  if(mode==='temporary')return true;
  try{if(storage.getItem(STORE_KEY)!==baseline)return block('changed');}
  catch{return block('read-failed');}
  return mode==='persistent';
 };
 const requireKey=key=>{if(key!==STORE_KEY)throw error('STORAGE_KEY_UNSUPPORTED');};
 const requirePersistent=()=>{
  if(mode==='temporary')throw error('STORAGE_TEMPORARY');
  if(!check())throw error('STORAGE_BLOCKED');
 };
 const facade=Object.freeze({
  getItem(key){requireKey(key);requirePersistent();return baseline;},
  setItem(key,value){
   requireKey(key);
   if(busy)throw error('STORAGE_REENTRANT');
   // No coercion callbacks between comparison and native write.
   if(typeof value!=='string')throw error('STORAGE_VALUE_UNSUPPORTED');
   busy=true;
   try{requirePersistent();storage.setItem(key,value);if(mode==='persistent')baseline=value;}
   finally{busy=false;}
  }
 });
 return Object.freeze({
  load:()=>loadStore({getItem(){if(mode==='temporary'&&initial===undefined)throw error('STORAGE_TEMPORARY');return initial;}}),
  storage:facade,check,getState,
  handleStorageEvent(event){
   if(event?.storageArea!==storage||(event.key!==STORE_KEY&&event.key!==null))return mode!=='blocked';
   return check();
  }
 });
}
