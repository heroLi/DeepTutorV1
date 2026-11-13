// DEVELOPMENT ONLY. Explicit host binding configuration, never request headers,
// routes or body. Native statements and results pass through unchanged.
export const RESERVE_SQL='INSERT OR IGNORE INTO tutor_claims(claim_key,token,scope,principal_id,profile_id,request_id,fingerprint,currency,requested_limit,reservation_micros,created_ms) VALUES(?,?,?,?,?,?,?,?,?,?,?)';
export const SETTLE_SQL="UPDATE tutor_claims SET state='settled',charge_micros=?,result_json=?,error_code=? WHERE token=? AND state='pending'";
const target={
 'reservation-after':[RESERVE_SQL,'SELECT * FROM tutor_claims WHERE claim_key=?'],
 'settlement-before':[SETTLE_SQL,'SELECT state,charge_micros,result_json,error_code FROM tutor_claims WHERE token=?'],
 'settlement-after':[SETTLE_SQL,'SELECT state,charge_micros,result_json,error_code FROM tutor_claims WHERE token=?']
};
export function withD1Fault(db,point=''){
 if(point!==''&&!Object.hasOwn(target,point))throw Error('Invalid development fault point');
 const statements=new WeakMap();let fired=false;
 const wrap=(native,sql)=>{
  const proxy=new Proxy(native,{get(object,key){if(key==='bind')return (...args)=>wrap(object.bind(...args),sql);const value=Reflect.get(object,key,object);return typeof value==='function'?value.bind(object):value;}});
  statements.set(proxy,{native,sql});return proxy;
 };
 return new Proxy(db,{get(object,key){
  if(key==='prepare')return sql=>wrap(object.prepare(sql),sql);
  if(key==='batch')return async batch=>{
   const mapped=batch.map(s=>statements.get(s)||{native:s,sql:null});
   const match=!fired&&point!==''&&mapped.length===2&&mapped.every((s,i)=>s.sql===target[point][i]);
   if(match){fired=true;if(point==='settlement-before')throw Error('DEVELOPMENT_INJECTED_BEFORE_COMMIT');}
   const result=await object.batch(mapped.map(s=>s.native));
   if(match)throw Error('DEVELOPMENT_INJECTED_LOST_ACK');
   return result;
  };
  const value=Reflect.get(object,key,object);return typeof value==='function'?value.bind(object):value;
 }});
}
